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
  const y = d.getFullYear(), mo = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0');
  const h = String(d.getHours()).padStart(2,'0'), min = String(d.getMinutes()).padStart(2,'0'), s = String(d.getSeconds()).padStart(2,'0');
  return `${y}-${mo}-${day} ${h}:${min}:${s}`;
}
