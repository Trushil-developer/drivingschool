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

    // Fetch all cars with their branch
    const [allCars] = await dbPool.query(
      branch
        ? "SELECT car_name, branch FROM cars WHERE TRIM(LOWER(branch)) = ?"
        : "SELECT car_name, branch FROM cars",
      branch ? [branch.toLowerCase()] : []
    );

    if (allCars.length === 0) return res.json({ success: true, activeSlots: 0, availableSlots: 0, studentsPresent: 0, branchStats: [] });

    // Fetch candidate bookings with branch
    const bookingParams = [];
    let bookingWhere = `attendance_status IN ('Active','Pending')
      AND starting_from IS NOT NULL AND car_name IS NOT NULL AND car_name != ''`;
    if (branch) {
      bookingWhere += ` AND TRIM(LOWER(branch)) = ?`;
      bookingParams.push(branch.toLowerCase());
    }

    const [rawBookings] = await dbPool.query(
      `SELECT branch, car_name, allotted_time, allotted_time2, allotted_time3, allotted_time4,
              starting_from, training_days, present_days
       FROM bookings WHERE ${bookingWhere}`,
      bookingParams
    );

    // Apply the exact same date filter the schedule JS uses
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const bookings = rawBookings.filter(b => {
      const start = new Date(b.starting_from);
      start.setHours(0, 0, 0, 0);
      if (today < start) return false;
      const totalSessions = Number(b.training_days) || 15;
      const doneSessions  = Number(b.present_days)  || 0;
      const remaining     = totalSessions - doneSessions;
      let end;
      if (remaining < totalSessions / 2) {
        end = new Date(today);
        end.setDate(end.getDate() + remaining + 3);
      } else {
        end = new Date(start);
        end.setDate(end.getDate() + 29);
      }
      return today <= end;
    });

    // Build bookedSlots map keyed by car
    const bookedSlots = {};
    bookings.forEach(b => {
      if (!b.car_name || !b.allotted_time) return;
      const car = b.car_name.trim();
      if (!bookedSlots[car]) bookedSlots[car] = {};
      const slots = [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4]
        .filter(Boolean).sort();
      const mins = slots.map(s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; });
      let group = [mins[0]];
      const groups = [];
      for (let i = 1; i < mins.length; i++) {
        if (mins[i] === mins[i - 1] + 30) { group.push(mins[i]); }
        else { groups.push(group); group = [mins[i]]; }
      }
      groups.push(group);
      groups.forEach(g => {
        g.forEach((min, idx) => {
          const key = `${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`;
          bookedSlots[car][key] = idx === 0 ? true : 'skip';
        });
      });
    });

    // Group cars by branch
    const carsByBranch = {};
    allCars.forEach(c => {
      const b = (c.branch || '').trim();
      if (!carsByBranch[b]) carsByBranch[b] = [];
      carsByBranch[b].push(c.car_name.trim());
    });

    // Attendance per branch today
    const [attendanceRows] = await dbPool.query(`
      SELECT TRIM(b.branch) AS branch, COUNT(a.id) AS present
      FROM attendance a
      JOIN bookings b ON a.booking_id = b.id
      WHERE DATE(a.date) = CURDATE() AND a.present >= 1
      ${branch ? 'AND TRIM(LOWER(b.branch)) = ?' : ''}
      GROUP BY TRIM(b.branch)
    `, branch ? [branch.toLowerCase()] : []);

    const presentByBranch = {};
    attendanceRows.forEach(r => { presentByBranch[r.branch] = Number(r.present); });

    // Compute per-branch stats
    let totalActiveSlots = 0;
    let totalSlots = 0;
    let totalPresent = 0;
    const branchStats = Object.keys(carsByBranch).sort().map(branchName => {
      const cars = carsByBranch[branchName];
      let active = 0;
      cars.forEach(car => {
        if (bookedSlots[car]) {
          active += Object.values(bookedSlots[car]).filter(v => v !== 'skip').length;
        }
      });
      const total = cars.length * 33;
      const present = presentByBranch[branchName] || 0;
      totalActiveSlots += active;
      totalSlots += total;
      totalPresent += present;
      return { branch: branchName, activeSlots: active, totalSlots: total, present };
    });

    res.json({
      success: true,
      activeSlots: totalActiveSlots,
      availableSlots: totalSlots - totalActiveSlots,
      studentsPresent: totalPresent,
      branchStats
    });

  } catch (err) {
    console.error("TODAY SLOT STATS ERROR:", err);
    res.status(500).json({ success: false });
  }
});



/**
 * MONTHLY BOOKING TRENDS (Last 6 months)
 */
router.get("/monthly-trends", requireAdmin, async (req, res) => {
  try {
    const { branch } = req.query;

    let branchFilter = "";
    let params = [];

    if (branch) {
      branchFilter = "WHERE TRIM(LOWER(branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS bookings,
        COALESCE(SUM(total_fees), 0) AS revenue
      FROM bookings
      ${branchFilter}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6
    `, params);

    // Reverse to show oldest to newest
    res.json({ success: true, data: rows.reverse() });

  } catch (err) {
    console.error("MONTHLY TRENDS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * EXAM PERFORMANCE STATS
 */
router.get("/exam-stats", requireAdmin, async (req, res) => {
  try {
    const [[stats]] = await dbPool.query(`
      SELECT
        COUNT(*) AS totalAttempts,
        SUM(CASE WHEN result = 'PASS' THEN 1 ELSE 0 END) AS passed,
        SUM(CASE WHEN result = 'FAIL' THEN 1 ELSE 0 END) AS failed,
        ROUND(AVG(score), 1) AS avgScore
      FROM exam_attempts
      WHERE status = 'completed'
    `);

    res.json({
      success: true,
      data: {
        totalAttempts: stats.totalAttempts || 0,
        passed: stats.passed || 0,
        failed: stats.failed || 0,
        avgScore: stats.avgScore || 0
      }
    });

  } catch (err) {
    console.error("EXAM STATS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * TRAINING DAYS POPULARITY
 */
router.get("/package-popularity", requireAdmin, async (req, res) => {
  try {
    const { branch } = req.query;

    let branchFilter = "";
    let params = [];

    if (branch) {
      branchFilter = "WHERE TRIM(LOWER(branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT
        training_days AS package,
        COUNT(*) AS count
      FROM bookings
      ${branchFilter}
      GROUP BY training_days
      ORDER BY count DESC
    `, params);

    res.json({ success: true, data: rows });

  } catch (err) {
    console.error("PACKAGE POPULARITY ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * INSTRUCTOR WORKLOAD
 */
router.get("/instructor-workload", requireAdmin, async (req, res) => {
  try {
    const { branch } = req.query;

    let branchFilter = "";
    let params = [];

    if (branch) {
      branchFilter = "WHERE TRIM(LOWER(b.branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT
        b.instructor_name AS instructor,
        COUNT(*) AS activeStudents
      FROM bookings b
      ${branchFilter}
      ${branchFilter ? "AND" : "WHERE"} b.attendance_status = 'Active'
      AND b.instructor_name IS NOT NULL
      AND b.instructor_name != ''
      GROUP BY b.instructor_name
      ORDER BY activeStudents DESC
      LIMIT 10
    `, params);

    res.json({ success: true, data: rows });

  } catch (err) {
    console.error("INSTRUCTOR WORKLOAD ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * ENQUIRY TRENDS
 */
router.get("/enquiry-trends", requireAdmin, async (req, res) => {
  try {
    const { branch, heard_about, granularity = 'day' } = req.query;

    let groupBy, dateFormat;
    switch (granularity) {
      case 'day':
        groupBy = "DATE(e.created_at)";
        dateFormat = "%Y-%m-%d";
        break;
      case 'year':
        groupBy = "YEAR(e.created_at)";
        dateFormat = "%Y";
        break;
      default: // month
        groupBy = "DATE_FORMAT(e.created_at, '%Y-%m')";
        dateFormat = "%Y-%m";
    }

    let whereClause = "";
    let params = [];

    if (branch) {
      whereClause = "WHERE TRIM(LOWER(b.branch_name)) = ?";
      params.push(branch.toLowerCase());
    }

    if (heard_about) {
      whereClause += whereClause ? " AND e.hear_about = ?" : " WHERE e.hear_about = ?";
      params.push(heard_about);
    }

    const [rows] = await dbPool.query(`
      SELECT
        ${granularity === 'year' ? 'YEAR(e.created_at)' : (granularity === 'day' ? 'DATE(e.created_at)' : "DATE_FORMAT(e.created_at, '%Y-%m')")} AS period,
        COUNT(*) AS count
      FROM enquiries e
      LEFT JOIN branches b ON e.branch_id = b.id
      ${whereClause}
      GROUP BY period
      ORDER BY period DESC
      LIMIT ${granularity === 'day' ? 30 : (granularity === 'year' ? 10 : 12)}
    `, params);

    res.json({ success: true, data: rows.reverse() });

  } catch (err) {
    console.error("ENQUIRY TRENDS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * GET UNIQUE HEARD_ABOUT VALUES
 */
router.get("/heard-about-options", requireAdmin, async (req, res) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT DISTINCT hear_about FROM enquiries
      WHERE hear_about IS NOT NULL AND hear_about != ''
      ORDER BY hear_about
    `);
    res.json({ success: true, data: rows.map(r => r.hear_about) });
  } catch (err) {
    console.error("HEARD ABOUT OPTIONS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * ENROLLMENT TRENDS (with granularity)
 */
router.get("/enrollment-trends", requireAdmin, async (req, res) => {
  try {
    const { branch, granularity = 'day' } = req.query;

    let groupBy;
    switch (granularity) {
      case 'day':
        groupBy = "DATE(created_at)";
        break;
      case 'year':
        groupBy = "YEAR(created_at)";
        break;
      default: // month
        groupBy = "DATE_FORMAT(created_at, '%Y-%m')";
    }

    let whereClause = "";
    let params = [];

    if (branch) {
      whereClause = "WHERE TRIM(LOWER(branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT
        ${granularity === 'year' ? 'YEAR(created_at)' : (granularity === 'day' ? 'DATE(created_at)' : "DATE_FORMAT(created_at, '%Y-%m')")} AS period,
        COUNT(*) AS count,
        COALESCE(SUM(total_fees), 0) AS revenue
      FROM bookings
      ${whereClause}
      GROUP BY period
      ORDER BY period DESC
      LIMIT ${granularity === 'day' ? 30 : (granularity === 'year' ? 10 : 12)}
    `, params);

    res.json({ success: true, data: rows.reverse() });

  } catch (err) {
    console.error("ENROLLMENT TRENDS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * ATTENDANCE TRENDS
 */
router.get("/attendance-trends", requireAdmin, async (req, res) => {
  try {
    const { branch, granularity = 'day' } = req.query;

    let groupBy;
    switch (granularity) {
      case 'day':
        groupBy = "DATE(a.date)";
        break;
      case 'year':
        groupBy = "YEAR(a.date)";
        break;
      default: // month
        groupBy = "DATE_FORMAT(a.date, '%Y-%m')";
    }

    let whereClause = "";
    let params = [];

    if (branch) {
      whereClause = "WHERE TRIM(LOWER(b.branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT
        ${granularity === 'year' ? 'YEAR(a.date)' : (granularity === 'day' ? 'DATE(a.date)' : "DATE_FORMAT(a.date, '%Y-%m')")} AS period,
        SUM(CASE WHEN a.present >= 1 THEN 1 ELSE 0 END) AS present_count,
        SUM(a.present) AS total_slots,
        SUM(CASE WHEN a.present = 0 THEN 1 ELSE 0 END) AS absent_count,
        COUNT(*) AS total
      FROM attendance a
      JOIN bookings b ON a.booking_id = b.id
      ${whereClause}
      GROUP BY period
      ORDER BY period DESC
      LIMIT ${granularity === 'day' ? 30 : (granularity === 'year' ? 10 : 12)}
    `, params);

    res.json({ success: true, data: rows.reverse() });

  } catch (err) {
    console.error("ATTENDANCE TRENDS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

export default router;
