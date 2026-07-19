import mysql from 'mysql2/promise';
import { sign as cookieSign } from 'cookie-signature';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config({ path: '/Users/trushil/Documents/drivingschool/.env' });

const conn = await mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const sessionId = crypto.randomBytes(24).toString('hex');
const expires = Math.floor(Date.now() / 1000) + 3600;
const data = JSON.stringify({
  cookie: { originalMaxAge: 3600000, expires: new Date(Date.now() + 3600000).toISOString(), httpOnly: true, path: '/', sameSite: 'strict' },
  adminLoggedIn: true,
  adminId: 1,
  adminRole: 'admin',
  school_id: 1,
});

await conn.query('INSERT INTO sessions (session_id, expires, data) VALUES (?, ?, ?)', [sessionId, expires, data]);

const signed = 's:' + cookieSign(sessionId, process.env.SESSION_SECRET);
const tokenHeader = `session_cookie=${encodeURIComponent(signed)}`;
console.log(tokenHeader);
console.log('SESSION_ID=' + sessionId);

await conn.end();
