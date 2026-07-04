process.env.TZ = 'Asia/Kolkata'; // Force IST across all Date operations

import express from 'express';
import mysql from 'mysql2/promise';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import MySQLStoreImport from 'express-mysql-session';
import cron from 'node-cron';
import { sign as cookieSign } from 'cookie-signature';
import updateBookingsStatus from './scripts/updateBookings.js';
import trainingDaysRoute from './routes/trainingDays.js';
import instructorsRoute from './routes/instructorsRoutes.js';
import preferredCoursesRoutes from "./routes/preferredCoursesRoutes.js";
import enquiriesRoutes from "./routes/enquiriesRoutes.js";
import otpRoutes from "./routes/otpRoutes.js";
import carsRoute from './routes/carsRoutes.js';
import upload from "./public/middleware/upload.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import examUsersRoutes from "./routes/examUsersRoutes.js";
import cmsRoutes from "./routes/cmsRoutes.js";
import examRoutes from "./routes/examRoutes.js";
import AWS from "aws-sdk";
import fs from "fs";
import packagesRoutes from './routes/packagesRoutes.js';
import expensesRoutes from './routes/expensesRoutes.js';
import reviewsRoute from './routes/reviewsRoute.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
    region: process.env.S3_REGION 
});

// ---------- Create a mysql pool ----------
export const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+05:30',
});

// Force IST on every MySQL connection so CURDATE(), NOW() etc. always return IST
// regardless of where the server is hosted (EC2 UTC, etc.)
dbPool.pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+05:30'");
});

(async () => {
  try {
    const conn = await dbPool.getConnection();
    conn.release();
    console.log('MySQL pool created and connection verified.');
  } catch (err) {
    console.error('MySQL pool connection error (verify DB env vars):', err);
  }
})();

// ---------- Session ----------
const MySQLStore = MySQLStoreImport(session);
const sessionStore = new MySQLStore({}, dbPool);

app.use(cors());

// 301 redirect: non-www → www
app.use((req, res, next) => {
  const host = req.headers.host || '';
  if (process.env.NODE_ENV === 'production' && !host.startsWith('www.')) {
    return res.redirect(301, `https://www.${host}${req.url}`);
  }
  next();
});

// 301 redirect: /index.html → /
app.use((req, res, next) => {
  if (req.path === '/index.html') {
    const qs = req.url.slice('/index.html'.length); // preserve any query string
    return res.redirect(301, '/' + qs);
  }
  next();
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Mobile auth bridge: iOS strips Cookie headers, so mobile sends token via X-Session-Token.
// Inject it into req.headers.cookie so express-session can read it normally.
app.use((req, res, next) => {
  const mobileToken = req.headers['x-session-token'];
  if (mobileToken) {
    req.headers.cookie = req.headers.cookie
      ? `${req.headers.cookie}; ${mobileToken}`
      : mobileToken;
  }
  next();
});

if (!process.env.SESSION_SECRET) {
  console.warn('WARNING: SESSION_SECRET env var not set. Using insecure fallback. Set it in .env before going to production.');
}

app.use(
  session({
    key: 'session_cookie',
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 attempts per window
  message: { success: false, error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ---------- Helpers ----------
export function computeAttendanceStatus(booking) {
  const hold = Number(booking.hold_status) === 1;
  const presentDays = Number(booking.present_days) || 0;
  const trainingDays = Number(booking.training_days);
  const extended = Number(booking.extended_days || 0);

  const startDate = booking.starting_from ? new Date(booking.starting_from) : null;
  const today = new Date();

  if (hold) return 'Hold';
  if (presentDays >= trainingDays) return 'Completed';
  if (!startDate) return 'Pending';

  const expireDate = new Date(startDate);
  expireDate.setDate(expireDate.getDate() + 30 + extended); 

  if (today > expireDate) return 'Expired';
  if (startDate > today) return 'Pending';
  return 'Active';
}


async function fetchBookingMinimal(id) {
  const [rows] = await dbPool.query(
    `SELECT id, starting_from, training_days, present_days, hold_status FROM bookings WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows.length ? rows[0] : null;
}

export async function recomputeAndStoreAttendanceStatus(bookingId) {
  const booking = await fetchBookingMinimal(bookingId);
  if (!booking) return;
  const newStatus = computeAttendanceStatus(booking);
  await dbPool.query(`UPDATE bookings SET attendance_status = ? WHERE id = ?`, [newStatus, bookingId]);
}

export function toMySQLDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d)) return null;
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// =====================
// SLOT NORMALIZER (MAX 4)
// =====================
function normalizeSlots(selectedSlots = []) {
  const slots = Array.isArray(selectedSlots) ? selectedSlots.slice(0, 4) : [];

  const normalizeTime = (t) => {
    if (!t) return null;
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(t);
    if (!match) return null;
    const hh = parseInt(match[1], 10);
    const mm = parseInt(match[2], 10);
    const totalMins = hh * 60 + mm;
    // Reject times outside working hours 06:00–22:00
    if (totalMins < 6 * 60 || totalMins > 22 * 60) return null;
    const ss = match[3] || "00";
    return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}:${ss}`;
  };

  return {
    allotted_time: normalizeTime(slots[0]),
    allotted_time2: normalizeTime(slots[1]),
    allotted_time3: normalizeTime(slots[2]),
    allotted_time4: normalizeTime(slots[3]),
  };
}


// ---------- AUTH ----------
app.post('/api/login', loginLimiter, async (req, res, next) => {
  const { username, password } = req.body;
  try {
    const [rows] = await dbPool.query('SELECT * FROM admins WHERE username = ? LIMIT 1', [username]);
    if (!rows || rows.length === 0) return res.json({ success: false, error: 'Invalid credentials' });
    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.json({ success: false, error: 'Invalid credentials' });

    req.session.adminLoggedIn = true;
    req.session.adminId = admin.id;
    req.session.school_id = admin.school_id || 1;
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve(undefined))),
    );
    // Return the signed session token in the body so mobile clients
    // can store it manually (iOS strips Set-Cookie headers in NSURLSession)
    const secret = process.env.SESSION_SECRET || 'supersecretkey';
    const signed = 's:' + cookieSign(req.session.id, secret);
    const sessionToken = `session_cookie=${encodeURIComponent(signed)}`;
    res.json({ success: true, sessionToken });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    next(err);
  }
});

app.post('/api/driver-login', async (req, res, next) => {
  const { employee_no, password } = req.body;
  try {
    if (!employee_no || !password) return res.json({ success: false, error: 'Employee number and password required' });
    const [rows] = await dbPool.query(
      'SELECT * FROM instructors WHERE BINARY employee_no = ? AND is_active = 1 LIMIT 1',
      [employee_no.trim()]
    );
    if (!rows || rows.length === 0) return res.json({ success: false, error: 'Invalid credentials' });
    const instructor = rows[0];
    const mobileClean = (instructor.mobile_no || '').replace(/\D/g, '');
    const passClean   = (password || '').replace(/\D/g, '');
    if (passClean !== mobileClean) return res.json({ success: false, error: 'Invalid credentials' });

    req.session.adminLoggedIn = true;
    req.session.adminId       = instructor.id;
    req.session.school_id     = instructor.school_id || 1;
    await new Promise((resolve, reject) =>
      req.session.save((err) => (err ? reject(err) : resolve(undefined))),
    );
    const secret = process.env.SESSION_SECRET || 'supersecretkey';
    const signed = 's:' + cookieSign(req.session.id, secret);
    const sessionToken = `session_cookie=${encodeURIComponent(signed)}`;
    res.json({
      success: true,
      sessionToken,
      instructor: {
        id:          instructor.id,
        name:        instructor.instructor_name,
        branch:      instructor.branch,
        employee_no: instructor.employee_no,
        mobile_no:   instructor.mobile_no,
      },
    });
  } catch (err) {
    console.error('DRIVER LOGIN ERROR:', err);
    next(err);
  }
});

// ── Driver Leave Requests ──────────────────────────────────────────────────────

app.post('/api/driver-leave', requireAdmin, async (req, res, next) => {
  const { leave_from, leave_to, leave_type, reason } = req.body;
  const instructorId = req.session.adminId;
  if (!leave_from || !leave_to || !leave_type) return res.json({ success: false, error: 'From date, to date and type required' });
  if (leave_to < leave_from) return res.json({ success: false, error: 'To date must be on or after from date' });
  const ensureTable = () => dbPool.query(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      instructor_id INT NOT NULL,
      instructor_name VARCHAR(100),
      branch VARCHAR(100),
      leave_from DATE NOT NULL,
      leave_to DATE NOT NULL,
      leave_type ENUM('Full Day','Half Day') NOT NULL DEFAULT 'Full Day',
      reason TEXT,
      status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
      created_at DATETIME NOT NULL
    )
  `);
  try {
    const [rows] = await dbPool.query(
      'SELECT instructor_name, branch FROM instructors WHERE id = ? LIMIT 1', [instructorId]
    );
    const name   = rows[0]?.instructor_name ?? 'Unknown';
    const branch = rows[0]?.branch ?? '';
    const [result] = await dbPool.query(
      `INSERT INTO leave_requests (instructor_id, instructor_name, branch, leave_from, leave_to, leave_type, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
      [instructorId, name, branch, leave_from, leave_to, leave_type, reason || null]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      await ensureTable();
      const [rows] = await dbPool.query('SELECT instructor_name, branch FROM instructors WHERE id = ? LIMIT 1', [instructorId]);
      const name = rows[0]?.instructor_name ?? ''; const branch = rows[0]?.branch ?? '';
      const [result] = await dbPool.query(
        `INSERT INTO leave_requests (instructor_id, instructor_name, branch, leave_from, leave_to, leave_type, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', NOW())`,
        [instructorId, name, branch, leave_from, leave_to, leave_type, reason || null]
      );
      return res.json({ success: true, id: result.insertId });
    }
    next(err);
  }
});

app.get('/api/driver-leave', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  try {
    const [rows] = await dbPool.query(
      `SELECT id, leave_from, leave_to, leave_type, reason, status, created_at
       FROM leave_requests WHERE instructor_id = ? ORDER BY leave_from DESC LIMIT 30`,
      [instructorId]
    );
    res.json({ success: true, leaves: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, leaves: [] });
    next(err);
  }
});

// Admin: view all leave requests for the school
app.get('/api/admin/leave-requests', requireAdmin, async (req, res, next) => {
  const schoolId = req.session.school_id || 1;
  const { status } = req.query;
  try {
    let q = `SELECT lr.id, lr.instructor_id, lr.instructor_name, lr.branch,
                    lr.leave_from, lr.leave_to, lr.leave_type, lr.reason, lr.status, lr.created_at,
                    i.employee_no
             FROM leave_requests lr
             LEFT JOIN instructors i ON lr.instructor_id = i.id
             WHERE i.school_id = ?`;
    const params = [schoolId];
    if (status) { q += ' AND lr.status = ?'; params.push(status); }
    q += ' ORDER BY lr.created_at DESC LIMIT 200';
    const [rows] = await dbPool.query(q, params);
    res.json({ success: true, requests: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, requests: [] });
    next(err);
  }
});

// Admin: approve or reject a leave request
app.patch('/api/admin/leave-requests/:id', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['Approved', 'Rejected'].includes(status))
    return res.json({ success: false, error: 'Status must be Approved or Rejected' });
  try {
    await dbPool.query('UPDATE leave_requests SET status = ? WHERE id = ?', [status, id]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('LOGOUT ERROR:', err);
      return res.status(500).json({ success: false, error: 'Logout failed' });
    }
    res.json({ success: true });
  });
});

// ---------- EXAM USER SESSION ----------
app.get('/api/exam/session', (req, res) => {
  if (req.session && req.session.examUser) {
    res.json({ success: true, loggedIn: true, user: req.session.examUser });
  } else {
    res.json({ success: true, loggedIn: false });
  }
});

app.post('/api/exam/logout', (req, res) => {
  if (req.session.examUser) {
    delete req.session.examUser;
  }
  req.session.save(() => {
    res.json({ success: true });
  });
});

// ---------- BOOKINGS CRUD ----------
app.post('/api/bookings', async (req, res, next) => {
  const data = req.body;
  const slotTimes = normalizeSlots(data.selected_slots || []);

  if (!data.training_days) {
    return res.status(400).json({
      success: false,
      error: "Training days missing"
    });
  }

  try {
    const initialPresentDays = 0;
    const initialHoldStatus = data.hold_status ? 1 : 0;

    const preliminaryBooking = {
      starting_from: data.starting_from || null,
      training_days: data.training_days,
      present_days: initialPresentDays,
      hold_status: initialHoldStatus
    };

    const attendanceStatus = computeAttendanceStatus(preliminaryBooking);

    // Correct column order matching DESCRIBE BOOKINGS
    const sql = `
INSERT INTO bookings (
  branch, training_days, car_name,
  customer_name, address, pincode,
  mobile_no, whatsapp_no,
  sex, birth_date,
  cov_lmv, cov_mc,
  dl_no, dl_from, dl_to,
  email, occupation, ref,
  allotted_time, allotted_time2, allotted_time3, allotted_time4,
  starting_from,
  total_fees, advance,
  instructor_name,
  present_days, hold_status, attendance_status,
  hold_from, resume_from, extended_days,
  duration_minutes, certificate_url,
  ac_facility, pickup_drop, has_licence,
  apply_licence, licence_types, licence_fee,
  school_id
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
`;

    const values = [
      data.branch,
      data.training_days,
      data.car_name || null,
      data.customer_name || null,
      data.address || null,
      data.pincode || null,
      data.mobile_no || null,
      data.whatsapp_no || null,
      data.sex || null,
      toMySQLDate(data.birth_date),
      data.cov_lmv ? 1 : 0,
      data.cov_mc ? 1 : 0,
      data.dl_no || null,
      data.dl_from || null,
      data.dl_to || null,
      data.email || null,
      data.occupation || null,
      data.ref || null,
      slotTimes.allotted_time,
      slotTimes.allotted_time2,
      slotTimes.allotted_time3,
      slotTimes.allotted_time4,
      toMySQLDate(data.starting_from),
      data.total_fees || 0,
      data.advance || 0,
      data.instructor_name || null,
      0, // present_days
      data.hold_status ? 1 : 0,
      attendanceStatus,
      null, // hold_from
      null, // resume_from
      0, // extended_days
      data.duration_minutes || 30,
      data.certificate_url || null,
      data.ac_facility ? 1 : 0,
      data.pickup_drop ? 1 : 0,
      data.has_licence === "Yes" ? "Yes" : "No",
      data.apply_licence === "Yes" ? "Yes" : "No",
      data.licence_types || null,
      Number(data.licence_fee) || 0,
      req.schoolId || 1
    ];

    const [result] = await dbPool.query(sql, values);

    res.json({ success: true, booking_id: result.insertId, attendance_status: attendanceStatus });

  } catch (err) {
    console.error('BOOKING CREATE ERROR:', err);
    next(err);
  }
});

// Public endpoint for checking time slot availability during registration
app.get('/api/bookings/availability', async (req, res, next) => {
  try {
    const excludeId = req.query.exclude_id ? Number(req.query.exclude_id) : null;
    const sql = `
      SELECT
        branch, car_name, starting_from,
        allotted_time, allotted_time2, allotted_time3, allotted_time4,
        attendance_status
      FROM bookings
      WHERE attendance_status IN ('Active', 'Pending')
      AND school_id = 1
      ${excludeId ? 'AND id != ?' : ''}
    `;
    const params = excludeId ? [excludeId] : [];
    const [rows] = await dbPool.query(sql, params);
    res.json({ success: true, bookings: rows });
  } catch (err) {
    console.error('BOOKINGS AVAILABILITY ERROR:', err);
    next(err);
  }
});

app.get('/api/bookings', requireAdmin, async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page) : null;
    const limit = Math.min(parseInt(req.query.limit) || 50, 2000);
    const search = (req.query.search || '').trim();
    const branch = (req.query.branch || '').trim();
    const status = (req.query.status || '').trim();
    const instructor = (req.query.instructor || '').trim();

    const conditions = ['school_id = ?'];
    const params = [req.schoolId];

    if (search) {
      conditions.push('(customer_name LIKE ? OR mobile_no LIKE ? OR whatsapp_no LIKE ? OR branch LIKE ? OR car_name LIKE ? OR instructor_name LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s);
    }
    if (branch) { conditions.push('branch = ?'); params.push(branch); }
    if (status) { conditions.push('attendance_status = ?'); params.push(status); }
    if (instructor) { conditions.push('instructor_name = ?'); params.push(instructor); }

    const where = 'WHERE ' + conditions.join(' AND ');
    const selectCols = `
      id, branch, training_days, customer_name, address, pincode, mobile_no, whatsapp_no,
      sex, birth_date, cov_lmv, cov_mc, dl_no, dl_from, dl_to, email,
      occupation, ref, allotted_time, allotted_time2, allotted_time3, allotted_time4, duration_minutes, starting_from, total_fees, advance,
      car_name, instructor_name,
      ac_facility, pickup_drop, has_licence,
      present_days, hold_status, attendance_status, certificate_url,
      created_at`;

    if (page !== null) {
      const offset = (page - 1) * limit;
      const [[{ total }]] = await dbPool.query(`SELECT COUNT(*) as total FROM bookings ${where}`, params);
      const [rows] = await dbPool.query(`SELECT ${selectCols} FROM bookings ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
      res.json({ success: true, bookings: rows, total, page, limit });
    } else {
      const [rows] = await dbPool.query(`SELECT ${selectCols} FROM bookings ${where} ORDER BY id DESC`, params);
      res.json({ success: true, bookings: rows });
    }
  } catch (err) {
    console.error('BOOKINGS LIST ERROR:', err);
    next(err);
  }
});


app.get('/api/bookings/:id', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`SELECT * FROM bookings WHERE id = ? AND school_id = ?`, [req.params.id, req.schoolId]);
    if (!rows.length) return res.json({ success: false, error: 'Booking not found' });
    res.json({ success: true, booking: rows[0] });
  } catch (err) {
    console.error('GET BOOKING ERROR:', err);
    next(err);
  }
});

app.put('/api/bookings/:id', requireAdmin, async (req, res, next) => {
  const id = req.params.id;
  const data = req.body;
  const hasSelectedSlots = Array.isArray(data.selected_slots);
  const slotTimes = normalizeSlots(data.selected_slots || []);

  try {
    const [rows] = await dbPool.query(
      `SELECT * FROM bookings WHERE id = ? AND school_id = ? LIMIT 1`,
      [id, req.schoolId]
    );

    if (!rows.length) {
      return res.json({ success: false, error: 'Booking not found' });
    }

    const current = rows[0];
    const newHoldStatus = data.hold_status ? 1 : 0;
    let hold_from = current.hold_from;
    let extended_days = current.extended_days || 0;
    let resume_from = null;

    if (current.hold_status === 0 && newHoldStatus === 1) {
      hold_from = new Date();
    }

    if (current.hold_status === 1 && newHoldStatus === 0) {
      if (hold_from) {
        const today = new Date();
        const holdDays = Math.ceil(
          (today - new Date(hold_from)) / (1000 * 60 * 60 * 24)
        );
        extended_days += holdDays;
        resume_from = today;
        hold_from = null;
      }
    }

    const sql = `
      UPDATE bookings SET
        branch=?,
        training_days=?,
        customer_name=?,
        address=?,
        pincode=?,
        mobile_no=?,
        whatsapp_no=?,
        sex=?,
        birth_date=?,
        cov_lmv=?,
        cov_mc=?,
        dl_no=?,
        dl_from=?,
        dl_to=?,
        email=?,
        occupation=?,
        ref=?,
        allotted_time=?,
        allotted_time2=?,
        allotted_time3=?,
        allotted_time4=?,
        duration_minutes=?,
        starting_from=?,
        total_fees=?,
        advance=?,
        car_name=?,
        instructor_name=?,
        ac_facility=?,
        pickup_drop=?,
        has_licence=?,
        hold_status=?,
        hold_from=?,
        resume_from=?,
        extended_days=?,
        apply_licence=?,
        licence_types=?,
        licence_fee=?
      WHERE id=? AND school_id=?
    `;

    const values = [
      data.branch ?? current.branch,
      data.training_days ?? current.training_days,
      data.customer_name ?? current.customer_name,
      data.address ?? current.address,
      data.pincode ?? current.pincode,
      data.mobile_no ?? current.mobile_no,
      data.whatsapp_no ?? current.whatsapp_no,
      data.sex ?? current.sex,
      toMySQLDate(data.birth_date) ?? current.birth_date,
      data.cov_lmv ?? current.cov_lmv,
      data.cov_mc ?? current.cov_mc,
      data.dl_no ?? current.dl_no,
      toMySQLDate(data.dl_from) ?? current.dl_from,
      toMySQLDate(data.dl_to) ?? current.dl_to,
      data.email ?? current.email,
      data.occupation ?? current.occupation,
      data.ref ?? current.ref,
      hasSelectedSlots ? slotTimes.allotted_time  : current.allotted_time,
      hasSelectedSlots ? slotTimes.allotted_time2 : current.allotted_time2,
      hasSelectedSlots ? slotTimes.allotted_time3 : current.allotted_time3,
      hasSelectedSlots ? slotTimes.allotted_time4 : current.allotted_time4,
      data.duration_minutes ?? current.duration_minutes,
      toMySQLDate(data.starting_from) ?? current.starting_from,
      data.total_fees ?? current.total_fees,
      data.advance ?? current.advance,
      data.car_name ?? current.car_name,
      data.instructor_name ?? current.instructor_name,
      data.ac_facility ?? current.ac_facility,
      data.pickup_drop ?? current.pickup_drop,
      data.has_licence
        ? (data.has_licence === "Yes" ? "Yes" : "No")
        : current.has_licence,
      newHoldStatus,
      hold_from ? toMySQLDate(hold_from) : null,
      resume_from ? toMySQLDate(resume_from) : null,
      extended_days,
      data.apply_licence
        ? (data.apply_licence === "Yes" ? "Yes" : "No")
        : current.apply_licence,
      data.licence_types ?? current.licence_types,
      Number(data.licence_fee ?? current.licence_fee),
      id,
      req.schoolId
    ];

    await dbPool.query(sql, values);

    await recomputeAndStoreAttendanceStatus(id);

    res.json({ success: true, message: 'Booking updated successfully' });

  } catch (err) {
    console.error('BOOKING UPDATE ERROR:', err);
    next(err);
  }
});

app.delete('/api/bookings/:id', requireAdmin, async (req, res, next) => {
  try {
    await dbPool.query('DELETE FROM bookings WHERE id=? AND school_id=?', [req.params.id, req.schoolId]);
    res.json({ success: true });
  } catch (err) {
    console.error('BOOKING DELETE ERROR:', err);
    next(err);
  }
});

// =====================
// UPLOAD CERTIFICATE
// =====================
app.post("/api/bookings/:id/certificate", requireAdmin, upload.single("file"), async (req, res) => {
    try {
        const bookingId = req.params.id;
        if (!req.file) return res.json({ success: false, error: "No file uploaded" });

        const [rows] = await dbPool.query('SELECT certificate_url FROM bookings WHERE id = ? AND school_id = ?', [bookingId, req.schoolId]);
        if (!rows.length) return res.status(404).json({ success: false, error: "Booking not found" });
        const oldKey = rows[0]?.certificate_url;

        // Delete old file if exists
        if (oldKey) {
            await s3.deleteObject({
                Bucket: process.env.S3_BUCKET,
                Key: oldKey
            }).promise();
        }

        // Upload new file
        const ext = req.file.originalname.split(".").pop();
        const s3Key = `certificates/${process.env.ENV}/${bookingId}_${Date.now()}.${ext}`;
        await s3.upload({
            Bucket: process.env.S3_BUCKET,
            Key: s3Key,
            Body: req.file.buffer,
            ContentType: req.file.mimetype
        }).promise();

        // Update DB
        await dbPool.query("UPDATE bookings SET certificate_url = ? WHERE id = ? AND school_id = ?", [s3Key, bookingId, req.schoolId]);

        res.json({ success: true, message: "Certificate uploaded successfully" });
    } catch (err) {
        console.error("Certificate Upload Error:", err);
        res.json({ success: false, error: "Upload failed" });
    }
});

// =====================
// DOWNLOAD CERTIFICATE 
// =====================
app.get("/api/bookings/:id/certificate/download", requireAdmin, async (req, res) => {
    try {
        const bookingId = req.params.id;

        const [rows] = await dbPool.query('SELECT certificate_url FROM bookings WHERE id = ? AND school_id = ?', [bookingId, req.schoolId]);
        if (!rows.length || !rows[0].certificate_url)
            return res.status(404).json({ success: false, error: 'Certificate not found' });

        const key = rows[0].certificate_url; 

        const presignedUrl = s3.getSignedUrl('getObject', {
            Bucket: process.env.S3_BUCKET,
            Key: key,
            Expires: 60 
        });

        res.json({ success: true, url: presignedUrl });
    } catch (err) {
        console.error('Certificate download error:', err);
        res.status(500).json({ success: false, error: 'Failed to generate download link' });
    }
});

// ---------- EXPENSE CATEGORIES MIGRATION ----------
(async () => {
  try {
    const [cols] = await dbPool.query(
      `SELECT COUNT(*) AS cnt FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'expense_categories' AND COLUMN_NAME = 'extra_field'`
    );
    if (cols[0].cnt === 0) {
      await dbPool.query(`ALTER TABLE expense_categories ADD COLUMN extra_field VARCHAR(20) DEFAULT NULL`);
    }
    // Migrate any old global defaults (school_id=0) to school-owned so they are editable
    await dbPool.query(`UPDATE expense_categories SET school_id = 1, is_custom = 1 WHERE school_id = 0`);
    // Ensure extra_field is set for any rows missing it
    await dbPool.query(`UPDATE expense_categories SET extra_field = 'car' WHERE is_car_related = 1 AND (extra_field IS NULL OR extra_field = '')`);
    console.log('[Migration] expense_categories ready.');
  } catch (err) {
    console.error('expense_categories migration error:', err);
  }
})();

// ---------- ATTENDANCE TABLE ----------
(async () => {
  try {
    await dbPool.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        date DATE NOT NULL,
        present TINYINT(1) DEFAULT 0,
        UNIQUE KEY unique_record (booking_id, date),
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      )
    `);
  } catch (err) {
    console.error('CREATE attendance TABLE ERROR:', err);
  }
})();

// Migration: add present column to schedule_slots
(async () => {
  try {
    await dbPool.query(`ALTER TABLE schedule_slots ADD COLUMN present TINYINT(1) DEFAULT 1`);
    console.log('[Migration] schedule_slots.present column added.');
  } catch (e) { if (e.errno !== 1060) console.error('[Migration] schedule_slots.present:', e.message); }
})();

// Migration: add time column to attendance + update unique key to (booking_id, date, time)
// Existing rows keep time='' so old display behavior is preserved via frontend fallback
(async () => {
  try {
    try { await dbPool.query(`ALTER TABLE attendance ADD COLUMN time VARCHAR(10) NOT NULL DEFAULT '' AFTER date`); }
    catch (e) { if (e.errno !== 1060) throw e; }
    // Add new key under a temp name first so FK has an index to hold on to during drops
    try { await dbPool.query(`ALTER TABLE attendance ADD UNIQUE KEY uq_att_slot (booking_id, date, time)`); }
    catch (e) { if (e.errno !== 1061) throw e; }
    // Now safe to drop old keys
    try { await dbPool.query(`ALTER TABLE attendance DROP INDEX unique_attendance`); } catch (_) {}
    try { await dbPool.query(`ALTER TABLE attendance DROP INDEX unique_record`); } catch (_) {}
    // Add canonical key name
    try { await dbPool.query(`ALTER TABLE attendance ADD UNIQUE KEY unique_record (booking_id, date, time)`); }
    catch (e) { if (e.errno !== 1061) throw e; }
    // Drop temp key
    try { await dbPool.query(`ALTER TABLE attendance DROP INDEX uq_att_slot`); } catch (_) {}
    console.log('[Migration] attendance per-slot tracking ready.');
  } catch (err) {
    console.error('[Migration] attendance per-slot:', err.message);
  }
})();

app.get('/api/attendance-all', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT a.booking_id, DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.time, a.present
      FROM attendance a
      JOIN bookings b ON a.booking_id = b.id
      WHERE b.school_id = ?
      ORDER BY a.booking_id ASC, a.date ASC
    `, [req.schoolId]);

    res.json({ success: true, records: rows });
  } catch (err) {
    console.error('ATTENDANCE-ALL ERROR:', err);
    next(err);
  }
});

app.get('/api/attendance/:booking_id', requireAdmin, async (req, res, next) => {
  const booking_id = req.params.booking_id;
  try {
    const [[booking]] = await dbPool.query(`SELECT id FROM bookings WHERE id = ? AND school_id = ?`, [booking_id, req.schoolId]);
    if (!booking) return res.status(404).json({ success: false, error: 'Booking not found' });

    const [rows] = await dbPool.query(
      `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date, time, present,
              DATE_FORMAT(marked_at, '%Y-%m-%d %H:%i') AS marked_at,
              'regular' AS source
       FROM attendance WHERE booking_id=?
       UNION ALL
       SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date, time, present,
              NULL AS marked_at,
              'ad_hoc' AS source
       FROM schedule_slots WHERE booking_id=?
       ORDER BY date DESC, time ASC`,
      [booking_id, booking_id]
    );
    res.json({ success: true, records: rows });
  } catch (err) {
    console.error('ATTENDANCE GET ERROR:', err);
    next(err);
  }
});

// Returns attendance for all bookings on a specific date (for the Schedule tab)
app.get('/api/attendance-by-date', requireAdmin, async (req, res, next) => {
  try {
    const { date, branch } = req.query;
    if (!date) return res.status(400).json({ success: false, error: 'date required' });

    let sql = `
      SELECT a.booking_id, DATE_FORMAT(a.date, '%Y-%m-%d') AS date, a.time, a.present
      FROM attendance a
      JOIN bookings b ON a.booking_id = b.id
      WHERE b.school_id = ? AND DATE(a.date) = ?
    `;
    const params = [req.schoolId, date];
    if (branch) {
      sql += ' AND TRIM(LOWER(b.branch)) = ?';
      params.push(branch.toLowerCase());
    }
    sql += ' ORDER BY a.booking_id, a.time';

    const [rows] = await dbPool.query(sql, params);
    res.json({ success: true, records: rows });
  } catch (err) {
    console.error('ATTENDANCE-BY-DATE ERROR:', err);
    next(err);
  }
});

app.post('/api/attendance/:booking_id', requireAdmin, async (req, res, next) => {
    const booking_id = req.params.booking_id;
    const { date, time, value } = req.body;

    if (!date || typeof value !== 'number' || isNaN(value)) {
        return res.status(400).json({ success: false, error: 'Date and value required' });
    }

    const [[bk]] = await dbPool.query(`SELECT id FROM bookings WHERE id = ? AND school_id = ?`, [booking_id, req.schoolId]);
    if (!bk) return res.status(404).json({ success: false, error: 'Booking not found' });

    const mysqlDate = date.split("T")[0];
    const slotTime = (time || '').substring(0, 5);

    async function attemptUpdate() {
        let conn;
        try {
            conn = await dbPool.getConnection();
            await conn.beginTransaction();

            const storedValue = value >= 1 ? 1 : 0;
            await conn.query(
                `INSERT INTO attendance (booking_id, date, time, present, marked_at) VALUES (?, ?, ?, ?, NOW())
                 ON DUPLICATE KEY UPDATE present = ?, marked_at = NOW()`,
                [booking_id, mysqlDate, slotTime, storedValue, storedValue]
            );

            const [presentSumRows] = await conn.query(
                `SELECT COUNT(*) AS total_present
                 FROM attendance
                 WHERE booking_id = ? AND present = 1`,
                [booking_id]
            );
            const totalPresent = Math.max(0, Number(presentSumRows[0].total_present));

            await conn.query(
                `UPDATE bookings SET present_days = ? WHERE id = ?`,
                [totalPresent, booking_id]
            );

            const [bookingRows] = await conn.query(
                `SELECT present_days, training_days, hold_status, starting_from, extended_days FROM bookings WHERE id = ?`,
                [booking_id]
            );
            if (!bookingRows.length) throw new Error(`Booking ${booking_id} not found`);

            const newStatus = computeAttendanceStatus(bookingRows[0]);

            await conn.query(
                `UPDATE bookings SET attendance_status = ? WHERE id = ?`,
                [newStatus, booking_id]
            );

            await conn.commit();
            return { totalPresent, newStatus };
        } catch (err) {
            if (conn) await conn.rollback().catch(() => {});
            throw err;
        } finally {
            if (conn) conn.release();
        }
    }

    // Retry up to 3 times on deadlock (ER_LOCK_DEADLOCK = 1213)
    for (let attempt = 1; attempt <= 3; attempt++) {
        try {
            const { totalPresent, newStatus } = await attemptUpdate();
            return res.json({ success: true, present_days: totalPresent, attendance_status: newStatus });
        } catch (err) {
            if (err.errno === 1213 && attempt < 3) {
                await new Promise(r => setTimeout(r, 50 * attempt));
                continue;
            }
            console.error('ATTENDANCE UPDATE ERROR:', err.message);
            return next(err);
        }
    }
});





// ---------- DELETE ATTENDANCE RECORD ----------
app.delete('/api/attendance/:booking_id/:attendance_id', requireAdmin, async (req, res, next) => {
    const { booking_id, attendance_id } = req.params;
    let conn;
    try {
        conn = await dbPool.getConnection();
        await conn.beginTransaction();

        const [bkRows] = await conn.query(`SELECT id FROM bookings WHERE id = ? AND school_id = ?`, [booking_id, req.schoolId]);
        if (!bkRows.length) { await conn.rollback(); return res.status(404).json({ success: false, error: 'Booking not found' }); }

        const [rows] = await conn.query(
            `SELECT id FROM attendance WHERE id = ? AND booking_id = ?`,
            [attendance_id, booking_id]
        );
        if (!rows.length) {
            await conn.rollback();
            return res.status(404).json({ success: false, error: 'Record not found' });
        }

        await conn.query(`DELETE FROM attendance WHERE id = ?`, [attendance_id]);

        const [presentSumRows] = await conn.query(
            `SELECT COUNT(*) AS total_present FROM attendance WHERE booking_id = ? AND present = 1`,
            [booking_id]
        );
        const totalPresent = Number(presentSumRows[0].total_present);

        await conn.query(`UPDATE bookings SET present_days = ? WHERE id = ?`, [totalPresent, booking_id]);

        const [bookingRows] = await conn.query(
            `SELECT present_days, training_days, hold_status, starting_from, extended_days FROM bookings WHERE id = ?`,
            [booking_id]
        );
        const newStatus = computeAttendanceStatus(bookingRows[0]);
        await conn.query(`UPDATE bookings SET attendance_status = ? WHERE id = ?`, [newStatus, booking_id]);

        await conn.commit();
        res.json({ success: true, present_days: totalPresent, attendance_status: newStatus });
    } catch (err) {
        if (conn) await conn.rollback().catch(() => {});
        next(err);
    } finally {
        if (conn) conn.release();
    }
});

// ---------- SCHEDULE AD-HOC SLOTS ----------
app.get('/api/schedule-slots', requireAdmin, async (req, res, next) => {
  const { branch, date } = req.query;
  if (!branch || !date) return res.json({ success: false, error: 'branch and date required' });
  try {
    const [rows] = await dbPool.query(`
      SELECT ss.id, ss.booking_id, ss.time, ss.car_name, ss.instructor_name, ss.present,
             b.customer_name, b.present_days, b.training_days, b.mobile_no
      FROM schedule_slots ss
      JOIN bookings b ON ss.booking_id = b.id
      WHERE ss.date = ? AND b.branch = ? AND b.school_id = ?
      ORDER BY ss.time ASC
    `, [date, branch, req.schoolId]);
    res.json({ success: true, slots: rows });
  } catch (err) {
    console.error('GET SCHEDULE SLOTS ERROR:', err);
    next(err);
  }
});

app.post('/api/schedule-slots', requireAdmin, async (req, res, next) => {
  const { booking_id, date, time, car_name, instructor_name } = req.body;
  if (!booking_id || !date || !time || !car_name) {
    return res.status(400).json({ success: false, error: 'booking_id, date, time, car_name required' });
  }
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    const [[bk]] = await conn.query(`SELECT id FROM bookings WHERE id = ? AND school_id = ?`, [booking_id, req.schoolId]);
    if (!bk) { await conn.rollback(); conn.release(); return res.status(404).json({ success: false, error: 'Booking not found' }); }

    const [result] = await conn.query(
      `INSERT INTO schedule_slots (booking_id, date, time, car_name, instructor_name, present, school_id) VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [booking_id, date, time, car_name || null, instructor_name || null, req.schoolId]
    );

    // Recalculate present_days (new slot has present=0, not counted until marked)
    const [[attSum]] = await conn.query(
      `SELECT COUNT(*) AS total FROM attendance WHERE booking_id = ? AND present = 1`, [booking_id]
    );
    const [[adhocSum]] = await conn.query(
      `SELECT COUNT(*) AS total FROM schedule_slots WHERE booking_id = ? AND present = 1`, [booking_id]
    );
    await conn.query(
      `UPDATE bookings SET present_days = ? WHERE id = ?`,
      [Number(attSum.total) + Number(adhocSum.total), booking_id]
    );

    await conn.commit();
    res.json({ success: true, slot_id: result.insertId });
  } catch (err) {
    await conn.rollback();
    console.error('POST SCHEDULE SLOT ERROR:', err);
    next(err);
  } finally {
    conn.release();
  }
});

app.delete('/api/schedule-slots/:id', requireAdmin, async (req, res, next) => {
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    const [[slot]] = await conn.query(`SELECT ss.* FROM schedule_slots ss JOIN bookings b ON ss.booking_id = b.id WHERE ss.id = ? AND b.school_id = ?`, [req.params.id, req.schoolId]);
    if (!slot) {
      await conn.rollback();
      return res.json({ success: false, error: 'Slot not found' });
    }

    await conn.query(`DELETE FROM schedule_slots WHERE id = ?`, [req.params.id]);

    // Recalculate present_days after removing this ad-hoc slot
    const [[attSum]] = await conn.query(
      `SELECT COUNT(*) AS total FROM attendance WHERE booking_id = ? AND present = 1`, [slot.booking_id]
    );
    const [[adhocSum]] = await conn.query(
      `SELECT COUNT(*) AS total FROM schedule_slots WHERE booking_id = ? AND present = 1 AND id != ?`,
      [slot.booking_id, req.params.id]
    );
    await conn.query(
      `UPDATE bookings SET present_days = ? WHERE id = ?`,
      [Number(attSum.total) + Number(adhocSum.total), slot.booking_id]
    );

    await conn.commit();
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('DELETE SCHEDULE SLOT ERROR:', err);
    next(err);
  } finally {
    conn.release();
  }
});

app.patch('/api/schedule-slots/:id/present', requireAdmin, async (req, res, next) => {
  const { present } = req.body; // 1 or 0
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();
    const [[slot]] = await conn.query(`SELECT ss.* FROM schedule_slots ss JOIN bookings b ON ss.booking_id = b.id WHERE ss.id = ? AND b.school_id = ?`, [req.params.id, req.schoolId]);
    if (!slot) { await conn.rollback(); return res.json({ success: false, error: 'Slot not found' }); }

    await conn.query(`UPDATE schedule_slots SET present = ? WHERE id = ?`, [present ? 1 : 0, req.params.id]);

    // Recalculate present_days = regular attendance + ad-hoc present slots
    const [[attSum]] = await conn.query(
      `SELECT COUNT(*) AS total FROM attendance WHERE booking_id = ? AND present = 1`,
      [slot.booking_id]
    );
    const [[adhocSum]] = await conn.query(
      `SELECT COUNT(*) AS total FROM schedule_slots WHERE booking_id = ? AND present = 1`,
      [slot.booking_id]
    );
    const totalPresent = Number(attSum.total) + Number(adhocSum.total);
    await conn.query(`UPDATE bookings SET present_days = ? WHERE id = ?`, [totalPresent, slot.booking_id]);

    await conn.commit();
    res.json({ success: true, present_days: totalPresent });
  } catch (err) {
    await conn.rollback();
    console.error('PATCH SCHEDULE SLOT PRESENT ERROR:', err);
    next(err);
  } finally {
    conn.release();
  }
});

// ---------- BRANCHES CRUD ----------
app.get('/api/branches', async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT id, branch_name, address, city, state, postal_code, mobile_no, email, created_at
      FROM branches WHERE school_id = 1 ORDER BY id DESC
    `);
    res.json({ success: true, branches: rows });
  } catch (err) {
    console.error('BRANCHES LIST ERROR:', err);
    next(err);
  }
});

app.post('/api/branches', requireAdmin, async (req, res, next) => {
  const data = req.body;
  if (!data.branch_name) return res.json({ success: false, error: 'Branch name is required' });

  try {
    const sql = `
      INSERT INTO branches (branch_name, address, city, state, postal_code, mobile_no, email, school_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [data.branch_name, data.address || '', data.city || '', data.state || '',
      data.postal_code || '', data.mobile_no || '', data.email || '', req.schoolId];
    const [result] = await dbPool.query(sql, values);
    res.json({ success: true, branch_id: result.insertId });
  } catch (err) {
    console.error('BRANCH CREATE ERROR:', err);
    next(err);
  }
});

app.put('/api/branches/:id', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const data = req.body;
  if (!data.branch_name) return res.json({ success: false, error: 'Branch name is required' });

  try {
    const sql = `
      UPDATE branches SET branch_name=?, address=?, city=?, state=?, postal_code=?, mobile_no=?, email=?
      WHERE id=? AND school_id=?
    `;
    const values = [data.branch_name, data.address || '', data.city || '', data.state || '',
      data.postal_code || '', data.mobile_no || '', data.email || '', id, req.schoolId];
    await dbPool.query(sql, values);
    res.json({ success: true });
  } catch (err) {
    console.error('BRANCH UPDATE ERROR:', err);
    next(err);
  }
});

app.delete('/api/branches/:id', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    await dbPool.query('DELETE FROM branches WHERE id=? AND school_id=?', [id, req.schoolId]);
    res.json({ success: true });
  } catch (err) {
    console.error('BRANCH DELETE ERROR:', err);
    next(err);
  }
});

// ---------- GLOBAL ERROR HANDLER ----------
app.use((err, req, res, next) => {
  console.error('EXPRESS ERROR:', err && (err.stack || err));
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ---------- PROCESS-LEVEL HANDLERS ----------
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err && (err.stack || err));
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// ---------- CRON JOB ----------
cron.schedule('1 0 * * *', async () => {
  console.log(`[CRON] Running daily booking status update at ${new Date().toISOString()}`);
  try {
    await updateBookingsStatus();
    console.log('[CRON] Booking status update completed.');
  } catch (err) {
    console.error('[CRON] Error updating bookings:', err);
  }
}, {
  timezone: "Asia/Kolkata"
});

// =====================
// PUBLIC: LIST CERTIFICATE IMAGES WITH BOOKING INFO
// =====================
app.get("/api/public/certificates", async (req, res) => {
  try {
    const prefix = "certificates/production/";

    const params = {
      Bucket: process.env.S3_BUCKET,
      Prefix: prefix
    };

    const data = await s3.listObjectsV2(params).promise();

    const images = [];

    for (const obj of data.Contents || []) {
      if (!/\.(jpg|jpeg|png|webp)$/i.test(obj.Key)) continue;

      // Extract booking id from filename: "100_1765062519993.png"
      const match = obj.Key.match(/certificates\/production\/(\d+)_\d+\.(jpg|jpeg|png|webp)$/i);
      if (!match) continue;
      const bookingId = match[1];

      // Fetch booking details
      const [rows] = await dbPool.query(
        `SELECT customer_name, car_name, starting_from FROM bookings WHERE id = ? AND school_id = 1 LIMIT 1`,
        [bookingId]
      );

      if (!rows.length) continue;
      const booking = rows[0];

      images.push({
        bookingId,
        studentName: booking.customer_name,
        course: booking.car_name,
        date: booking.starting_from ? (() => { const d = new Date(booking.starting_from); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })() : null,
        url: `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${obj.Key}`
      });
    }

    // Reverse to show newest first
    images.reverse();

    res.json({ success: true, images });

  } catch (err) {
    console.error("Public certificate fetch error:", err);
    res.status(500).json({ success: false, error: "Failed to load certificates" });
  }
});

app.get("/api/questions", (req, res) => {
    const lang = (req.query.lang || "en").toLowerCase();

    const fileMap = {
        en: "questions_en.json",
        gu: "questions_gu.json"
    };

    // Ensure fallback is questions_en.json
    const fileName = fileMap[lang] || "questions_en.json";

    const filePath = path.join(process.cwd(), "data", fileName);
    console.log("Loading questions from:", filePath);

    fs.readFile(filePath, "utf8", (err, data) => {
        if (err) {
            console.error("Question load error:", err);
            return res.status(500).json([]);
        }
        res.json(JSON.parse(data));
    });
});


app.get('/', (req, res) => {
    res.render('index', { googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY });
});

app.use("/api/dashboard", dashboardRoutes);
app.use('/api/training-days', trainingDaysRoute);
app.use('/api/instructors', instructorsRoute);
app.use('/api/cars', carsRoute);
app.use("/api/courses", preferredCoursesRoutes);
app.use("/api/enquiries", enquiriesRoutes);
app.use("/api/enquiries", otpRoutes);
app.use("/api/exam/users", examUsersRoutes);
app.use("/api/exam", examRoutes);
app.use("/api/cms", cmsRoutes);
app.use('/api/packages', packagesRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/reviews', reviewsRoute);

// ---------- START SERVER ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});


export function requireAdmin(req, res, next) {
  if (req.session && req.session.adminLoggedIn) {
    req.schoolId = req.session.school_id || 1;
    return next();
  }
  return res.status(401).json({ success: false, error: 'Unauthorized access' });
}

export function requireExamUser(req, res, next) {
  if (req.session && req.session.examUser) return next();
  return res.status(401).json({ success: false, error: 'Not logged in' });
}