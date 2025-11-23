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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

// ---------- Create a mysql pool (used by both app and session store) ----------
const dbPool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// optional: quick check that pool can connect (non-fatal)
(async () => {
  try {
    const conn = await dbPool.getConnection();
    conn.release();
    console.log('MySQL pool created and connection verified.');
  } catch (err) {
    console.error('MySQL pool connection error (verify DB env vars):', err);
  }
})();

// ---------- Session store using the same pool ----------
const MySQLStore = MySQLStoreImport(session);
const sessionStore = new MySQLStore({}, dbPool);

// ---------- Middleware ----------
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
      secure: false, // set true if using HTTPS
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

// ---------- Helpers ----------
function toMySQLDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d)) return null;
  return d.toISOString().split('T')[0];
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.adminLoggedIn) return next();
  return res.status(401).json({ success: false, error: 'Unauthorized access' });
}

// ---------- Routes (use dbPool.query in all routes) ----------

// AUTH
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

// BOOKINGS CRUD
app.post('/api/bookings', async (req, res, next) => {
  const data = req.body;
  try {
    const sql = `
      INSERT INTO bookings (
        branch, training_days, customer_name, address, pincode, mobile_no, whatsapp_no,
        sex, birth_date, cov_lmv, cov_mc, dl_no, dl_from, dl_to, email,
        occupation, ref, allotted_time, starting_from, total_fees, advance,
        car_name, instructor_name, present_days
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
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
      data.allotted_time || null,
      toMySQLDate(data.starting_from),
      data.total_fees || 0,
      data.advance || 0,
      data.car_names || '',
      data.instructor_name || '',
      0,
    ];

    const [result] = await dbPool.query(sql, values);
    res.json({ success: true, booking_id: result.insertId });
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
        occupation, ref, allotted_time, starting_from, total_fees, advance,
        car_name, instructor_name, present_days, created_at
      FROM bookings
      ORDER BY id DESC
    `);
    res.json({ success: true, bookings: rows });
  } catch (err) {
    console.error('BOOKINGS LIST ERROR:', err);
    next(err);
  }
});

app.put('/api/bookings/:id', requireAdmin, async (req, res, next) => {
  const id = req.params.id;
  const data = req.body;
  try {
    const sql = `
      UPDATE bookings SET
        branch=?, training_days=?, customer_name=?, address=?, pincode=?, mobile_no=?, whatsapp_no=?,
        sex=?, birth_date=?, cov_lmv=?, cov_mc=?, dl_no=?, dl_from=?, dl_to=?, email=?,
        occupation=?, ref=?, allotted_time=?, starting_from=?, total_fees=?, advance=?,
        car_name=?, instructor_name=?
      WHERE id=?
    `;
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
      data.allotted_time || null,
      toMySQLDate(data.starting_from),
      data.total_fees || 0,
      data.advance || 0,
      data.car_name || '',
      data.instructor_name || '',
      id,
    ];

    await dbPool.query(sql, values);
    res.json({ success: true });
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

// ATTENDANCE
// ensure attendance table exists (idempotent)
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
  const { attendance } = req.body;

  if (!Array.isArray(attendance))
    return res.json({ success: false, error: 'attendance array required' });

  try {
    await dbPool.query('DELETE FROM attendance WHERE booking_id=?', [booking_id]);

    for (const item of attendance) {
      await dbPool.query(
        `INSERT INTO attendance (booking_id, date, present) VALUES (?, ?, 1)`,
        [booking_id, toMySQLDate(item.date)]
      );
    }

    await dbPool.query(
      `UPDATE bookings SET present_days = (
         SELECT COUNT(*) FROM attendance WHERE booking_id=? AND present=1
       ) WHERE id=?`,
      [booking_id, booking_id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('ATTENDANCE SAVE ERROR:', err);
    next(err);
  }
});

// INSTRUCTORS
app.get('/api/instructors', requireAdmin, async (req, res, next) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT id, employee_no, instructor_name, email, mobile_no, branch, 
             drivers_license, adhar_no, address
      FROM instructors
      ORDER BY id DESC
    `);
    res.json({ success: true, instructors: rows });
  } catch (err) {
    console.error('INSTRUCTORS FETCH ERROR:', err);
    next(err);
  }
});

app.post('/api/instructors', requireAdmin, async (req, res, next) => {
  const data = req.body;
  if (!data.instructor_name) return res.json({ success: false, error: 'Instructor name is required' });

  try {
    const sql = `
      INSERT INTO instructors 
        (instructor_name, email, mobile_no, branch, drivers_license, adhar_no, address)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const values = [
      data.instructor_name,
      data.email || '',
      data.mobile_no || '',
      data.branch || '',
      data.drivers_license || '',
      data.adhar_no || '',
      data.address || ''
    ];
    const [result] = await dbPool.query(sql, values);
    res.json({ success: true, instructor_id: result.insertId });
  } catch (err) {
    console.error('INSTRUCTOR CREATE ERROR:', err);
    next(err);
  }
});

app.delete('/api/instructors/:id', requireAdmin, async (req, res, next) => {
  try {
    await dbPool.query('DELETE FROM instructors WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('INSTRUCTOR DELETE ERROR:', err);
    next(err);
  }
});

// CARS
app.get('/api/cars', async (req, res, next) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM cars ORDER BY id ASC');
    res.json({ success: true, cars: rows });
  } catch (err) {
    console.error('FETCH CARS ERROR:', err);
    next(err);
  }
});

app.post('/api/cars', requireAdmin, async (req, res, next) => {
  const { car_name } = req.body;
  if (!car_name) return res.json({ success: false, error: 'Car name is required' });
  try {
    const [result] = await dbPool.query('INSERT INTO cars (car_name) VALUES (?)', [car_name]);
    res.json({ success: true, car_id: result.insertId });
  } catch (err) {
    console.error('ADD CAR ERROR:', err);
    next(err);
  }
});

app.delete('/api/cars/:id', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  try {
    await dbPool.query('DELETE FROM cars WHERE id=?', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE CAR ERROR:', err);
    next(err);
  }
});

app.put('/api/cars/:id', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { car_name } = req.body;
  if (!car_name) return res.json({ success: false, error: 'Car name is required' });
  try {
    await dbPool.query('UPDATE cars SET car_name=? WHERE id=?', [car_name, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('UPDATE CAR ERROR:', err);
    next(err);
  }
});

// ---------- Express global error handler ----------
app.use((err, req, res, next) => {
  console.error('EXPRESS ERROR:', err && (err.stack || err));
  // don't leak internal details in production
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ---------- Process-level handlers (log and keep process alive for PM2) ----------
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err && (err.stack || err));
  // do not exit; let PM2 restart if needed
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

// ---------- Start server ----------
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
