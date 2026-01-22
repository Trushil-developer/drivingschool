import express from 'express';
import mysql from 'mysql2/promise';
import bodyParser from 'body-parser';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import bcrypt from 'bcrypt';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import MySQLStoreImport from 'express-mysql-session';
import cron from 'node-cron';
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
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    key: 'session_cookie',
    secret: process.env.SESSION_SECRET || 'supersecretkey',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

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
  return d.toISOString().split('T')[0];
}

// =====================
// SLOT NORMALIZER (MAX 4)
// =====================
function normalizeSlots(selectedSlots = []) {
  const slots = Array.isArray(selectedSlots) ? selectedSlots.slice(0, 4) : [];

  const normalizeTime = (t) => {
    if (!t) return null;
    // Ensure HH:MM:SS exactly
    const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(t);
    if (!match) return null;
    const hh = match[1];
    const mm = match[2];
    const ss = match[3] || "00";
    return `${hh}:${mm}:${ss}`;
  };

  return {
    allotted_time: normalizeTime(slots[0]),
    allotted_time2: normalizeTime(slots[1]),
    allotted_time3: normalizeTime(slots[2]),
    allotted_time4: normalizeTime(slots[3]),
  };
}


// ---------- AUTH ----------
app.post('/api/login', async (req, res, next) => {
  const { username, password } = req.body;
  try {
    const [rows] = await dbPool.query('SELECT * FROM admins WHERE username = ? LIMIT 1', [username]);
    if (!rows || rows.length === 0) return res.json({ success: false, error: 'Invalid credentials' });
    const admin = rows[0];
    const match = await bcrypt.compare(password, admin.password);
    if (!match) return res.json({ success: false, error: 'Invalid credentials' });

    req.session.adminLoggedIn = true;
    req.session.adminId = admin.id;
    res.json({ success: true });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    next(err);
  }
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
    const sql = `
      INSERT INTO bookings (
        branch, training_days, customer_name, address, pincode, mobile_no, whatsapp_no,
        sex, birth_date, cov_lmv, cov_mc, dl_no, dl_from, dl_to, email,
        occupation, ref,
        allotted_time, allotted_time2, allotted_time3, allotted_time4,
        duration_minutes, starting_from,
        total_fees, advance, car_name, instructor_name,
        ac_facility, pickup_drop, has_licence,
        present_days, hold_status, attendance_status,
        certificate_url
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const initialPresentDays = 0;
    const initialHoldStatus = data.hold_status ? 1 : 0;

    const preliminaryBooking = {
      starting_from: data.starting_from || null,
      training_days: data.training_days,
      present_days: initialPresentDays,
      hold_status: initialHoldStatus
    };

    const attendanceStatus = computeAttendanceStatus(preliminaryBooking);

    const values = [
      data.branch,
      data.training_days,
      data.customer_name,
      data.address || '',
      data.pincode || '',
      data.mobile_no,
      data.whatsapp_no || '',
      data.sex || '',
      toMySQLDate(data.birth_date),
      data.cov_lmv ? 1 : 0,
      data.cov_mc ? 1 : 0,
      data.dl_no || '',
      toMySQLDate(data.dl_from),
      toMySQLDate(data.dl_to),
      data.email || '',
      data.occupation || '',
      data.ref || '',
      slotTimes.allotted_time,
      slotTimes.allotted_time2,
      slotTimes.allotted_time3,
      slotTimes.allotted_time4,
      data.duration_minutes || (slotTimes.allotted_time2 ? 60 : 30),
      toMySQLDate(data.starting_from),
      data.total_fees || 0,
      data.advance || 0,
      data.car_name || '',
      data.instructor_name || '',
      data.ac_facility ? 1 : 0,
      data.pickup_drop ? 1 : 0,
      data.has_licence === 'yes' ? 'Yes' : 'No',
  
      initialPresentDays,
      initialHoldStatus,
      attendanceStatus,
      data.certificate_url || null  
    ];

    const [result] = await dbPool.query(sql, values);
    res.json({ success: true, booking_id: result.insertId, attendance_status: attendanceStatus });
  } catch (err) {
    console.error('BOOKING CREATE ERROR:', err);
    next(err);
  }
});

app.get('/api/bookings', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT 
        id, branch, training_days, customer_name, address, pincode, mobile_no, whatsapp_no,
        sex, birth_date, cov_lmv, cov_mc, dl_no, dl_from, dl_to, email,
        occupation, ref, allotted_time, allotted_time2, allotted_time3, allotted_time4, duration_minutes, starting_from, total_fees, advance,
        car_name, instructor_name,
        ac_facility, pickup_drop, has_licence,
        present_days, hold_status, attendance_status, certificate_url,
        created_at
      FROM bookings
      ORDER BY id DESC
    `);
    res.json({ success: true, bookings: rows });
  } catch (err) {
    console.error('BOOKINGS LIST ERROR:', err);
    next(err);
  }
});


app.get('/api/bookings/:id', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`SELECT * FROM bookings WHERE id = ?`, [req.params.id]);
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
  const slotTimes = normalizeSlots(data.selected_slots || []);

  try {
    const [rows] = await dbPool.query(
      `SELECT * FROM bookings WHERE id = ? LIMIT 1`,
      [id]
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
        extended_days=?
      WHERE id=?
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
      slotTimes.allotted_time ?? current.allotted_time,
      slotTimes.allotted_time2 ?? current.allotted_time2,
      slotTimes.allotted_time3 ?? current.allotted_time3,
      slotTimes.allotted_time4 ?? current.allotted_time4,
      data.duration_minutes ?? current.duration_minutes,
      toMySQLDate(data.starting_from) ?? current.starting_from,
      data.total_fees ?? current.total_fees,
      data.advance ?? current.advance,
      data.car_name ?? current.car_name,
      data.instructor_name ?? current.instructor_name,
      data.ac_facility ?? current.ac_facility,
      data.pickup_drop ?? current.pickup_drop,
      data.has_licence
        ? (data.has_licence === 'yes' ? 'Yes' : 'No')
        : current.has_licence,
      newHoldStatus,
      hold_from ? toMySQLDate(hold_from) : null,
      resume_from ? toMySQLDate(resume_from) : null,
      extended_days,
      id
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
    await dbPool.query('DELETE FROM bookings WHERE id=?', [req.params.id]);
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

        const [rows] = await dbPool.query('SELECT certificate_url FROM bookings WHERE id = ?', [bookingId]);
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
        await dbPool.query("UPDATE bookings SET certificate_url = ? WHERE id = ?", [s3Key, bookingId]);

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

        const [rows] = await dbPool.query('SELECT certificate_url FROM bookings WHERE id = ?', [bookingId]);
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

app.get('/api/attendance-all', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT booking_id, date, present 
      FROM attendance
      ORDER BY booking_id ASC, date ASC
    `);

    res.json({ success: true, records: rows });
  } catch (err) {
    console.error('ATTENDANCE-ALL ERROR:', err);
    next(err);
  }
});

app.get('/api/attendance/:booking_id', requireAdmin, async (req, res, next) => {
  const booking_id = req.params.booking_id;
  try {
    const [rows] = await dbPool.query(
      'SELECT date, present FROM attendance WHERE booking_id=? ORDER BY date ASC',
      [booking_id]
    );
    res.json({ success: true, records: rows });
  } catch (err) {
    console.error('ATTENDANCE GET ERROR:', err);
    next(err);
  }
});

app.post('/api/attendance/:booking_id', requireAdmin, async (req, res, next) => {
    const booking_id = req.params.booking_id;
    const { date, increment } = req.body;

    if (!date || typeof increment !== 'number') {
        return res.status(400).json({ success: false, error: 'Date and increment required' });
    }

    const mysqlDate = date.split("T")[0];
    const conn = await dbPool.getConnection();

    try {
        await conn.beginTransaction();

        // 1) Update existing attendance or insert if none
        const [updateResult] = await conn.query(
            `UPDATE attendance SET present = present + ? WHERE booking_id = ? AND date = ?`,
            [increment, booking_id, mysqlDate]
        );

        if (updateResult.affectedRows === 0) {
            await conn.query(
                `INSERT INTO attendance (booking_id, date, present) VALUES (?, ?, ?)`,
                [booking_id, mysqlDate, increment]
            );
        }

        // 2) Update present_days
        const [presentSumRows] = await conn.query(
            `SELECT COALESCE(SUM(present),0) AS total_present FROM attendance WHERE booking_id = ?`,
            [booking_id]
        );

        const totalPresent = presentSumRows[0].total_present;

        await conn.query(
            `UPDATE bookings SET present_days = ? WHERE id = ?`,
            [totalPresent, booking_id]
        );

        // 3) Immediately recompute attendance_status based on updated present_days
        const [bookingRows] = await conn.query(
            `SELECT present_days, training_days, hold_status, starting_from, extended_days FROM bookings WHERE id = ?`,
            [booking_id]
        );

        const booking = bookingRows[0];
        const newStatus = computeAttendanceStatus(booking);

        await conn.query(
            `UPDATE bookings SET attendance_status = ? WHERE id = ?`,
            [newStatus, booking_id]
        );

        await conn.commit();
        res.json({ success: true, present_days: totalPresent, attendance_status: newStatus });

    } catch (err) {
        await conn.rollback();
        console.error('ATTENDANCE UPDATE ERROR:', err);
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
      FROM branches ORDER BY id DESC
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
      INSERT INTO branches (branch_name, address, city, state, postal_code, mobile_no, email)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [data.branch_name, data.address || '', data.city || '', data.state || '',
      data.postal_code || '', data.mobile_no || '', data.email || ''];
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
      WHERE id=?
    `;
    const values = [data.branch_name, data.address || '', data.city || '', data.state || '',
      data.postal_code || '', data.mobile_no || '', data.email || '', id];
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
    await dbPool.query('DELETE FROM branches WHERE id=?', [id]);
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
        `SELECT customer_name, car_name, starting_from FROM bookings WHERE id = ? LIMIT 1`,
        [bookingId]
      );

      if (!rows.length) continue;
      const booking = rows[0];

      images.push({
        bookingId,
        studentName: booking.customer_name,
        course: booking.car_name,
        date: booking.starting_from ? booking.starting_from.toISOString().split("T")[0] : null,
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

// ---------- START SERVER ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});


export function requireAdmin(req, res, next) {
  if (req.session && req.session.adminLoggedIn) return next();
  return res.status(401).json({ success: false, error: 'Unauthorized access' });
}