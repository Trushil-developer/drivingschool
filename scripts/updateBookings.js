// scripts/updateBookings.js
import { dbPool, computeAttendanceStatus } from '../server.js';

export default async function updateBookingsStatus() {
  console.log('Starting attendance status update...');

  try {
    // Fetch all bookings
    const [bookings] = await dbPool.query(
      `SELECT id, starting_from, training_days, present_days, hold_status FROM bookings`
    );

    // Loop through each booking and recompute attendance_status
    for (const booking of bookings) {
      const newStatus = computeAttendanceStatus(booking);

      try {
        await dbPool.query(
          `UPDATE bookings SET attendance_status = ? WHERE id = ?`,
          [newStatus, booking.id]
        );
      } catch (err) {
        console.error(`Error updating booking ID ${booking.id}:`, err);
      }
    }

    console.log('Attendance status update completed.');
  } catch (err) {
    console.error('Error in updateBookingsStatus:', err);
    throw err;
  }
}
