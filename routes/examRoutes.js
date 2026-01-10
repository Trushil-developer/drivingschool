import express from "express";
import { dbPool } from "../server.js";

const router = express.Router();

/* =========================
   START EXAM ATTEMPT
========================= */
router.post("/attempt/start", async (req, res) => {
    const { email, exam_type = "car" } = req.body;
    if (!email) return res.status(400).json({ success: false });

    try {
        const [user] = await dbPool.query(
            "SELECT id FROM exam_users WHERE email=? LIMIT 1",
            [email]
        );

        if (!user.length) {
            return res.status(404).json({ success: false, error: "User not verified" });
        }

        const [existing] = await dbPool.query(
            `SELECT id FROM exam_attempts
             WHERE user_id=? AND status='started'
             ORDER BY id DESC LIMIT 1`,
            [user[0].id]
        );

        if (existing.length) {
            return res.json({ success: true, attempt_id: existing[0].id, resumed: true });
        }

        const [result] = await dbPool.query(
            `INSERT INTO exam_attempts (user_id, mode, started_at, status)
            VALUES (?, ?, NOW(), 'started')`,
            [user[0].id, exam_type]  
        );

        res.json({ success: true, attempt_id: result.insertId });

    } catch (err) {
        console.error("START EXAM ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   FINISH EXAM ATTEMPT
========================= */
router.post("/attempt/finish", async (req, res) => {
    const { email, score, total_questions } = req.body;
    if (!email) return res.status(400).json({ success: false });

    try {
        const [user] = await dbPool.query(
            "SELECT id FROM exam_users WHERE email=? LIMIT 1",
            [email]
        );

        if (!user.length) return res.status(404).json({ success: false });

        const result = score >= 9 ? "PASS" : "FAIL";

        await dbPool.query(
            `UPDATE exam_attempts
             SET score=?, total_questions=?, result=?,
                 finished_at=NOW(), status='completed'
             WHERE user_id=? AND status='started'
             ORDER BY id DESC LIMIT 1`,
            [score, total_questions, result, user[0].id]
        );

        await dbPool.query(
            `UPDATE exam_users
             SET total_attempts = total_attempts + 1,
                 last_score = ?, last_result = ?,
                 best_score = GREATEST(best_score, ?)
             WHERE id=?`,
            [score, result, score, user[0].id]
        );

        res.json({ success: true });

    } catch (err) {
        console.error("FINISH EXAM ERROR:", err);
        res.status(500).json({ success: false });
    }
});

export default router;
