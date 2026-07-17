import express from "express";
import { dbPool } from "../server.js";
import { generateOTP, getExpiryTime } from "../public/utils/otpUtils.js";
import { sendOtpEmail } from "../public/service/sesEmail.service.js";
import { sign as cookieSign } from "cookie-signature";

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

    // Only allow emails that have an active booking somewhere — the matching
    // booking's own school_id (not a hardcoded one) is this student's tenant.
    const [enrolled] = await dbPool.query(
      `SELECT id, school_id FROM bookings WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (!enrolled.length) {
      return res.status(403).json({
        success: false,
        message: "No enrollment found for this email. Contact Dwarkesh Driving School to get enrolled."
      });
    }
    const schoolId = enrolled[0].school_id;

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
       (email, otp, expires_at, attempts, resend_count, last_sent_at, ip_address, school_id)
       VALUES (?, ?, ?, 0, 0, NOW(), ?, ?)`,
      [email, otp, expiresAt, ip, schoolId]
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

    // The matching booking's own school_id is this student's tenant — never hardcoded.
    const [[booking]] = await dbPool.query(
      `SELECT customer_name, mobile_no, school_id FROM bookings WHERE email = ? ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    const schoolId = booking?.school_id || 1;

    await dbPool.query(
      `INSERT INTO exam_users (email, first_verified_at, last_seen_at, school_id)
      VALUES (?, NOW(), NOW(), ?)
      ON DUPLICATE KEY UPDATE last_seen_at = NOW(), school_id = VALUES(school_id)`,
      [email, schoolId]
    );

    // Sync full_name and mobile_no from the most recent booking (booking is authoritative source)
    if (booking) {
      await dbPool.query(
        `UPDATE exam_users
         SET full_name = COALESCE(?, full_name),
             mobile_no  = COALESCE(mobile_no, ?)
         WHERE email = ?`,
        [booking.customer_name, booking.mobile_no, email]
      );
    }

    // Set exam user session
    const [userRow] = await dbPool.query(
      "SELECT id, email, full_name, school_id FROM exam_users WHERE email = ? LIMIT 1",
      [email]
    );
    if (userRow.length) {
      req.session.examUser = {
        id: userRow[0].id,
        email: userRow[0].email,
        full_name: userRow[0].full_name || null,
        school_id: userRow[0].school_id || 1,
      };
    }

    // Explicitly save session before responding so checkSession() sees it
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      // Return signed session token for mobile clients (iOS strips Set-Cookie headers)
      const secret = process.env.SESSION_SECRET || 'supersecretkey';
      const signed = 's:' + cookieSign(req.session.id, secret);
      const sessionToken = `session_cookie=${encodeURIComponent(signed)}`;
      res.json({ success: true, sessionToken });
    });

  } catch (err) {
    console.error("VERIFY OTP ERROR:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
