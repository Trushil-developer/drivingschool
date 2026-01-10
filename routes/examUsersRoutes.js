import express from "express";
import { dbPool } from "../server.js";

const router = express.Router();

/**
 * Verify or update exam user after OTP success
 */
router.post("/verify", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ success: false, error: "Email required" });
        }

        const ip = req.ip;
        const agent = req.headers["user-agent"];

        const [rows] = await dbPool.query(
            "SELECT id FROM exam_users WHERE email = ? LIMIT 1",
            [email]
        );

        if (!rows.length) {
            // First time user
            await dbPool.query(`
                INSERT INTO exam_users
                (email, first_verified_at, last_seen_at, ip_address, user_agent)
                VALUES (?, NOW(), NOW(), ?, ?)
            `, [email, ip, agent]);
        } else {
            // Returning user
            await dbPool.query(`
                UPDATE exam_users
                SET last_seen_at = NOW(),
                    ip_address = ?,
                    user_agent = ?
                WHERE email = ?
            `, [ip, agent, email]);
        }

        res.json({ success: true });

    } catch (err) {
        console.error("EXAM USER VERIFY ERROR:", err);
        res.status(500).json({ success: false, error: "Server error" });
    }
});

export default router;
