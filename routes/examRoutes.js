import express from "express";
import { dbPool, requireAdmin } from "../server.js";

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

/* =========================
   ADMIN: GET ALL EXAM USERS
========================= */
router.get("/admin/users", requireAdmin, async (req, res) => {
    try {
        const [users] = await dbPool.query(`
            SELECT
                id, email, first_verified_at, last_seen_at,
                total_attempts, best_score, last_score, last_result
            FROM exam_users
            ORDER BY last_seen_at DESC
        `);

        res.json({ success: true, users });
    } catch (err) {
        console.error("ADMIN EXAM USERS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: GET ALL EXAM ATTEMPTS
========================= */
router.get("/admin/attempts", requireAdmin, async (req, res) => {
    try {
        const { user_id } = req.query;

        let query = `
            SELECT
                a.id, a.user_id, a.mode, a.score, a.total_questions,
                a.correct_answers, a.result, a.started_at, a.finished_at, a.status,
                u.email
            FROM exam_attempts a
            JOIN exam_users u ON a.user_id = u.id
        `;
        const params = [];

        if (user_id) {
            query += " WHERE a.user_id = ?";
            params.push(user_id);
        }

        query += " ORDER BY a.started_at DESC LIMIT 500";

        const [attempts] = await dbPool.query(query, params);

        res.json({ success: true, attempts });
    } catch (err) {
        console.error("ADMIN EXAM ATTEMPTS ERROR:", err);
        res.status(500).json({ success: false });
    }
});

/* =========================
   ADMIN: EXAM OVERVIEW STATS
========================= */
router.get("/admin/overview", requireAdmin, async (req, res) => {
    try {
        const [[userStats]] = await dbPool.query(`
            SELECT
                COUNT(*) AS totalUsers,
                SUM(total_attempts) AS totalAttempts,
                ROUND(AVG(best_score), 1) AS avgBestScore
            FROM exam_users
        `);

        const [[attemptStats]] = await dbPool.query(`
            SELECT
                SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) AS passed,
                SUM(CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END) AS failed,
                ROUND(AVG(score), 1) AS avgScore
            FROM exam_attempts
            WHERE status = 'completed'
        `);

        const [recentActivity] = await dbPool.query(`
            SELECT
                DATE(started_at) AS date,
                COUNT(*) AS attempts
            FROM exam_attempts
            WHERE started_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY DATE(started_at)
            ORDER BY date ASC
        `);

        res.json({
            success: true,
            stats: {
                totalUsers: userStats.totalUsers || 0,
                totalAttempts: userStats.totalAttempts || 0,
                avgBestScore: userStats.avgBestScore || 0,
                passed: attemptStats.passed || 0,
                failed: attemptStats.failed || 0,
                avgScore: attemptStats.avgScore || 0,
                passRate: attemptStats.passed && (attemptStats.passed + attemptStats.failed) > 0
                    ? Math.round((attemptStats.passed / (attemptStats.passed + attemptStats.failed)) * 100)
                    : 0
            },
            recentActivity
        });
    } catch (err) {
        console.error("ADMIN EXAM OVERVIEW ERROR:", err);
        res.status(500).json({ success: false });
    }
});

export default router;
