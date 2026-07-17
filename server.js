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
import helmet from 'helmet';
import morgan from 'morgan';
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
import emailRoutes from './routes/emailRoutes.js';

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

// ---------- Startup env validation ----------
const REQUIRED_ENV = ['SESSION_SECRET', 'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
const missingEnv = REQUIRED_ENV.filter(k => !process.env[k]);
if (missingEnv.length) {
  console.error(`FATAL: Missing required environment variables: ${missingEnv.join(', ')}`);
  process.exit(1);
}

// ---------- Create a mysql pool ----------
export const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
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
    console.log('[DB] MySQL pool connected.');
  } catch (err) {
    console.error('[DB] Connection error:', err.message);
    process.exit(1);
  }
})();

// ---------- Session ----------
const MySQLStore = MySQLStoreImport(session);
const sessionStore = new MySQLStore({}, dbPool);

// ---------- Security headers ----------
app.use(helmet({
  contentSecurityPolicy: false, // Managed separately for admin panel
  crossOriginEmbedderPolicy: false,
}));

// ---------- CORS ----------
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [];

app.use(cors({
  origin: (origin, cb) => {
    // Allow same-origin requests (no Origin header) and configured origins
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ---------- HTTP request logging ----------
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

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

app.use(bodyParser.json({ limit: '2mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '2mb' }));
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

app.use(
  session({
    key: 'session_cookie',
    secret: process.env.SESSION_SECRET,
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


async function checkSlotConflicts(schoolId, branch, car, startingFrom, slots, excludeId = null) {
  if (!branch || !car || !startingFrom) return null;
  const newSlots = slots.filter(Boolean).map(t => t.substring(0, 5));
  if (newSlots.length === 0) return null;

  const myStart = new Date(startingFrom);
  const myEnd   = new Date(myStart);
  myEnd.setDate(myStart.getDate() + 30);

  const params = [schoolId, branch, car];
  const excludeClause = excludeId ? 'AND id != ?' : '';
  if (excludeId) params.push(excludeId);

  const [bookings] = await dbPool.query(`
    SELECT customer_name, starting_from, training_days, present_days,
           allotted_time, allotted_time2, allotted_time3, allotted_time4
    FROM bookings
    WHERE school_id = ? AND branch = ? AND car_name = ?
      AND attendance_status IN ('Active', 'Pending')
      ${excludeClause}
  `, params);

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  for (const b of bookings) {
    if (!b.starting_from) continue;

    // Session-based buffer — mirrors the Schedule tab's own logic
    // (public/js/Schedule/renderScheduleModule.js) so a booking that's
    // actually finished never blocks a new registration, regardless of
    // whether attendance_status has been refreshed yet.
    const totalSessions = Number(b.training_days) || 15;
    const doneSessions  = Number(b.present_days) || 0;
    const remaining     = totalSessions - doneSessions;
    if (remaining <= 0) continue;

    const bStart = new Date(b.starting_from);
    const bEnd   = new Date(bStart);
    if (remaining < totalSessions / 2) {
      bEnd.setTime(today.getTime());
      bEnd.setDate(bEnd.getDate() + remaining + 3);
    } else {
      bEnd.setDate(bStart.getDate() + 29);
    }
    if (bStart > myEnd || bEnd < myStart) continue;

    const bSlots = [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4]
      .filter(Boolean).map(t => t.substring(0, 5));

    const conflict = newSlots.find(s => bSlots.includes(s));
    if (conflict) {
      const [hh, mm] = conflict.split(':').map(Number);
      const ampm = hh >= 12 ? 'PM' : 'AM';
      const h12 = hh % 12 || 12;
      return `${h12}:${mm.toString().padStart(2,'0')} ${ampm} is already booked by ${b.customer_name}`;
    }
  }
  return null;
}

// ---------- AUTH ----------
app.post('/api/login', loginLimiter, async (req, res, next) => {
  const { username, password } = req.body;
  try {
    // ── Path 1: full admin account (admins table, bcrypt password) ──
    const [adminRows] = await dbPool.query('SELECT * FROM admins WHERE username = ? AND is_active = 1 LIMIT 1', [username]);
    if (adminRows && adminRows.length > 0) {
      const admin = adminRows[0];
      const match = await bcrypt.compare(password, admin.password);
      if (!match) return res.json({ success: false, error: 'Invalid credentials' });

      req.session.adminLoggedIn = true;
      req.session.adminId       = admin.id;
      req.session.adminRole     = 'admin';
      req.session.school_id     = admin.school_id || 1;
      await new Promise((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve(undefined))),
      );
      const secret = process.env.SESSION_SECRET || 'supersecretkey';
      const signed = 's:' + cookieSign(req.session.id, secret);
      return res.json({ success: true, sessionToken: `session_cookie=${encodeURIComponent(signed)}`, role: 'admin' });
    }

    // ── Path 2: Manager (instructors table, mobile_no as password) ──
    const [mgrRows] = await dbPool.query(
      "SELECT * FROM instructors WHERE UPPER(employee_no) = UPPER(?) AND LOWER(role) = 'manager' AND is_active = 1 LIMIT 1",
      [username.trim()]
    );
    if (mgrRows && mgrRows.length > 0) {
      const mgr = mgrRows[0];
      const mobileClean = (mgr.mobile_no || '').replace(/\D/g, '');
      const passClean   = (password  || '').replace(/\D/g, '');
      if (passClean !== mobileClean) return res.json({ success: false, error: 'Invalid credentials' });

      req.session.adminLoggedIn = true;
      req.session.adminId       = mgr.id;
      req.session.adminRole     = 'manager';
      req.session.school_id     = mgr.school_id || 1;
      await new Promise((resolve, reject) =>
        req.session.save((err) => (err ? reject(err) : resolve(undefined))),
      );
      const secret = process.env.SESSION_SECRET || 'supersecretkey';
      const signed = 's:' + cookieSign(req.session.id, secret);
      return res.json({ success: true, sessionToken: `session_cookie=${encodeURIComponent(signed)}`, role: 'manager', name: mgr.instructor_name, branch: mgr.branch });
    }

    return res.json({ success: false, error: 'Invalid credentials' });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    next(err);
  }
});

app.post('/api/driver-login', loginLimiter, async (req, res, next) => {
  const { employee_no, password } = req.body;
  try {
    if (!employee_no || !password) return res.json({ success: false, error: 'Employee number and password required' });
    const [rows] = await dbPool.query(
      "SELECT * FROM instructors WHERE UPPER(employee_no) = UPPER(?) AND is_active = 1 AND LOWER(role) = 'instructor' LIMIT 1",
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
    const signed = 's:' + cookieSign(req.session.id, process.env.SESSION_SECRET);
    const sessionToken = `session_cookie=${encodeURIComponent(signed)}`;
    res.json({
      success: true,
      sessionToken,
      instructor: {
        id:              instructor.id,
        name:            instructor.instructor_name,
        branch:          instructor.branch,
        employee_no:     instructor.employee_no,
        mobile_no:       instructor.mobile_no,
        email:           instructor.email,
        drivers_license: instructor.drivers_license,
        address:         instructor.address,
      },
    });
  } catch (err) {
    console.error('DRIVER LOGIN ERROR:', err);
    next(err);
  }
});

// ── Driver Profile ─────────────────────────────────────────────────────────────

app.get('/api/driver/profile', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  try {
    const [rows] = await dbPool.query(
      'SELECT id, employee_no, instructor_name, role, email, mobile_no, branch, drivers_license, adhar_no, address FROM instructors WHERE id = ? LIMIT 1',
      [instructorId]
    );
    if (!rows || rows.length === 0) return res.json({ success: false, error: 'Instructor not found' });
    res.json({ success: true, instructor: rows[0] });
  } catch (err) { next(err); }
});

app.patch('/api/driver/profile', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  const { email, mobile_no, address } = req.body;
  const updates = [];
  const params  = [];
  if (email     !== undefined) { updates.push('email = ?');     params.push(email.trim() || null); }
  if (mobile_no !== undefined) { updates.push('mobile_no = ?'); params.push(mobile_no.trim() || null); }
  if (address   !== undefined) { updates.push('address = ?');   params.push(address.trim() || null); }
  if (updates.length === 0) return res.json({ success: false, error: 'Nothing to update' });
  params.push(instructorId);
  try {
    await dbPool.query(`UPDATE instructors SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Admin Profile ──────────────────────────────────────────────────────────────

app.get('/api/admin/profile', requireAdmin, async (req, res, next) => {
  const adminId = req.session.adminId;
  try {
    const [[row]] = await dbPool.query(
      'SELECT id, username, full_name, email, mobile_no, role FROM admins WHERE id = ? LIMIT 1',
      [adminId]
    );
    if (!row) return res.json({ success: false, error: 'Admin not found' });
    res.json({ success: true, admin: row });
  } catch (err) { next(err); }
});

app.patch('/api/admin/profile', requireAdmin, async (req, res, next) => {
  const adminId = req.session.adminId;
  const { full_name, email, mobile_no } = req.body;
  const updates = [];
  const params  = [];
  if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name.trim() || null); }
  if (email     !== undefined) { updates.push('email = ?');     params.push(email.trim() || null); }
  if (mobile_no !== undefined) { updates.push('mobile_no = ?'); params.push(mobile_no.trim() || null); }
  if (updates.length === 0) return res.json({ success: false, error: 'Nothing to update' });
  params.push(adminId);
  try {
    await dbPool.query(`UPDATE admins SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Student (Exam User) Profile ────────────────────────────────────────────────

app.get('/api/student/profile', requireExamUser, async (req, res, next) => {
  const { id } = req.session.examUser;
  try {
    const [[row]] = await dbPool.query(
      `SELECT eu.id, eu.email,
              COALESCE(b.customer_name, eu.full_name) AS full_name,
              COALESCE(eu.mobile_no,    b.mobile_no)  AS mobile_no,
              eu.first_verified_at
       FROM exam_users eu
       LEFT JOIN (
         SELECT customer_name, mobile_no, email
         FROM bookings
         WHERE email = (SELECT email FROM exam_users WHERE id = ?)
         ORDER BY created_at DESC LIMIT 1
       ) b ON b.email = eu.email
       WHERE eu.id = ?
       LIMIT 1`,
      [id, id]
    );
    if (!row) return res.json({ success: false, error: 'Student not found' });
    res.json({ success: true, student: row });
  } catch (err) { next(err); }
});

app.patch('/api/student/profile', requireExamUser, async (req, res, next) => {
  const { id, email } = req.session.examUser;
  const { full_name, mobile_no } = req.body;
  const updates = [];
  const params  = [];
  if (full_name !== undefined) { updates.push('full_name = ?'); params.push(full_name.trim() || null); }
  if (mobile_no !== undefined) { updates.push('mobile_no = ?'); params.push(mobile_no.trim() || null); }
  if (updates.length === 0) return res.json({ success: false, error: 'Nothing to update' });
  try {
    await dbPool.query(`UPDATE exam_users SET ${updates.join(', ')} WHERE id = ? AND school_id = ?`, [...params, id, req.schoolId]);
    // Keep bookings in sync so changes appear on the website
    const bookingUpdates = [];
    const bookingParams  = [];
    if (full_name !== undefined) { bookingUpdates.push('customer_name = ?'); bookingParams.push(full_name.trim() || null); }
    if (mobile_no !== undefined) { bookingUpdates.push('mobile_no = ?');     bookingParams.push(mobile_no.trim() || null); }
    if (bookingUpdates.length) {
      await dbPool.query(
        `UPDATE bookings SET ${bookingUpdates.join(', ')} WHERE email = ? AND school_id = ?`,
        [...bookingParams, email, req.schoolId]
      );
    }
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Student Bookings (match by email OR customer_name) ────────────────────────
app.get('/api/student/bookings', requireExamUser, async (req, res, next) => {
  const { id: examUserId, email } = req.session.examUser;
  try {
    // Get student's stored name (set during dev login from booking record)
    const [[eu]] = await dbPool.query('SELECT full_name FROM exam_users WHERE id = ? LIMIT 1', [examUserId]);
    const name = eu?.full_name ?? null;

    const conditions = name
      ? '(b.email = ? OR b.customer_name = ?) AND b.school_id = ?'
      : 'b.email = ? AND b.school_id = ?';
    const params = name ? [email, name, req.schoolId] : [email, req.schoolId];

    const [rows] = await dbPool.query(
      `SELECT b.id, b.branch, b.training_days, b.customer_name, b.mobile_no, b.email,
              b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4,
              b.starting_from, b.total_fees, b.advance,
              b.car_name, b.instructor_name,
              b.attendance_status, b.certificate_url, b.created_at,
              COALESCE(att.present_days, 0) AS present_days
       FROM bookings b
       LEFT JOIN (SELECT booking_id, COUNT(*) AS present_days FROM attendance WHERE present = 1 GROUP BY booking_id) att
         ON att.booking_id = b.id
       WHERE ${conditions}
       ORDER BY b.created_at DESC`,
      params
    );
    const bookings = rows.map(b => ({
      ...b,
      selected_slots: [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4].filter(Boolean),
      certificate_url: b.certificate_url
        ? `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${b.certificate_url}`
        : null,
    }));
    res.json({ success: true, bookings });
  } catch (err) { next(err); }
});

// ── Student Sessions (individual attended classes) ─────────────────────────────
app.get('/api/student/sessions', requireExamUser, async (req, res, next) => {
  const { id: examUserId, email } = req.session.examUser;
  try {
    const [[eu]] = await dbPool.query('SELECT full_name FROM exam_users WHERE id = ? LIMIT 1', [examUserId]);
    const name = eu?.full_name ?? null;
    const conditions = name ? '(b.email = ? OR b.customer_name = ?) AND b.school_id = ?' : 'b.email = ? AND b.school_id = ?';
    const params = name ? [email, name, req.schoolId] : [email, req.schoolId];

    const [rows] = await dbPool.query(
      `SELECT a.id, a.booking_id, a.date, a.time, a.present,
              b.branch, b.instructor_name, b.car_name, b.training_days, b.starting_from
       FROM attendance a
       JOIN bookings b ON b.id = a.booking_id
       WHERE ${conditions} AND a.present = 1
       ORDER BY a.date DESC, a.time ASC`,
      params
    );
    res.json({ success: true, sessions: rows });
  } catch (err) { next(err); }
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
      created_at DATETIME NOT NULL,
      school_id INT NOT NULL DEFAULT 1,
      updated_by_id INT NULL,
      updated_by_type VARCHAR(20) NULL
    )
  `);
  try {
    const [rows] = await dbPool.query(
      'SELECT instructor_name, branch FROM instructors WHERE id = ? LIMIT 1', [instructorId]
    );
    const name   = rows[0]?.instructor_name ?? 'Unknown';
    const branch = rows[0]?.branch ?? '';
    const [result] = await dbPool.query(
      `INSERT INTO leave_requests (instructor_id, instructor_name, branch, leave_from, leave_to, leave_type, reason, status, created_at, school_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', NOW(), ?)`,
      [instructorId, name, branch, leave_from, leave_to, leave_type, reason || null, req.schoolId]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      await ensureTable();
      const [rows] = await dbPool.query('SELECT instructor_name, branch FROM instructors WHERE id = ? LIMIT 1', [instructorId]);
      const name = rows[0]?.instructor_name ?? ''; const branch = rows[0]?.branch ?? '';
      const [result] = await dbPool.query(
        `INSERT INTO leave_requests (instructor_id, instructor_name, branch, leave_from, leave_to, leave_type, reason, status, created_at, school_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', NOW(), ?)`,
        [instructorId, name, branch, leave_from, leave_to, leave_type, reason || null, req.schoolId]
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
       FROM leave_requests WHERE instructor_id = ? AND school_id = ? ORDER BY leave_from DESC LIMIT 30`,
      [instructorId, req.schoolId]
    );
    res.json({ success: true, leaves: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, leaves: [] });
    next(err);
  }
});

// Admin: view all leave requests for the school
app.get('/api/admin/leave-requests', requireAdmin, async (req, res, next) => {
  const schoolId = req.schoolId;
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
    const [result] = await dbPool.query(
      `UPDATE leave_requests lr
       JOIN instructors i ON i.id = lr.instructor_id
       SET lr.status = ?, lr.updated_by_id = ?, lr.updated_by_type = ?
       WHERE lr.id = ? AND i.school_id = ?`,
      [status, req.session.adminId, req.session.adminRole || 'instructor', id, req.schoolId]
    );
    if (!result.affectedRows) return res.json({ success: false, error: 'Leave request not found' });
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

// ---------- DEV: instant student login by booking_id ----------
app.post('/api/dev/student-login', async (req, res, next) => {
  try {
    const { booking_id } = req.body;
    let email, name, mobile;
    if (booking_id) {
      const [[booking]] = await dbPool.query('SELECT customer_name, email, mobile_no FROM bookings WHERE id = ? LIMIT 1', [booking_id]);
      if (!booking) return res.json({ success: false, error: `Booking ${booking_id} not found` });
      email = booking.email; name = booking.customer_name; mobile = booking.mobile_no;
    } else {
      const [[eu]] = await dbPool.query('SELECT id, email, full_name, mobile_no FROM exam_users ORDER BY id ASC LIMIT 1');
      if (!eu) return res.json({ success: false, error: 'No exam_users found' });
      email = eu.email; name = eu.full_name || eu.email; mobile = eu.mobile_no;
    }
    await dbPool.query('INSERT INTO exam_users (email, full_name, first_verified_at, last_seen_at) VALUES (?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), last_seen_at = NOW()', [email, name || null]);
    const [[userRow]] = await dbPool.query('SELECT id FROM exam_users WHERE email = ? LIMIT 1', [email]);
    req.session.examUser = { id: userRow.id, email };
    await new Promise((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve(undefined))));
    const signed = 's:' + cookieSign(req.session.id, process.env.SESSION_SECRET);
    const sessionToken = `session_cookie=${encodeURIComponent(signed)}`;
    res.json({ success: true, sessionToken, student: { id: userRow.id, email, full_name: name, mobile_no: mobile } });
  } catch (err) { next(err); }
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
    const conflictError = await checkSlotConflicts(
      req.schoolId || 1,
      data.branch,
      data.car_name,
      data.starting_from,
      Object.values(slotTimes).filter(Boolean)
    );
    if (conflictError) {
      return res.status(400).json({ success: false, error: conflictError });
    }

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
  school_id, created_by_id, created_by_type
) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
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
      req.schoolId || 1,
      req.session?.adminId || null,
      req.session?.adminId ? (req.session.adminRole || 'instructor') : null,
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
        branch, car_name, starting_from, training_days, present_days,
        allotted_time, allotted_time2, allotted_time3, allotted_time4,
        attendance_status
      FROM bookings
      WHERE attendance_status IN ('Active', 'Pending')
      AND school_id = ?
      ${excludeId ? 'AND id != ?' : ''}
    `;
    const schoolId = req.schoolId || req.session?.schoolId || 1;
    const params = excludeId ? [schoolId, excludeId] : [schoolId];
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
    const pending = (req.query.pending || '').trim();

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
    if (pending === 'pending') { conditions.push('(total_fees - COALESCE(advance, 0)) > 0'); }
    if (pending === 'paid') { conditions.push('(total_fees - COALESCE(advance, 0)) <= 0'); }

    const where = 'WHERE ' + conditions.join(' AND ');
    const selectCols = `
      b.id, b.branch, b.training_days, b.customer_name, b.address, b.pincode, b.mobile_no, b.whatsapp_no,
      b.sex, b.birth_date, b.cov_lmv, b.cov_mc, b.dl_no, b.dl_from, b.dl_to, b.email,
      b.occupation, b.ref, b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4, b.duration_minutes, b.starting_from, b.total_fees, b.advance,
      b.car_name, b.instructor_name,
      b.ac_facility, b.pickup_drop, b.has_licence,
      COALESCE(att.present_days, 0) AS present_days,
      b.hold_status, b.attendance_status, b.certificate_url,
      b.created_at`;

    const joinAtt = `LEFT JOIN (SELECT booking_id, COUNT(*) AS present_days FROM attendance WHERE present = 1 GROUP BY booking_id) att ON att.booking_id = b.id`;
    const fromClause = `FROM bookings b ${joinAtt}`;

    if (page !== null) {
      const offset = (page - 1) * limit;
      const [[{ total }]] = await dbPool.query(`SELECT COUNT(*) as total FROM bookings b ${where}`, params);
      const [rows] = await dbPool.query(`SELECT ${selectCols} ${fromClause} ${where} ORDER BY b.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
      res.json({ success: true, bookings: rows, total, page, limit });
    } else {
      const [rows] = await dbPool.query(`SELECT ${selectCols} ${fromClause} ${where} ORDER BY b.id DESC`, params);
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

    if (hasSelectedSlots) {
      const conflictError = await checkSlotConflicts(
        req.schoolId,
        data.branch || current.branch,
        data.car_name || current.car_name,
        data.starting_from || current.starting_from,
        Object.values(slotTimes).filter(Boolean),
        Number(id)
      );
      if (conflictError) {
        return res.status(400).json({ success: false, error: conflictError });
      }
    }
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
        licence_fee=?,
        updated_by_id=?,
        updated_by_type=?
      WHERE id=? AND school_id=?
    `;

    const values = [
      data.branch ?? current.branch,
      data.training_days ?? current.training_days,
      data.customer_name ?? current.customer_name,
      data.address ?? current.address,
      data.pincode ?? current.pincode,
      data.mobile_no ?? current.mobile_no,
      data.mobile_no ?? current.mobile_no, // whatsapp_no always mirrors mobile_no on update
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
      req.session.adminId,
      req.session.adminRole || 'instructor',
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
    // expense_categories ready
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
    // migration: schedule_slots.present added
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
    // migration: attendance per-slot ready
  } catch (err) {
    console.error('[Migration] attendance per-slot:', err.message);
  }
})();

// Migration: add marked_by_id + marked_by_type to attendance
// marked_by_type: 'admin' = admins table, 'manager'/'instructor' = instructors table
(async () => {
  try {
    await dbPool.query(`ALTER TABLE attendance ADD COLUMN marked_by_id INT NULL`);
  } catch (e) { if (e.errno !== 1060) console.error('[Migration] attendance.marked_by_id:', e.message); }
  try {
    await dbPool.query(`ALTER TABLE attendance ADD COLUMN marked_by_type VARCHAR(20) NULL`);
  } catch (e) { if (e.errno !== 1060) console.error('[Migration] attendance.marked_by_type:', e.message); }
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
      `SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date, CONVERT(time USING utf8mb4) AS time, present,
              DATE_FORMAT(marked_at, '%Y-%m-%d %H:%i') AS marked_at,
              'regular' AS source
       FROM attendance WHERE booking_id=?
       UNION ALL
       SELECT id, DATE_FORMAT(date, '%Y-%m-%d') AS date, CONVERT(time USING utf8mb4) AS time, present,
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
    const markedById   = req.session.adminId   || null;
    // 'admin' → admins table; 'manager' or 'instructor' → instructors table
    const markedByType = req.session.adminRole || 'instructor';

    async function attemptUpdate() {
        let conn;
        try {
            conn = await dbPool.getConnection();
            await conn.beginTransaction();

            const storedValue = value >= 1 ? 1 : 0;
            await conn.query(
                `INSERT INTO attendance (booking_id, date, time, present, marked_at, marked_by_id, marked_by_type)
                 VALUES (?, ?, ?, ?, NOW(), ?, ?)
                 ON DUPLICATE KEY UPDATE present = ?, marked_at = NOW(), marked_by_id = ?, marked_by_type = ?`,
                [booking_id, mysqlDate, slotTime, storedValue, markedById, markedByType,
                 storedValue, markedById, markedByType]
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
      SELECT id, branch_name, address, city, state, postal_code, mobile_no, email, wifi_ssid, created_at
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
      INSERT INTO branches (branch_name, address, city, state, postal_code, mobile_no, email, wifi_ssid, school_id, created_by_id, created_by_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [data.branch_name, data.address || '', data.city || '', data.state || '',
      data.postal_code || '', data.mobile_no || '', data.email || '', data.wifi_ssid || '',
      req.schoolId, req.session.adminId, req.session.adminRole || 'instructor'];
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
      UPDATE branches SET branch_name=?, address=?, city=?, state=?, postal_code=?, mobile_no=?, email=?,
        wifi_ssid=?, updated_by_id=?, updated_by_type=?
      WHERE id=? AND school_id=?
    `;
    const values = [data.branch_name, data.address || '', data.city || '', data.state || '',
      data.postal_code || '', data.mobile_no || '', data.email || '', data.wifi_ssid || '',
      req.session.adminId, req.session.adminRole || 'instructor', id, req.schoolId];
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

// ---------- HEALTH CHECK ----------
app.get('/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));


// ---------- PROCESS-LEVEL HANDLERS ----------
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err && (err.stack || err));
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// ---------- CRON JOB ----------
cron.schedule('1 0 * * *', async () => {
  try {
    await updateBookingsStatus();
  } catch (err) {
    console.error('[CRON] Booking status update failed:', err.message);
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
app.use('/api/email', emailRoutes);

// ── Driver Trips ──────────────────────────────────────────────────────────────

const ensureTripsTable = () => dbPool.query(`
  CREATE TABLE IF NOT EXISTS driver_trips (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_id INT NOT NULL,
    instructor_name VARCHAR(100),
    booking_id INT NOT NULL,
    student_name VARCHAR(100),
    started_at DATETIME NOT NULL,
    ended_at DATETIME NULL,
    duration_mins INT NOT NULL DEFAULT 30,
    status ENUM('active','paused','completed') NOT NULL DEFAULT 'active',
    paused_at DATETIME NULL,
    paused_secs INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

// Driver: start a trip
// A trip may only be started within this many minutes before/after the
// booking's scheduled slot time (IST — process.env.TZ forces server time to
// Asia/Kolkata, see top of file).
const TRIP_START_EARLY_GRACE_MIN = 15;
const TRIP_START_LATE_GRACE_MIN = 30;

app.post('/api/driver/trip/start', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  const { booking_id, duration_mins = 30 } = req.body;
  if (!booking_id) return res.json({ success: false, error: 'booking_id required' });
  try {
    await ensureTripsTable();
    const [[bk]] = await dbPool.query(
      `SELECT customer_name, allotted_time, allotted_time2, allotted_time3, allotted_time4
       FROM bookings WHERE id=? AND school_id=? LIMIT 1`,
      [booking_id, req.schoolId]
    );
    if (!bk) return res.status(404).json({ success: false, error: 'Booking not found' });

    const slotTimes = [bk.allotted_time, bk.allotted_time2, bk.allotted_time3, bk.allotted_time4]
      .filter(Boolean)
      .map(t => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
      });

    if (slotTimes.length) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const withinWindow = slotTimes.some(
        slotMins => nowMins >= slotMins - TRIP_START_EARLY_GRACE_MIN && nowMins <= slotMins + TRIP_START_LATE_GRACE_MIN
      );
      if (!withinWindow) {
        const formatTime = mins => {
          const h = Math.floor(mins / 60), m = mins % 60;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const h12 = h % 12 || 12;
          return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
        };
        return res.status(400).json({
          success: false,
          error: `You can only start this lesson within ${TRIP_START_EARLY_GRACE_MIN} minutes before or ${TRIP_START_LATE_GRACE_MIN} minutes after the scheduled time (${slotTimes.map(formatTime).join(', ')}). Current time: ${formatTime(nowMins)}.`,
        });
      }
    }

    // Auto-end any existing active/paused trip
    await dbPool.query(
      `UPDATE driver_trips SET status='completed', ended_at=NOW() WHERE instructor_id=? AND status IN ('active','paused')`,
      [instructorId]
    );
    const [[inst]] = await dbPool.query('SELECT instructor_name FROM instructors WHERE id=? AND school_id=? LIMIT 1', [instructorId, req.schoolId]);
    const [result] = await dbPool.query(
      `INSERT INTO driver_trips (instructor_id, instructor_name, booking_id, student_name, started_at, duration_mins, status, school_id)
       VALUES (?, ?, ?, ?, NOW(), ?, 'active', ?)`,
      [instructorId, inst?.instructor_name ?? '', booking_id, bk?.customer_name ?? '', duration_mins, req.schoolId]
    );
    const [[trip]] = await dbPool.query('SELECT * FROM driver_trips WHERE id=?', [result.insertId]);
    const remainingSecs = trip.duration_mins * 60;
    res.json({ success: true, trip: { ...trip, remaining_secs: remainingSecs } });
  } catch (err) { next(err); }
});

// Driver: pause an active trip
app.post('/api/driver/trip/pause', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  const { trip_id } = req.body;
  try {
    const [result] = await dbPool.query(
      `UPDATE driver_trips SET status='paused', paused_at=NOW()
       WHERE id=? AND instructor_id=? AND status='active'`,
      [trip_id, instructorId]
    );
    if (!result.affectedRows) return res.json({ success: false, error: 'Trip is not active' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Driver: resume a paused trip
app.post('/api/driver/trip/resume', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  const { trip_id } = req.body;
  try {
    const [result] = await dbPool.query(
      `UPDATE driver_trips
       SET status='active',
           paused_secs = paused_secs + TIMESTAMPDIFF(SECOND, paused_at, NOW()),
           paused_at = NULL
       WHERE id=? AND instructor_id=? AND status='paused'`,
      [trip_id, instructorId]
    );
    if (!result.affectedRows) return res.json({ success: false, error: 'Trip is not paused' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Driver: end (complete) a trip — once completed it can no longer be started, paused, or resumed
app.post('/api/driver/trip/end', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  const { trip_id } = req.body;
  try {
    // If completing directly from a paused state, fold the open pause segment in first
    await dbPool.query(
      `UPDATE driver_trips
       SET paused_secs = paused_secs + TIMESTAMPDIFF(SECOND, paused_at, NOW()),
           paused_at = NULL
       WHERE id=? AND instructor_id=? AND status='paused'`,
      [trip_id, instructorId]
    );
    await dbPool.query(
      `UPDATE driver_trips
       SET status='completed', ended_at=NOW(),
           duration_mins = LEAST(120, GREATEST(1, TIMESTAMPDIFF(MINUTE, started_at, NOW()) - FLOOR(paused_secs / 60)))
       WHERE id=? AND instructor_id=? AND status IN ('active','paused')`,
      [trip_id, instructorId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Driver: get own active/paused trip
app.get('/api/driver/trip/active', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  try {
    const [rows] = await dbPool.query(
      `SELECT *,
              GREATEST(0, duration_mins * 60 - (TIMESTAMPDIFF(SECOND, started_at, NOW()) - paused_secs)) AS remaining_secs
       FROM driver_trips WHERE instructor_id=? AND status IN ('active','paused') ORDER BY started_at DESC LIMIT 1`,
      [instructorId]
    );
    res.json({ success: true, trip: rows[0] ?? null });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, trip: null });
    next(err);
  }
});

// Admin: all drivers' current status
app.get('/api/driver/trips/status', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT i.id, i.instructor_name, i.branch,
             dt.id AS trip_id, dt.booking_id, dt.student_name, dt.status AS trip_status,
             GREATEST(0, COALESCE(dt.duration_mins,30)*60 - (TIMESTAMPDIFF(SECOND, dt.started_at, NOW()) - COALESCE(dt.paused_secs,0))) AS remaining_secs
      FROM instructors i
      LEFT JOIN driver_trips dt ON dt.instructor_id = i.id AND dt.status IN ('active','paused')
      WHERE i.is_active = 1 AND i.school_id = ?
      ORDER BY i.branch, i.instructor_name
    `, [req.schoolId]);
    const data = rows.map(r => ({
      id: r.id, name: r.instructor_name, branch: r.branch,
      on_trip: !!r.trip_id,
      trip_id: r.trip_id ?? null,
      student_name: r.student_name ?? null,
      trip_status: r.trip_status ?? null,
      remaining_secs: Number(r.remaining_secs) || 0,
    }));
    res.json({ success: true, drivers: data });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, drivers: [] });
    next(err);
  }
});

// Public: student checks if their instructor is currently on a trip
app.get('/api/driver-status-by-name', async (req, res, next) => {
  try {
    const { name } = req.query;
    if (!name) return res.json({ success: false, message: 'name required' });

    const [[row]] = await dbPool.query(`
      SELECT i.id, i.instructor_name, dt.started_at
      FROM instructors i
      LEFT JOIN driver_trips dt ON dt.instructor_id = i.id AND dt.status IN ('active','paused')
      WHERE i.instructor_name = ? AND i.is_active = 1
      LIMIT 1
    `, [name]);

    if (!row) return res.json({ success: false, message: 'Instructor not found' });

    res.json({
      success: true,
      instructor_id:   row.id,
      instructor_name: row.instructor_name,
      on_trip:         !!row.started_at,
      started_at:      row.started_at ?? null,
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, on_trip: false, started_at: null });
    next(err);
  }
});

// ── App Settings (Remote Config + Feature Flags) ─────────────────────────────

const ensureAppSettingsTable = async () => {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      \`key\`       VARCHAR(100) NOT NULL,
      value       TEXT         NOT NULL,
      label       VARCHAR(200) NOT NULL DEFAULT '',
      description TEXT,
      updated_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (\`key\`)
    )
  `);
  const defaults = [
    { key: 'maintenance_mode',      value: 'false', label: 'Maintenance Mode',  description: 'When ON, all app users see a maintenance screen. Admin panel stays accessible.' },
    { key: 'maintenance_message',   value: 'We are currently performing maintenance. Please check back soon.', label: 'Maintenance Message', description: 'Text shown to users during maintenance' },
    { key: 'feature_leave_request', value: 'true',  label: 'Leave Request',     description: 'Drivers can submit leave requests from the app' },
    { key: 'wifi_ssid',             value: '',      label: 'School WiFi SSID',  description: 'Instructors must be on this WiFi to clock in/out. Leave empty to disable WiFi check.' },
  ];
  for (const d of defaults) {
    await dbPool.query(
      'INSERT IGNORE INTO app_settings (`key`, value, label, description) VALUES (?, ?, ?, ?)',
      [d.key, d.value, d.label, d.description]
    );
  }
};

// Public — mobile app fetches this on every startup (no auth required)
app.get('/api/app-config', async (req, res, next) => {
  try {
    await ensureAppSettingsTable();
    const [rows] = await dbPool.query('SELECT `key`, value FROM app_settings');
    const config = {};
    for (const row of rows) {
      config[row.key] = row.value === 'true' ? true : row.value === 'false' ? false : row.value;
    }
    // If an instructor is logged in, override wifi_ssid with their branch's wifi_ssid
    if (req.session?.adminId) {
      try {
        const schoolId = req.session.schoolId || 1;
        const [[inst]] = await dbPool.query(
          'SELECT branch FROM instructors WHERE id=? AND school_id=? LIMIT 1',
          [req.session.adminId, schoolId]
        );
        if (inst?.branch) {
          const [[br]] = await dbPool.query(
            'SELECT wifi_ssid FROM branches WHERE branch_name=? AND school_id=? LIMIT 1',
            [inst.branch, schoolId]
          );
          if (br?.wifi_ssid) config.wifi_ssid = br.wifi_ssid;
        }
      } catch (_) {}
    }
    res.json({ success: true, config });
  } catch (err) { next(err); }
});

// Admin — list all settings
app.get('/api/admin/app-settings', requireAdmin, async (req, res, next) => {
  try {
    await ensureAppSettingsTable();
    const [rows] = await dbPool.query('SELECT * FROM app_settings ORDER BY `key`');
    res.json({ success: true, settings: rows });
  } catch (err) {
    console.error('[app-settings] ERROR:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin — update one setting
app.patch('/api/admin/app-settings/:key', requireAdmin, async (req, res, next) => {
  const { key } = req.params;
  const { value } = req.body;
  if (value === undefined || value === null) return res.json({ success: false, error: 'value required' });
  try {
    await ensureAppSettingsTable();
    await dbPool.query(
      'INSERT INTO app_settings (`key`, value, updated_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()',
      [key, String(value), String(value)]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Public JSON: look up driver status by name (used by customer app)
app.get('/api/driver-status-by-name', async (req, res, next) => {
  const name = (req.query.name || '').trim();
  if (!name) return res.json({ success: false, error: 'name required' });
  try {
    const [[inst]] = await dbPool.query(
      'SELECT id, instructor_name FROM instructors WHERE instructor_name = ? LIMIT 1', [name]
    );
    if (!inst) return res.json({ success: false, error: 'Driver not found' });
    const [trips] = await dbPool.query(
      `SELECT student_name, started_at
       FROM driver_trips WHERE instructor_id=? AND status='active' ORDER BY started_at DESC LIMIT 1`,
      [inst.id]
    );
    const trip = trips[0] ?? null;
    res.json({
      success: true,
      instructor_id: inst.id,
      instructor_name: inst.instructor_name,
      on_trip: !!trip,
      started_at: trip?.started_at ?? null,
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      try {
        const [[inst]] = await dbPool.query('SELECT id, instructor_name FROM instructors WHERE instructor_name=? LIMIT 1', [name]);
        return res.json({ success: true, instructor_id: inst?.id, instructor_name: inst?.instructor_name ?? name, on_trip: false, remaining_secs: 0 });
      } catch (_) {}
    }
    next(err);
  }
});

// Public JSON: student checks driver availability
app.get('/api/driver-status/:instructor_id', async (req, res, next) => {
  const { instructor_id } = req.params;
  try {
    const [[inst]] = await dbPool.query(
      'SELECT id, instructor_name FROM instructors WHERE id=? LIMIT 1', [instructor_id]
    );
    if (!inst) return res.json({ success: false, error: 'Driver not found' });
    const [trips] = await dbPool.query(
      `SELECT student_name,
              GREATEST(0, duration_mins*60 - (TIMESTAMPDIFF(SECOND, started_at, NOW()) - paused_secs)) AS remaining_secs
       FROM driver_trips WHERE instructor_id=? AND status IN ('active','paused') ORDER BY started_at DESC LIMIT 1`,
      [instructor_id]
    );
    const trip = trips[0] ?? null;
    res.json({
      success: true,
      instructor_name: inst.instructor_name,
      on_trip: !!trip,
      student_name: trip?.student_name ?? null,
      remaining_secs: Number(trip?.remaining_secs) || 0,
    });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      try {
        const [[inst]] = await dbPool.query('SELECT instructor_name FROM instructors WHERE id=? LIMIT 1', [instructor_id]);
        return res.json({ success: true, instructor_name: inst?.instructor_name ?? 'Driver', on_trip: false, remaining_secs: 0 });
      } catch (_) {}
    }
    next(err);
  }
});

// Admin: trip logs history
app.get('/api/admin/trip-logs', requireAdmin, async (req, res, next) => {
  const schoolId = req.schoolId || req.session?.schoolId || 1;
  const { date_from, date_to, instructor_id, status } = req.query;
  try {
    await ensureTripsTable();
    // Auto-complete any trip that has been active/paused for more than 2 hours
    await dbPool.query(
      `UPDATE driver_trips
       SET status='completed',
           ended_at = DATE_ADD(started_at, INTERVAL 120 MINUTE),
           duration_mins = 120
       WHERE status IN ('active','paused') AND TIMESTAMPDIFF(MINUTE, started_at, NOW()) > 120`
    );
    const conditions = ['i.school_id = ?'];
    const params = [schoolId];

    if (date_from) { conditions.push('DATE(dt.started_at) >= ?'); params.push(date_from); }
    if (date_to)   { conditions.push('DATE(dt.started_at) <= ?'); params.push(date_to); }
    if (instructor_id) { conditions.push('dt.instructor_id = ?'); params.push(instructor_id); }
    if (status && ['active','paused','completed'].includes(status)) { conditions.push('dt.status = ?'); params.push(status); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const [rows] = await dbPool.query(`
      SELECT dt.id, dt.instructor_id, dt.instructor_name, dt.booking_id, dt.student_name,
             dt.started_at, dt.ended_at, dt.duration_mins, dt.status,
             i.branch
      FROM driver_trips dt
      JOIN instructors i ON i.id = dt.instructor_id
      ${where}
      ORDER BY dt.started_at DESC
      LIMIT 500
    `, params);
    res.json({ success: true, trips: rows });
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json({ success: true, trips: [] });
    next(err);
  }
});

// ── Instructor Attendance (Clock In / Clock Out) ──────────────────────────────

const ensureInstructorAttendanceTable = async () => {
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS instructor_attendance (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      instructor_id INT NOT NULL,
      instructor_name VARCHAR(100) NOT NULL DEFAULT '',
      clock_in     DATETIME NOT NULL,
      clock_out    DATETIME NULL,
      date         DATE NOT NULL,
      school_id    INT NOT NULL DEFAULT 1,
      INDEX idx_inst_date (instructor_id, date)
    )
  `);
};

// Driver: clock in
app.post('/api/driver/attendance/clock-in', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  try {
    await ensureInstructorAttendanceTable();
    const [[inst]] = await dbPool.query('SELECT instructor_name FROM instructors WHERE id=? AND school_id=? LIMIT 1', [instructorId, req.schoolId]);
    // Use the DB's IST-forced CURDATE(), not Node's UTC date — avoids the
    // 00:00-05:30 IST window being bucketed into the previous calendar day.
    const [[existing]] = await dbPool.query(
      'SELECT id FROM instructor_attendance WHERE instructor_id=? AND date=CURDATE() AND school_id=? LIMIT 1',
      [instructorId, req.schoolId]
    );
    if (existing) return res.json({ success: false, error: 'Already clocked in today' });
    await dbPool.query(
      'INSERT INTO instructor_attendance (instructor_id, instructor_name, clock_in, date, school_id) VALUES (?, ?, NOW(), CURDATE(), ?)',
      [instructorId, inst?.instructor_name ?? '', req.schoolId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Driver: clock out
app.post('/api/driver/attendance/clock-out', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  try {
    await ensureInstructorAttendanceTable();
    const [[record]] = await dbPool.query(
      'SELECT id FROM instructor_attendance WHERE instructor_id=? AND date=CURDATE() AND clock_out IS NULL AND school_id=? LIMIT 1',
      [instructorId, req.schoolId]
    );
    if (!record) return res.json({ success: false, error: 'No active clock-in found for today' });
    await dbPool.query(
      'UPDATE instructor_attendance SET clock_out=NOW() WHERE id=? AND school_id=?',
      [record.id, req.schoolId]
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Driver: get today's attendance record
app.get('/api/driver/attendance/today', requireAdmin, async (req, res, next) => {
  const instructorId = req.session.adminId;
  try {
    await ensureInstructorAttendanceTable();
    const [[record]] = await dbPool.query(
      'SELECT * FROM instructor_attendance WHERE instructor_id=? AND date=CURDATE() AND school_id=? LIMIT 1',
      [instructorId, req.schoolId]
    );
    res.json({ success: true, record: record ?? null });
  } catch (err) { next(err); }
});

// Admin: view instructor attendance
app.get('/api/admin/instructor-attendance', requireAdmin, async (req, res, next) => {
  const { date_from, date_to, instructor_id } = req.query;
  try {
    await ensureInstructorAttendanceTable();
    const conditions = ['ia.school_id = ?'];
    const params = [req.schoolId];
    if (date_from)     { conditions.push('ia.date >= ?'); params.push(date_from); }
    if (date_to)       { conditions.push('ia.date <= ?'); params.push(date_to); }
    if (instructor_id) { conditions.push('ia.instructor_id = ?'); params.push(instructor_id); }
    const where = 'WHERE ' + conditions.join(' AND ');
    const [rows] = await dbPool.query(
      `SELECT ia.*, TIMESTAMPDIFF(MINUTE, ia.clock_in, COALESCE(ia.clock_out, NOW())) AS duration_mins
       FROM instructor_attendance ia ${where}
       ORDER BY ia.date DESC, ia.clock_in DESC LIMIT 500`,
      params
    );
    res.json({ success: true, records: rows });
  } catch (err) { next(err); }
});

// Public HTML: student-facing driver status page
app.get('/driver-status/:instructor_id', (req, res) => {
  const { instructor_id } = req.params;
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Driver Status – Dwarkesh Driving School</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #F5F7FA; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { background: white; border-radius: 20px; padding: 36px 28px; max-width: 380px; width: 100%; box-shadow: 0 4px 24px rgba(0,0,0,0.08); text-align: center; }
    .school { font-size: 12px; color: #aaa; letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 24px; }
    .avatar { width: 76px; height: 76px; border-radius: 38px; background: #1B5E20; color: white; font-size: 28px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
    .driver-name { font-size: 22px; font-weight: 700; color: #111; margin-bottom: 12px; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 20px; border-radius: 100px; font-size: 14px; font-weight: 600; margin-bottom: 24px; }
    .badge.trip { background: #FFF3E0; color: #E65100; }
    .badge.free { background: #E8F5E9; color: #1B5E20; }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    .dot.trip { background: #E65100; animation: blink 1.4s infinite; }
    .dot.free { background: #2E7D32; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.35} }
    .countdown { font-size: 56px; font-weight: 800; color: #E65100; letter-spacing: -2px; line-height: 1; }
    .countdown-sub { font-size: 13px; color: #999; margin-top: 6px; margin-bottom: 20px; }
    .note { background: #FFF8F2; border-radius: 12px; padding: 12px 16px; font-size: 13px; color: #777; }
    .ready { font-size: 40px; font-weight: 800; color: #2E7D32; margin-bottom: 8px; }
    .ready-sub { font-size: 14px; color: #888; }
    .footer { font-size: 11px; color: #ccc; margin-top: 24px; }
    .err { color: #c62828; font-size: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="school">Dwarkesh Driving School</div>
    <div class="avatar" id="av">—</div>
    <div class="driver-name" id="nm">Loading…</div>
    <div id="body"></div>
    <div class="footer" id="ft">Checking status…</div>
  </div>
  <script>
    const id = ${JSON.stringify(instructor_id)};
    let ticker = null;

    function pad(n){ return String(n).padStart(2,'0'); }
    function fmt(s){ return Math.floor(s/60)+':'+pad(s%60); }
    function initials(n){ return (n||'').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?'; }

    async function load(){
      try {
        const d = await fetch('/api/driver-status/'+id).then(r=>r.json());
        if(!d.success){ document.getElementById('body').innerHTML='<p class="err">Driver not found.</p>'; return; }
        document.getElementById('av').textContent = initials(d.instructor_name);
        document.getElementById('nm').textContent = d.instructor_name;
        if(ticker){ clearInterval(ticker); ticker=null; }
        if(d.on_trip && d.remaining_secs > 0){
          let s = d.remaining_secs;
          document.getElementById('body').innerHTML =
            '<div class="badge trip"><span class="dot trip"></span>On Trip</div>' +
            '<div class="countdown" id="cd">'+fmt(s)+'</div>' +
            '<div class="countdown-sub">minutes remaining</div>' +
            '<div class="note">Your instructor is with another student.<br>They will be with you shortly.</div>';
          ticker = setInterval(()=>{
            s = Math.max(0,s-1);
            const el = document.getElementById('cd');
            if(el) el.textContent = fmt(s);
            if(s===0){ clearInterval(ticker); load(); }
          },1000);
        } else {
          document.getElementById('body').innerHTML =
            '<div class="badge free"><span class="dot free"></span>Available</div>' +
            '<div class="ready">Ready ✓</div>' +
            '<div class="ready-sub">Your instructor is free</div>';
        }
        document.getElementById('ft').textContent = 'Last updated: '+new Date().toLocaleTimeString('en-IN') + ' · Refreshes every 30s';
      } catch(e){
        document.getElementById('body').innerHTML='<p class="err">Could not load status.</p>';
      }
    }
    load();
    setInterval(load, 30000);
  </script>
</body>
</html>`);
});

// ── Student Complaints ────────────────────────────────────────────────────────

const ensureComplaintsTable = () => dbPool.query(`
  CREATE TABLE IF NOT EXISTS student_complaints (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    student_email   VARCHAR(255) NOT NULL,
    student_name    VARCHAR(255),
    booking_id      INT,
    subject         VARCHAR(255) NOT NULL,
    message         TEXT NOT NULL,
    category        ENUM('Instructor','Schedule','Payment','Car','App','Other') NOT NULL DEFAULT 'Other',
    status          ENUM('Open','In Review','Resolved','Closed') NOT NULL DEFAULT 'Open',
    admin_note      TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    school_id       INT NOT NULL DEFAULT 1
  )
`);

// Public: delete account — verifies OTP then removes exam_users record
app.post('/api/student/delete-account', async (req, res, next) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.json({ success: false, message: 'Email and OTP required' });
  try {
    const [rows] = await dbPool.query(
      `SELECT id FROM email_otps
       WHERE email = ? AND otp = ? AND verified = 0 AND expires_at > NOW()
       LIMIT 1`,
      [email, otp]
    );
    if (!rows.length) return res.json({ success: false, message: 'Invalid or expired code.' });
    await dbPool.query(`UPDATE email_otps SET verified = 1 WHERE id = ?`, [rows[0].id]);
    await dbPool.query(`DELETE FROM exam_users WHERE email = ?`, [email]);
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Student: submit a complaint
app.post('/api/student/complaints', requireExamUser, async (req, res, next) => {
  const { email, full_name } = req.session.examUser;
  const { subject, message, category, booking_id } = req.body;
  if (!subject?.trim() || !message?.trim()) {
    return res.status(400).json({ success: false, error: 'Subject and message are required' });
  }
  const validCategories = ['Instructor', 'Schedule', 'Payment', 'Car', 'App', 'Other'];
  const cat = validCategories.includes(category) ? category : 'Other';
  try {
    await ensureComplaintsTable();
    const [result] = await dbPool.query(
      `INSERT INTO student_complaints (student_email, student_name, booking_id, subject, message, category, school_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, full_name || null, booking_id || null, subject.trim(), message.trim(), cat, req.schoolId],
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) { next(err); }
});

// Student: view own complaints
app.get('/api/student/complaints', requireExamUser, async (req, res, next) => {
  const { email } = req.session.examUser;
  try {
    await ensureComplaintsTable();
    const [rows] = await dbPool.query(
      `SELECT id, subject, message, category, status, admin_note, created_at, updated_at
       FROM student_complaints WHERE student_email = ? AND school_id = ? ORDER BY created_at DESC`,
      [email, req.schoolId],
    );
    res.json({ success: true, complaints: rows });
  } catch (err) { next(err); }
});

// Admin: list all complaints
app.get('/api/admin/complaints', requireAdmin, async (req, res, next) => {
  const { status, category } = req.query;
  try {
    await ensureComplaintsTable();
    const conditions = ['sc.school_id = ?'];
    const params = [req.schoolId];
    if (status)   { conditions.push('status = ?');   params.push(status); }
    if (category) { conditions.push('category = ?'); params.push(category); }
    const where = `WHERE ${conditions.join(' AND ')}`;
    const [rows] = await dbPool.query(
      `SELECT sc.id, sc.student_email, COALESCE(sc.student_name, b.customer_name, eu.full_name) AS student_name,
              sc.booking_id, sc.subject, sc.message, sc.category, sc.status, sc.admin_note, sc.created_at, sc.updated_at
       FROM student_complaints sc
       LEFT JOIN bookings b ON b.id = sc.booking_id
       LEFT JOIN exam_users eu ON eu.email = sc.student_email
       ${where} ORDER BY sc.created_at DESC LIMIT 500`,
      params,
    );
    res.json({ success: true, complaints: rows });
  } catch (err) { next(err); }
});

// Admin: update complaint status / add note
app.patch('/api/admin/complaints/:id', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { status, admin_note } = req.body;
  const validStatuses = ['Open', 'In Review', 'Resolved', 'Closed'];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid status' });
  }
  const updates = [];
  const params  = [];
  if (status !== undefined)     { updates.push('status = ?');     params.push(status); }
  if (admin_note !== undefined) { updates.push('admin_note = ?'); params.push(admin_note || null); }
  if (updates.length === 0) return res.status(400).json({ success: false, error: 'Nothing to update' });
  updates.push('updated_by_id = ?', 'updated_by_type = ?');
  params.push(req.session.adminId, req.session.adminRole || 'instructor', id, req.schoolId);
  try {
    const [result] = await dbPool.query(`UPDATE student_complaints SET ${updates.join(', ')} WHERE id = ? AND school_id = ?`, params);
    if (!result.affectedRows) return res.json({ success: false, error: 'Complaint not found' });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ── Session Ratings ───────────────────────────────────────────────────────────

const ensureRatingsTable = () => dbPool.query(`
  CREATE TABLE IF NOT EXISTS session_ratings (
    id             INT AUTO_INCREMENT PRIMARY KEY,
    exam_user_id   INT NOT NULL,
    attendance_id  INT NOT NULL,
    booking_id     INT,
    instructor_name VARCHAR(255),
    rating         TINYINT NOT NULL,
    comment        TEXT,
    rated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    school_id      INT NOT NULL DEFAULT 1,
    UNIQUE KEY uniq_user_session (exam_user_id, attendance_id)
  )
`);

// GET /api/student/pending-rating — returns last attended session not yet rated
app.get('/api/student/pending-rating', requireExamUser, async (req, res, next) => {
  const { id: examUserId, email } = req.session.examUser;
  try {
    await ensureRatingsTable();
    const [[eu]] = await dbPool.query('SELECT full_name FROM exam_users WHERE id = ? LIMIT 1', [examUserId]);
    const name = eu?.full_name ?? null;
    // Get the single most recent attended session
    const conditions = name ? '(b.email = ? OR b.customer_name = ?) AND b.school_id = ?' : 'b.email = ? AND b.school_id = ?';
    const params2 = name ? [email, name, req.schoolId] : [email, req.schoolId];
    const [rows] = await dbPool.query(
      `SELECT a.id AS attendance_id, a.date, a.time, a.booking_id,
              b.instructor_name, b.branch, b.car_name
       FROM attendance a
       JOIN bookings b ON b.id = a.booking_id
       WHERE ${conditions}
         AND a.present = 1
       ORDER BY a.date DESC, a.time DESC
       LIMIT 1`,
      params2,
    );
    if (rows.length === 0) return res.json({ success: true, pending: null });
    const last = rows[0];
    // Only ask for rating if this session hasn't been rated yet
    const [[existing]] = await dbPool.query(
      'SELECT id FROM session_ratings WHERE exam_user_id = ? AND attendance_id = ? LIMIT 1',
      [examUserId, last.attendance_id],
    );
    if (existing) return res.json({ success: true, pending: null });
    res.json({ success: true, pending: last });
  } catch (err) { next(err); }
});

// POST /api/student/rate-session
app.post('/api/student/rate-session', requireExamUser, async (req, res, next) => {
  const { id: examUserId } = req.session.examUser;
  const { attendance_id, booking_id, instructor_name, rating, comment } = req.body;
  if (!attendance_id || !rating || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, error: 'attendance_id and rating (1–5) are required' });
  }
  try {
    await ensureRatingsTable();
    await dbPool.query(
      `INSERT INTO session_ratings (exam_user_id, attendance_id, booking_id, instructor_name, rating, comment, school_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), rated_at = NOW()`,
      [examUserId, attendance_id, booking_id || null, instructor_name || null, rating, comment?.trim() || null, req.schoolId],
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// Admin: view all session ratings
app.get('/api/admin/session-ratings', requireAdmin, async (req, res, next) => {
  try {
    await ensureRatingsTable();
    const [rows] = await dbPool.query(
      `SELECT sr.id, sr.exam_user_id, COALESCE(eu.full_name, b.customer_name) AS student_name, eu.email AS student_email,
              sr.attendance_id, sr.booking_id, sr.instructor_name,
              sr.rating, sr.comment, sr.rated_at
       FROM session_ratings sr
       LEFT JOIN exam_users eu ON eu.id = sr.exam_user_id
       LEFT JOIN bookings b ON b.id = sr.booking_id
       WHERE sr.school_id = ?
       ORDER BY sr.rated_at DESC LIMIT 500`,
      [req.schoolId],
    );
    res.json({ success: true, ratings: rows });
  } catch (err) { next(err); }
});

// ---------- 404 HANDLER ----------
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ---------- GLOBAL ERROR HANDLER ----------
app.use((err, req, res, next) => {
  if (err.message && err.message.startsWith('CORS:')) {
    return res.status(403).json({ success: false, error: err.message });
  }
  if (err.status === 413 || err.type === 'entity.too.large') {
    return res.status(413).json({ success: false, error: 'Request too large' });
  }
  console.error('[ERROR]', err && (err.stack || err));
  res.status(500).json({ success: false, error: 'Internal server error' });
});

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
  if (req.session && req.session.examUser) {
    req.schoolId = req.session.examUser.school_id || 1;
    return next();
  }
  return res.status(401).json({ success: false, error: 'Not logged in' });
}