import express from "express";
import { dbPool } from "../server.js";
import { generateOTP, getExpiryTime } from "../public/utils/otpUtils.js";
import { sendOtpEmail } from "../public/service/sesEmail.service.js";

const router = express.Router();
const MAX_SENDS_PER_HOUR = 5;
const MAX_RESENDS = 3;
const MAX_ATTEMPTS = 5;

/* =============================
   SEND EMAIL OTP
============================= */
router.post("/send-email-otp", async (req, res) => {
  try {
    const { email } = req.body;
    const ip = req.ip;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email required" });
    }

    // Rate limit: max OTPs per hour
    const [sentCount] = await dbPool.query(
      `SELECT COUNT(*) AS cnt FROM email_otps
       WHERE email = ? AND created_at > NOW() - INTERVAL 1 HOUR`,
      [email]
    );

    if (sentCount[0].cnt >= MAX_SENDS_PER_HOUR) {
      return res.status(429).json({ success: false, message: "OTP send limit reached. Try later." });
    }

    const otp = generateOTP();
    const expiresAt = getExpiryTime(10);

    // Invalidate previous OTPs
    await dbPool.query(
      `UPDATE email_otps
       SET expires_at = NOW(), verified = 0
       WHERE email = ? AND verified = 0`,
      [email]
    );

    // Insert new OTP
    await dbPool.query(
      `INSERT INTO email_otps
       (email, otp, expires_at, attempts, resend_count, last_sent_at, ip_address)
       VALUES (?, ?, ?, 0, 0, NOW(), ?)`,
      [email, otp, expiresAt, ip]
    );

    await sendOtpEmail(email, otp);

    res.json({ success: true });

  } catch (err) {
    console.error("SEND OTP ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/* =============================
   VERIFY EMAIL OTP
============================= */
router.post("/verify-email-otp", async (req, res) => {
  console.log("VERIFY OTP REQUEST:", req.body);
  try {
    const { email, otp } = req.body;

    // Find OTP record
    const [rows] = await dbPool.query(
      `SELECT * FROM email_otps
       WHERE email = ? AND otp = ? AND verified = 0 AND expires_at > NOW()`,
      [email, otp]
    );

    if (rows.length === 0) {
      // Increment attempts for last OTP to prevent brute-force
      await dbPool.query(
        `UPDATE email_otps
         SET attempts = attempts + 1
         WHERE email = ? AND verified = 0 AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [email]
      );

      // Check if attempts exceeded
      const [latest] = await dbPool.query(
        `SELECT attempts FROM email_otps
         WHERE email = ? AND verified = 0 AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1`,
        [email]
      );

      if (latest.length && latest[0].attempts >= MAX_ATTEMPTS) {
        await dbPool.query(
          `UPDATE email_otps
           SET expires_at = NOW() -- invalidate OTP
           WHERE email = ? AND verified = 0`,
          [email]
        );
      }

      return res.json({ success: false, message: "Invalid OTP" });
    }

    // Mark OTP as verified
    await dbPool.query(
      `UPDATE email_otps SET verified = 1 WHERE id = ?`,
      [rows[0].id]
    );

    await dbPool.query(
      `INSERT INTO exam_users (email, first_verified_at, last_seen_at)
      VALUES (?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE last_seen_at = NOW()`,
      [email]
    );

    res.json({ success: true });

  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
