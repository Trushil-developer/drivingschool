import express from "express";
import { dbPool, requireAdmin } from "../server.js";

const router = express.Router();

// Helper: get the school_id from the session.
// Currently defaults to 1 (single school). When multi-school support is added,
// the login route sets req.session.school_id and this picks it up automatically.
function getSchoolId(req) {
    return req.session.school_id || 1;
}

// =====================
// EXPENSE CATEGORIES
// =====================

// Returns global defaults (school_id=0) + this school's custom ones
router.get("/categories", requireAdmin, async (req, res, next) => {
    const schoolId = getSchoolId(req);
    try {
        const [rows] = await dbPool.query(
            "SELECT * FROM expense_categories WHERE school_id = 0 OR school_id = ? ORDER BY is_custom ASC, id ASC",
            [schoolId]
        );
        res.json({ success: true, categories: rows });
    } catch (err) {
        next(err);
    }
});

router.post("/categories", requireAdmin, async (req, res, next) => {
    const schoolId = getSchoolId(req);
    const { name, is_car_related } = req.body;
    if (!name || !name.trim()) return res.json({ success: false, error: "Category name required" });
    try {
        const [result] = await dbPool.query(
            "INSERT INTO expense_categories (name, is_car_related, is_custom, school_id) VALUES (?, ?, 1, ?)",
            [name.trim(), is_car_related ? 1 : 0, schoolId]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        next(err);
    }
});

router.delete("/categories/:id", requireAdmin, async (req, res, next) => {
    const schoolId = getSchoolId(req);
    const { id } = req.params;
    try {
        const [rows] = await dbPool.query(
            "SELECT is_custom, school_id FROM expense_categories WHERE id = ?", [id]
        );
        if (!rows.length) return res.json({ success: false, error: "Not found" });
        if (!rows[0].is_custom) return res.json({ success: false, error: "Default categories cannot be deleted" });
        if (rows[0].school_id !== schoolId) return res.json({ success: false, error: "Not allowed" });
        await dbPool.query("DELETE FROM expense_categories WHERE id = ? AND school_id = ?", [id, schoolId]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// =====================
// PAYMENT MODES
// =====================

// Returns global defaults (school_id=0) + this school's custom ones
router.get("/payment-modes", requireAdmin, async (req, res, next) => {
    const schoolId = getSchoolId(req);
    try {
        const [rows] = await dbPool.query(
            "SELECT * FROM payment_modes WHERE school_id = 0 OR school_id = ? ORDER BY is_custom ASC, id ASC",
            [schoolId]
        );
        res.json({ success: true, modes: rows });
    } catch (err) {
        next(err);
    }
});

router.post("/payment-modes", requireAdmin, async (req, res, next) => {
    const schoolId = getSchoolId(req);
    const { name } = req.body;
    if (!name || !name.trim()) return res.json({ success: false, error: "Mode name required" });
    try {
        const [result] = await dbPool.query(
            "INSERT INTO payment_modes (name, is_custom, school_id) VALUES (?, 1, ?)",
            [name.trim(), schoolId]
        );
        res.json({ success: true, id: result.insertId });
    } catch (err) {
        next(err);
    }
});

router.delete("/payment-modes/:id", requireAdmin, async (req, res, next) => {
    const schoolId = getSchoolId(req);
    const { id } = req.params;
    try {
        const [rows] = await dbPool.query(
            "SELECT is_custom, school_id FROM payment_modes WHERE id = ?", [id]
        );
        if (!rows.length) return res.json({ success: false, error: "Not found" });
        if (!rows[0].is_custom) return res.json({ success: false, error: "Default modes cannot be deleted" });
        if (rows[0].school_id !== schoolId) return res.json({ success: false, error: "Not allowed" });
        await dbPool.query("DELETE FROM payment_modes WHERE id = ? AND school_id = ?", [id, schoolId]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

// =====================
// EXPENSES
// =====================

router.get("/", requireAdmin, async (req, res, next) => {
    const schoolId = getSchoolId(req);
    try {
        const [rows] = await dbPool.query(`
            SELECT
                e.id,
                e.branch,
                e.debitor,
                ec.name  AS category,
                ec.is_car_related,
                c.car_name,
                e.amount,
                pm.name  AS payment_mode,
                e.note,
                e.expense_date,
                e.created_at
            FROM expenses e
            LEFT JOIN expense_categories ec ON e.category_id = ec.id
            LEFT JOIN cars c ON e.car_id = c.id
            LEFT JOIN payment_modes pm ON e.payment_mode_id = pm.id
            WHERE e.school_id = ?
            ORDER BY e.id DESC
        `, [schoolId]);
        res.json({ success: true, expenses: rows });
    } catch (err) {
        next(err);
    }
});

router.post("/", requireAdmin, async (req, res, next) => {
    const schoolId = getSchoolId(req);
    const { branch, debitor, category_id, car_id, amount, payment_mode_id, note, expense_date } = req.body;

    if (!branch || !debitor || !category_id || !payment_mode_id || !expense_date) {
        return res.json({ success: false, error: "Missing required fields" });
    }

    try {
        const [result] = await dbPool.query(
            `INSERT INTO expenses (school_id, branch, debitor, category_id, car_id, amount, payment_mode_id, note, expense_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [schoolId, branch, debitor.trim(), category_id, car_id || null, amount || 0, payment_mode_id, note || null, expense_date]
        );
        res.json({ success: true, id: result.insertId, slip_no: result.insertId });
    } catch (err) {
        next(err);
    }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
    const schoolId = getSchoolId(req);
    const { id } = req.params;
    try {
        // Only delete if it belongs to this school
        await dbPool.query("DELETE FROM expenses WHERE id = ? AND school_id = ?", [id, schoolId]);
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
});

export default router;
