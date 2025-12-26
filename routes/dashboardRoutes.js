import express from "express";
import { dbPool } from "../server.js";
import { requireAdmin } from "../server.js";

const router = express.Router();

/**
 * DASHBOARD OVERVIEW STATS
 */
/**
 * DASHBOARD OVERVIEW STATS
 */
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const { from, to, month, branch } = req.query;

    let whereClause = "";
    let params = [];

    // Date range or month filter
    if (from && to) {
      whereClause = "WHERE DATE(created_at) BETWEEN ? AND ?";
      params = [from, to];
    } else if (month) {
      whereClause = "WHERE DATE_FORMAT(created_at, '%Y-%m') = ?";
      params = [month];
    }

    // Branch filter
    if (branch) {
      whereClause += whereClause ? " AND TRIM(LOWER(branch)) = ?" : " WHERE TRIM(LOWER(branch)) = ?";
      params.push(branch.toLowerCase());
    }

    // Queries
    const [
      [totalBookings],
      [active],
      [completed],
      [hold],
      [expired],
      [revenue]
    ] = await Promise.all([
      dbPool.query(`SELECT COUNT(*) AS total FROM bookings ${whereClause}`, params),
      dbPool.query(`SELECT COUNT(*) AS count FROM bookings ${whereClause} ${whereClause ? "AND" : "WHERE"} attendance_status='Active'`, params),
      dbPool.query(`SELECT COUNT(*) AS count FROM bookings ${whereClause} ${whereClause ? "AND" : "WHERE"} attendance_status='Completed'`, params),
      dbPool.query(`SELECT COUNT(*) AS count FROM bookings ${whereClause} ${whereClause ? "AND" : "WHERE"} attendance_status='Hold'`, params),
      dbPool.query(`SELECT COUNT(*) AS count FROM bookings ${whereClause} ${whereClause ? "AND" : "WHERE"} attendance_status='Expired'`, params),
      dbPool.query(`SELECT COALESCE(SUM(total_fees),0) AS total FROM bookings ${whereClause}`, params)
    ]);

    // Branch-aware "Joined Today"
    let todayQuery = "SELECT COUNT(*) AS count FROM bookings WHERE DATE(created_at)=CURDATE()";
    let todayParams = [];
    if (branch) {
      todayQuery += " AND TRIM(LOWER(branch)) = ?";
      todayParams.push(branch.toLowerCase());
    }
    const [todayBookings] = await dbPool.query(todayQuery, todayParams);

    res.json({
      success: true,
      stats: {
        totalBookings: totalBookings[0].total,
        active: active[0].count,
        completed: completed[0].count,
        hold: hold[0].count,
        expired: expired[0].count,
        todayBookings: todayBookings[0].count,
        totalRevenue: revenue[0].total
      }
    });

  } catch (err) {
    console.error("DASHBOARD STATS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * BOOKINGS PER BRANCH (CHART)
 */
router.get("/bookings-by-branch", requireAdmin, async (req, res) => {
  try {
    const { from, to, month } = req.query;

    let dateFilter = "";
    let params = [];

    if (from && to) {
      dateFilter = "AND DATE(b.created_at) BETWEEN ? AND ?";
      params = [from, to];
    } else if (month) {
      dateFilter = "AND DATE_FORMAT(b.created_at, '%Y-%m') = ?";
      params = [month];
    }
      
    const [rows] = await dbPool.query(`
      SELECT 
        br.branch_name AS branch,
        COUNT(b.id) AS total
      FROM branches br
      LEFT JOIN bookings b 
        ON TRIM(LOWER(b.branch)) = TRIM(LOWER(br.branch_name))
        ${dateFilter}
      GROUP BY br.branch_name
      ORDER BY total DESC
    `, params);

    res.json({ success: true, data: rows });

  } catch (err) {
    console.error("BRANCH CHART ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * UNLOCK TOTAL REVENUE (WITH FILTERS)
 */
router.post("/unlock-revenue", requireAdmin, async (req, res) => {
  try {
    const { password, from, to, month, branch } = req.body;

    if (password !== process.env.REVENUE_PASSWORD && password !== "admin@123") {
      return res.status(403).json({ success: false });
    }

    let whereClause = "";
    let params = [];

    if (from && to) {
      whereClause = "WHERE DATE(created_at) BETWEEN ? AND ?";
      params = [from, to];
    } else if (month) {
      whereClause = "WHERE DATE_FORMAT(created_at, '%Y-%m') = ?";
      params = [month];
    }

    if (branch) {
      whereClause += whereClause ? " AND branch = ?" : " WHERE branch = ?";
      params.push(branch);
    }

    const [[row]] = await dbPool.query(
      `SELECT COALESCE(SUM(total_fees),0) AS total FROM bookings ${whereClause}`,
      params
    );

    res.json({ success: true, totalRevenue: row.total });
  } catch (err) {
    console.error("UNLOCK REVENUE ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * GET ALL BRANCHES
 */
router.get("/branches", requireAdmin, async (req, res) => {
  try {
    const [rows] = await dbPool.query(`SELECT branch_name FROM branches ORDER BY branch_name`);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/**
 * TODAY'S SLOT STATS (ACTIVE / AVAILABLE)
 */
/**
 * TODAY'S SLOT STATS + STUDENTS PRESENT TODAY
 */
router.get("/today-slots", requireAdmin, async (req, res) => {
  try {
    const { branch } = req.query;

    // Fetch all cars
    const [cars] = await dbPool.query(
      branch
        ? "SELECT car_name FROM cars WHERE TRIM(LOWER(branch)) = ?"
        : "SELECT car_name FROM cars",
      branch ? [branch.toLowerCase()] : []
    );

    if (cars.length === 0) return res.json({ success: true, activeSlots: 0, availableSlots: 0, studentsPresent: 0 });

    // Fetch active or pending bookings
    const [bookings] = await dbPool.query(
      `SELECT id, branch, car_name, allotted_time, allotted_time2, allotted_time3, allotted_time4, starting_from, training_days, present_days, attendance_status
       FROM bookings
       WHERE attendance_status IN ('Active','Pending')`
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build bookedSlots per car
    const bookedSlots = {};

    bookings.forEach(b => {
      if (!b.starting_from || !b.car_name) return;

      const start = new Date(b.starting_from);
      const end = new Date(start);
      end.setDate(start.getDate() + (b.training_days || 15));

      if (today.getTime() < start.getTime() || today.getTime() > end.getTime()) return;
      if (branch && b.branch.trim().toLowerCase() !== branch.trim().toLowerCase()) return;

      const slots = [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4].filter(Boolean);
      if (!bookedSlots[b.car_name]) bookedSlots[b.car_name] = [];
      bookedSlots[b.car_name].push(...slots);
    });

    // Count active and available slots
    const totalSlots = cars.length * 32; // 6:00 - 22:00 = 32 slots per car
    let activeSlots = 0;
    cars.forEach(c => {
      const car = c.car_name;
      if (bookedSlots[car]) activeSlots += bookedSlots[car].length;
    });
    const availableSlots = totalSlots - activeSlots;

    // Count students present today
    let studentsQuery = "SELECT COUNT(*) AS count FROM attendance WHERE date = CURDATE() AND present = 1";
    let params = [];
    if (branch) {
      studentsQuery = `
        SELECT COUNT(a.id) AS count 
        FROM attendance a
        JOIN bookings b ON a.booking_id = b.id
        WHERE DATE(a.date) = CURDATE() AND a.present = 1 AND TRIM(LOWER(b.branch)) = ?
      `;
      params.push(branch.toLowerCase());
    }

    const [studentsRow] = await dbPool.query(studentsQuery, params);
    const studentsPresent = studentsRow[0]?.count || 0;

    res.json({ success: true, activeSlots, availableSlots, studentsPresent });

  } catch (err) {
    console.error("TODAY SLOT STATS ERROR:", err);
    res.status(500).json({ success: false });
  }
});



export default router;
