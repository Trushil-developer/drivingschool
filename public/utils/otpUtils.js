import crypto from "crypto";

/**
 * Generate a numeric OTP of specified length
 * @param {number} length - Number of digits, default 4
 * @returns {string} OTP code
 */
export function generateOTP(length = 4) {
  const max = 10 ** length;
  const otp = crypto.randomInt(0, max).toString().padStart(length, '0');
  return otp;
}

/**
 * Generate expiry timestamp in MySQL DATETIME format
 * @param {number} minutes - Minutes until expiry
 * @returns {string} MySQL DATETIME string
 */
export function getExpiryTime(minutes = 10) {
  const d = new Date();
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString().slice(0, 19).replace('T', ' '); // 'YYYY-MM-DD HH:MM:SS'
}
