import express from 'express';
import { dbPool, requireAdmin } from '../server.js';

const router = express.Router();

// =============================
// GET ALL COURSES
// =============================
router.get("/", async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT id, course_name, description, status, created_at
      FROM courses
      WHERE school_id = 1
      ORDER BY id DESC
    `);

    res.json({ success: true, courses: rows });
  } catch (err) {
    console.error("COURSE LIST ERROR:", err);
    next(err);
  }
});

// =============================
// GET SINGLE COURSE BY ID
// =============================
router.get("/:id", async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(
      `SELECT id, course_name, description, status, created_at
       FROM courses WHERE id = ? AND school_id = 1`,
      [req.params.id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, course: rows[0] });
  } catch (err) {
    console.error("COURSE FETCH ERROR:", err);
    next(err);
  }
});

// =============================
// CREATE NEW COURSE
// =============================
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { course_name, description, status } = req.body;

    if (!course_name) {
      return res.json({ success: false, message: "Course name is required" });
    }

    const [result] = await dbPool.query(
      `INSERT INTO courses (course_name, description, status, school_id, created_by_id, created_by_type) VALUES (?, ?, ?, ?, ?, ?)`,
      [course_name, description || null, status || "active", req.schoolId, req.session.adminId, req.session.adminRole || 'instructor']
    );

    res.json({ success: true, message: "Course added", id: result.insertId });
  } catch (err) {
    console.error("COURSE CREATE ERROR:", err);
    next(err);
  }
});

// =============================
// UPDATE COURSE
// =============================
router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { course_name, description, status } = req.body;

    const [result] = await dbPool.query(
      `UPDATE courses SET course_name = ?, description = ?, status = ?, updated_by_id = ?, updated_by_type = ? WHERE id = ? AND school_id = ?`,
      [course_name, description, status, req.session.adminId, req.session.adminRole || 'instructor', req.params.id, req.schoolId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, message: "Course updated" });
  } catch (err) {
    console.error("COURSE UPDATE ERROR:", err);
    next(err);
  }
});

// =============================
// DELETE COURSE
// =============================
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const [result] = await dbPool.query(
      `DELETE FROM courses WHERE id = ? AND school_id = ?`,
      [req.params.id, req.schoolId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, message: "Course deleted" });
  } catch (err) {
    console.error("COURSE DELETE ERROR:", err);
    next(err);
  }
});

// =============================
// STATUS UPDATE
// =============================
router.patch("/:id/status", requireAdmin, async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!status) {
      return res.json({ success: false, message: "Status is required" });
    }

    const [result] = await dbPool.query(
      `UPDATE courses SET status = ?, updated_by_id = ?, updated_by_type = ? WHERE id = ? AND school_id = ?`,
      [status, req.session.adminId, req.session.adminRole || 'instructor', req.params.id, req.schoolId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Course not found" });
    }

    res.json({ success: true, message: "Status updated" });
  } catch (err) {
    console.error("COURSE STATUS UPDATE ERROR:", err);
    next(err);
  }
});

export default router;
