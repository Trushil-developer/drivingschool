import express from 'express';
import mysql from 'mysql2/promise';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: 'supersecretkey',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));

// ==================================================================
// MySQL CONNECTION
// ==================================================================
const db = await mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'trushil',
  database: 'drivingschool'
});

console.log('Connected to MySQL database.');

// ==================================================================
// AUTH USING DATABASE
// ==================================================================

// LOGIN
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT * FROM admins WHERE username = ? LIMIT 1",
      [username]
    );

    if (rows.length === 0) {
      return res.json({ success: false, error: "Invalid credentials" });
    }

    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      return res.json({ success: false, error: "Invalid credentials" });
    }

    req.session.adminLoggedIn = true;
    req.session.adminId = admin.id;
    res.json({ success: true });

  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// LOGOUT
app.post('/api/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) return res.status(500).json({ success: false, error: "Logout failed" });
    res.json({ success: true });
  });
});

// Middleware
function requireAdmin(req, res, next) {
  if (req.session.adminLoggedIn) return next();
  return res.status(401).json({ success: false, error: "Unauthorized" });
}

// ==================================================================
// DATE HELPER
// ==================================================================
function toMySQLDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d)) return null;
  return d.toISOString().split("T")[0];
}

// ==================================================================
// BOOKINGS CRUD
// ==================================================================

// CREATE BOOKING
app.post('/api/bookings', async (req, res) => {
  const data = req.body;

  data.starting_from = toMySQLDate(data.starting_from);
  data.birth_date = toMySQLDate(data.birth_date);
  data.dl_from = toMySQLDate(data.dl_from);
  data.dl_to = toMySQLDate(data.dl_to);

  if (!data.customer_name || !data.mobile_no || !data.training_days || !data.branch) {
    return res.status(400).json({ success: false, error: "Missing required fields" });
  }

  try {
    const sql = `
      INSERT INTO bookings (
        branch, training_days, customer_name, address, mobile_no, whatsapp_no,
        sex, birth_date, cov_lmv, cov_mc, dl_no, dl_from, dl_to, email,
        occupation, ref, allotted_time, starting_from, total_fees, advance,
        car_name, instructor_name, present_days
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
    `;

    const values = [
      data.branch, data.training_days, data.customer_name, data.address || '',
      data.mobile_no, data.whatsapp_no || '', data.sex || '', data.birth_date || null,
      data.cov_lmv ? 1 : 0, data.cov_mc ? 1 : 0, data.dl_no || '', data.dl_from || null,
      data.dl_to || null, data.email || '', data.occupation || '', data.ref || '',
      data.allotted_time || null, data.starting_from || null, data.total_fees || 0, data.advance || 0,
      data.car_names || '', data.instructor_name || ''
    ];

    const [result] = await db.query(sql, values);
    res.json({ success: true, booking_id: result.insertId });

  } catch (err) {
    console.error("BOOKING CREATE ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// LIST BOOKINGS
app.get('/api/bookings', requireAdmin, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id, branch, training_days, customer_name, address, mobile_no, whatsapp_no,
        sex, birth_date, cov_lmv, cov_mc, dl_no, dl_from, dl_to, email,
        occupation, ref, allotted_time, starting_from, total_fees, advance,
        car_name, instructor_name, present_days, created_at
      FROM bookings
      ORDER BY id DESC
    `);

    res.json({ success: true, bookings: rows });

  } catch (err) {
    console.error("BOOKINGS LIST ERROR:", err);
    res.status(500).json({ success: false, error: "Failed to fetch bookings" });
  }
});

// UPDATE BOOKING
app.put('/api/bookings/:id', requireAdmin, async (req, res) => {
  const id = req.params.id;
  const data = req.body;

  data.starting_from = toMySQLDate(data.starting_from);
  data.birth_date = toMySQLDate(data.birth_date);
  if (!data.allotted_time) data.allotted_time = null;

  try {
    const sql = `
      UPDATE bookings SET
        branch=?, training_days=?, customer_name=?, address=?, mobile_no=?, whatsapp_no=?,
        sex=?, birth_date=?, cov_lmv=?, cov_mc=?, dl_no=?, dl_from=?, dl_to=?, email=?,
        occupation=?, ref=?, allotted_time=?, starting_from=?, total_fees=?, advance=?,
        car_name=?, instructor_name=?
      WHERE id=?
    `;

    const values = [
      data.branch, data.training_days, data.customer_name, data.address,
      data.mobile_no, data.whatsapp_no, data.sex, data.birth_date,
      data.cov_lmv ? 1 : 0, data.cov_mc ? 1 : 0, data.dl_no, data.dl_from,
      data.dl_to, data.email, data.occupation, data.ref, data.allotted_time,
      data.starting_from, data.total_fees || 0, data.advance || 0,
      data.car_name || '', data.instructor_name || '', id
    ];

    await db.query(sql, values);
    res.json({ success: true });

  } catch (err) {
    console.error("BOOKING UPDATE ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE BOOKING
app.delete('/api/bookings/:id', requireAdmin, async (req, res) => {
  try {
    await db.query("DELETE FROM bookings WHERE id=?", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error("BOOKING DELETE ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================================================================
// ATTENDANCE SYSTEM
// ==================================================================
await db.query(`
  CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    date DATE NOT NULL,
    present TINYINT(1) DEFAULT 0,
    UNIQUE KEY unique_record (booking_id, date),
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
  )
`);

// GET Attendance
app.get('/api/attendance/:booking_id', requireAdmin, async (req, res) => {
  const booking_id = req.params.booking_id;

  try {
    const [rows] = await db.query(
      "SELECT date, present FROM attendance WHERE booking_id=? ORDER BY date ASC",
      [booking_id]
    );
    res.json({ success: true, records: rows });
  } catch (err) {
    console.error("ATTENDANCE GET ERROR:", err);
    res.status(500).json({ success: false, error: "Failed to get attendance" });
  }
});

// SAVE Attendance
app.post('/api/attendance/:booking_id', requireAdmin, async (req, res) => {
  const booking_id = req.params.booking_id;
  const { attendance } = req.body;

  if (!Array.isArray(attendance))
    return res.json({ success: false, error: "attendance array required" });

  try {
    await db.query("DELETE FROM attendance WHERE booking_id=?", [booking_id]);

    for (const item of attendance) {
      await db.query(
        `INSERT INTO attendance (booking_id, date, present)
        VALUES (?, ?, 1)`,
        [booking_id, toMySQLDate(item.date)]
      );
    }

    await db.query(
      `UPDATE bookings SET present_days = (
        SELECT COUNT(*) FROM attendance WHERE booking_id=? AND present=1
      ) WHERE id=?`,
      [booking_id, booking_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("ATTENDANCE SAVE ERROR:", err);
    res.status(500).json({ success: false, error: "Failed to save attendance" });
  }
});

// ==================================================================
// START SERVER
// ==================================================================
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
