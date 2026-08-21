// One-off broadcast: notify all currently active students about the Book My Drive
// app launch and remind them of their login (booking ID + registered mobile number).
// Run with: node scripts/sendAppLaunchEmails.js
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import { sendAppLaunchAnnouncementEmail } from '../public/service/sesEmail.service.js';

dotenv.config();

const SEND_DELAY_MS = 1200; // stays well under SES's 14/sec production limit

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [students] = await pool.query(
    `SELECT id, customer_name, email FROM bookings
     WHERE attendance_status = 'Active' AND email IS NOT NULL AND email != ''`
  );

  console.log(`Found ${students.length} active students with an email on file.`);

  let sent = 0;
  let failed = 0;

  for (const student of students) {
    try {
      await sendAppLaunchAnnouncementEmail(student.email, {
        bookingId: student.id,
        customerName: student.customer_name,
      });
      sent++;
      console.log(`[${sent + failed}/${students.length}] sent -> booking #${student.id}`);
    } catch (err) {
      failed++;
      console.error(`[${sent + failed}/${students.length}] FAILED -> booking #${student.id}:`, err.message);
    }
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS));
  }

  console.log(`\nDone. Sent: ${sent}, Failed: ${failed}, Total: ${students.length}`);
  await pool.end();
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
