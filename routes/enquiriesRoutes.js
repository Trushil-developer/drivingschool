import express from "express";
import { dbPool, requireAdmin } from "../server.js";

const router = express.Router();

/* =============================
   GET ALL ENQUIRIES (Admin)
============================= */
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : null;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const search = (req.query.search || '').trim();
    const branch = (req.query.branch || '').trim();
    const status = (req.query.status || '').trim();

    const conditions = [];
    const params = [];

    if (search) {
      conditions.push('(e.full_name LIKE ? OR e.phone LIKE ? OR e.email LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    if (branch) { conditions.push('b.branch_name = ?'); params.push(branch); }
    if (status) { conditions.push('e.status = ?'); params.push(status); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const baseQuery = `
      FROM enquiries e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN courses c ON e.course_id = c.id
      LEFT JOIN enquiry_actions a ON a.enquiry_id = e.id
      ${where}
      GROUP BY e.id`;

    const selectCols = `
      e.id, e.full_name, e.email, e.phone, e.has_licence, e.hear_about, e.message,
      e.status, e.created_at, b.branch_name, c.course_name, COUNT(a.id) AS action_count`;

    if (page !== null) {
      const offset = (page - 1) * limit;
      const [[{ total }]] = await dbPool.query(`SELECT COUNT(DISTINCT e.id) as total FROM enquiries e LEFT JOIN branches b ON e.branch_id = b.id ${where}`, params);
      const [rows] = await dbPool.query(`SELECT ${selectCols} ${baseQuery} ORDER BY e.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
      res.json({ success: true, enquiries: rows, total, page, limit });
    } else {
      const [rows] = await dbPool.query(`SELECT ${selectCols} ${baseQuery} ORDER BY e.id DESC`, params);
      res.json({ success: true, enquiries: rows });
    }
  } catch (err) {
    console.error("ENQUIRIES LIST ERROR:", err);
    next(err);
  }
});

/* =============================
   GET SINGLE ENQUIRY (Admin)
============================= */
router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(
      `
      SELECT 
        e.id,
        e.full_name,
        e.email,
        e.phone,
        e.has_licence,
        e.hear_about,
        e.message,
        e.created_at,
        b.branch_name,
        c.course_name
      FROM enquiries e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN courses c ON e.course_id = c.id
      WHERE e.id = ?
      `,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found"
      });
    }

    res.json({ success: true, enquiry: rows[0] });
  } catch (err) {
    console.error("ENQUIRY FETCH ERROR:", err);
    next(err);
  }
});

/* =============================
   CREATE NEW ENQUIRY
============================= */
router.post("/", async (req, res, next) => {
  try {
    const {
      full_name,
      email,
      phone,
      branch_id,
      course_id,
      has_licence,
      hear_about,
      message
    } = req.body;

    if (
      !full_name ||
      !email ||
      !phone ||
      !branch_id ||
      !course_id ||
      !hear_about
    ) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be filled"
      });
    }

    const [result] = await dbPool.query(
      `
      INSERT INTO enquiries (
        full_name,
        email,
        phone,
        branch_id,
        course_id,
        has_licence,
        hear_about,
        message
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        full_name.trim(),
        email.toLowerCase().trim(),
        phone.trim(),
        branch_id,
        course_id,
        has_licence || "No",
        hear_about,                 
        message || null
      ]
    );

    res.json({
      success: true,
      message: "Enquiry submitted successfully",
      id: result.insertId
    });
  } catch (err) {
    console.error("ENQUIRY CREATE ERROR:", err);
    next(err);
  }
});

/* =============================
   UPDATE ENQUIRY (Admin)
============================= */
router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const {
      full_name,
      email,
      phone,
      branch_id,
      course_id,
      has_licence,
      hear_about,
      message
    } = req.body;

    const [result] = await dbPool.query(
      `
      UPDATE enquiries SET
        full_name = ?,
        email = ?,
        phone = ?,
        branch_id = ?,
        course_id = ?,
        has_licence = ?,
        hear_about = ?,
        message = ?
      WHERE id = ?
      `,
      [
        full_name,
        email,
        phone,
        branch_id || null,
        course_id || null,
        has_licence || "No",
        hear_about || null,
        message || null,
        req.params.id
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found"
      });
    }

    res.json({
      success: true,
      message: "Enquiry updated successfully"
    });
  } catch (err) {
    console.error("ENQUIRY UPDATE ERROR:", err);
    next(err);
  }
});

/* =============================
   UPDATE ENQUIRY STATUS (Admin)
============================= */
router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!status) return res.json({ success: false, message: "Status is required" });

    const [result] = await dbPool.query(
      `UPDATE enquiries SET status = ? WHERE id = ?`,
      [status, req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    res.json({ success: true, message: "Status updated" });
  } catch (err) {
    console.error("ENQUIRY STATUS UPDATE ERROR:", err);
    next(err);
  }
});

/* =============================
   DELETE ENQUIRY (Admin)
============================= */
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [result] = await dbPool.query(
      `DELETE FROM enquiries WHERE id = ?`,
      [req.params.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "Enquiry not found"
      });
    }

    res.json({
      success: true,
      message: "Enquiry deleted successfully"
    });
  } catch (err) {
    console.error("ENQUIRY DELETE ERROR:", err);
    next(err);
  }
});

/* =============================
   GET ACTIONS FOR ENQUIRY
============================= */
router.get("/:id/actions", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(
      `SELECT * FROM enquiry_actions WHERE enquiry_id = ? ORDER BY action_date DESC`,
      [req.params.id]
    );
    res.json({ success: true, actions: rows });
  } catch (err) {
    console.error("ENQUIRY ACTIONS FETCH ERROR:", err);
    next(err);
  }
});

/* =============================
   ADD ACTION TO ENQUIRY
============================= */
router.post("/:id/actions", requireAdmin, async (req, res, next) => {
  try {
    const { action_type, note, action_by, action_date } = req.body;

    if (!note || !action_by) {
      return res.status(400).json({ success: false, message: "Note and action_by are required" });
    }

    const [result] = await dbPool.query(
      `INSERT INTO enquiry_actions (enquiry_id, action_type, note, action_by, action_date)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.params.id,
        action_type || "Call",
        note.trim(),
        action_by.trim(),
        action_date || new Date()
      ]
    );

    // Also update enquiry status if provided
    if (req.body.status) {
      await dbPool.query(
        `UPDATE enquiries SET status = ? WHERE id = ?`,
        [req.body.status, req.params.id]
      );
    }

    res.json({ success: true, message: "Action added", id: result.insertId });
  } catch (err) {
    console.error("ENQUIRY ACTION ADD ERROR:", err);
    next(err);
  }
});

/* =============================
   DELETE ACTION
============================= */
router.delete("/:id/actions/:actionId", requireAdmin, async (req, res, next) => {
  try {
    await dbPool.query(
      `DELETE FROM enquiry_actions WHERE id = ? AND enquiry_id = ?`,
      [req.params.actionId, req.params.id]
    );
    res.json({ success: true, message: "Action deleted" });
  } catch (err) {
    console.error("ENQUIRY ACTION DELETE ERROR:", err);
    next(err);
  }
});

export default router;
