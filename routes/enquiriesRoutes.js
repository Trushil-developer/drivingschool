import express from "express";
import { dbPool, requireAdmin } from "../server.js";

const router = express.Router();

// =============================
// GET ALL ENQUIRIES (Admin only)
// =============================
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT e.id, e.full_name, e.email, e.phone,
             e.has_licence, e.message, e.created_at,
             b.branch_name, c.course_name
      FROM enquiries e
      LEFT JOIN branches b ON e.branch_id = b.id
      LEFT JOIN courses c ON e.course_id = c.id
      ORDER BY e.id DESC
    `);

    res.json({ success: true, enquiries: rows });
  } catch (err) {
    console.error("ENQUIRIES LIST ERROR:", err);
    next(err);
  }
});

// =============================
// GET SINGLE ENQUIRY BY ID (Admin only)
// =============================
router.get("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(
      `SELECT e.id, e.full_name, e.email, e.phone,
              e.has_licence, e.message, e.created_at,
              b.branch_name, c.course_name
       FROM enquiries e
       LEFT JOIN branches b ON e.branch_id = b.id
       LEFT JOIN courses c ON e.course_id = c.id
       WHERE e.id = ?`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    res.json({ success: true, enquiry: rows[0] });
  } catch (err) {
    console.error("ENQUIRY FETCH ERROR:", err);
    next(err);
  }
});

// =============================
// CREATE NEW ENQUIRY
// =============================
router.post("/", async (req, res, next) => {
  try {
    const {
      full_name,
      email,
      phone,
      branch_id,
      course_id,
      has_licence,
      message,
    } = req.body;

    // Basic validation
    if (!full_name || !email || !phone) {
      return res.status(400).json({ success: false, message: "Name, email, and phone are required" });
    }

    const [result] = await dbPool.query(
      `INSERT INTO enquiries 
      (full_name, email, phone, branch_id, course_id, has_licence, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        full_name,
        email,
        phone,
        branch_id || null,
        course_id || null,
        has_licence || "No",
        message || null,
      ]
    );

    res.json({ success: true, message: "Enquiry submitted successfully", id: result.insertId });
  } catch (err) {
    console.error("ENQUIRY CREATE ERROR:", err);
    next(err);
  }
});

// =============================
// UPDATE ENQUIRY (Admin only)
// =============================
router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const {
      full_name,
      email,
      phone,
      branch_id,
      course_id,
      has_licence,
      message,
    } = req.body;

    const [result] = await dbPool.query(
      `UPDATE enquiries SET
        full_name = ?, 
        email = ?, 
        phone = ?, 
        branch_id = ?, 
        course_id = ?, 
        has_licence = ?, 
        message = ?
       WHERE id = ?`,
      [
        full_name,
        email,
        phone,
        branch_id || null,
        course_id || null,
        has_licence || "No",
        message || null,
        req.params.id,
      ]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    res.json({ success: true, message: "Enquiry updated successfully" });
  } catch (err) {
    console.error("ENQUIRY UPDATE ERROR:", err);
    next(err);
  }
});

// =============================
// DELETE ENQUIRY (Admin only)
// =============================
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [result] = await dbPool.query(`DELETE FROM enquiries WHERE id = ?`, [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Enquiry not found" });
    }

    res.json({ success: true, message: "Enquiry deleted successfully" });
  } catch (err) {
    console.error("ENQUIRY DELETE ERROR:", err);
    next(err);
  }
});

export default router;
