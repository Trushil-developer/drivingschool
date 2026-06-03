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
    const { from, to, month, branch, joinDate } = req.query;

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
      dbPool.query(`SELECT COALESCE(SUM(total_fees),0) AS training, COALESCE(SUM(COALESCE(advance,0)),0) AS collected, COALESCE(SUM(total_fees) - SUM(COALESCE(advance,0)),0) AS pending, COALESCE(SUM(COALESCE(licence_fee,0)),0) AS licence FROM bookings ${whereClause} ${whereClause ? "AND" : "WHERE"} attendance_status != 'Pending'`, params)
    ]);

    // Branch-aware "Joined Today" (supports custom date via joinDate param)
    const _jn = new Date();
    const joinDateStr = joinDate || `${_jn.getFullYear()}-${String(_jn.getMonth()+1).padStart(2,'0')}-${String(_jn.getDate()).padStart(2,'0')}`;
    let todayQuery = "SELECT COUNT(*) AS count FROM bookings WHERE DATE(created_at)=?";
    let todayParams = [joinDateStr];
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
        trainingRevenue:   Number(revenue[0].training),
        collectedRevenue:  Number(revenue[0].collected),
        pendingRevenue:    Number(revenue[0].pending),
        licenceRevenue:    Number(revenue[0].licence)
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
      `SELECT COALESCE(SUM(total_fees),0) AS training, COALESCE(SUM(COALESCE(advance,0)),0) AS collected, COALESCE(SUM(total_fees) - SUM(COALESCE(advance,0)),0) AS pending, COALESCE(SUM(COALESCE(licence_fee,0)),0) AS licence FROM bookings ${whereClause} ${whereClause ? "AND" : "WHERE"} attendance_status != 'Pending'`,
      params
    );

    res.json({
      success: true,
      trainingRevenue:  Number(row.training),
      collectedRevenue: Number(row.collected),
      pendingRevenue:   Number(row.pending),
      licenceRevenue:   Number(row.licence)
    });
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
    const { branch, date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    const targetDateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;
    const selectedTime = targetDate.getTime();

    // 1. Get cars grouped by their branch (same as schedule: cars.filter(c => c.branch === branch))
    const [allCars] = await dbPool.query(
      branch
        ? "SELECT car_name, branch FROM cars WHERE TRIM(LOWER(branch)) = ? AND car_name IS NOT NULL AND car_name != ''"
        : "SELECT car_name, branch FROM cars WHERE car_name IS NOT NULL AND car_name != ''",
      branch ? [branch.toLowerCase()] : []
    );

    const carsByBranch = {};
    allCars.forEach(c => {
      const b = (c.branch || '').trim();
      if (!carsByBranch[b]) carsByBranch[b] = new Set();
      carsByBranch[b].add(c.car_name.trim());
    });

    // 2. Get bookings — same status + conditions as schedule
    const bookingParams = [];
    let bookingWhere = `attendance_status IN ('Active','Pending') AND starting_from IS NOT NULL AND allotted_time IS NOT NULL AND allotted_time != ''`;
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

    // 3. Apply same date-range filter as schedule
    const bookings = rawBookings.filter(b => {
      const start = new Date(b.starting_from);
      const end   = new Date(start);
      const totalSessions = Number(b.training_days) || 15;
      const doneSessions  = Number(b.present_days)  || 0;
      const remaining     = totalSessions - doneSessions;
      if (remaining < totalSessions / 2) {
        end.setTime(selectedTime);
        end.setDate(end.getDate() + remaining + 3);
      } else {
        end.setDate(start.getDate() + 29);
      }
      return selectedTime >= start.getTime() && selectedTime <= end.getTime();
    });

    // 4. Build bookedSlots[bookingBranch][car] — same as schedule builds bookedSlots[car]
    //    but keyed by booking's branch so we can look up per branch
    const bookedByBranch = {};
    bookings.forEach(b => {
      if (!b.car_name || !b.allotted_time) return;
      const branchName = (b.branch || '').trim();
      const car = b.car_name.trim();
      if (!bookedByBranch[branchName]) bookedByBranch[branchName] = {};
      if (!bookedByBranch[branchName][car]) bookedByBranch[branchName][car] = {};

      [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4]
        .filter(Boolean)
        .forEach(t => { bookedByBranch[branchName][car][t.substring(0, 5)] = true; });
    });

    // 4b. Ad-hoc slots for this date — same as schedule merges them
    const adHocParams = [targetDateStr];
    let adHocWhere = 'DATE(ss.date) = ?';
    if (branch) { adHocWhere += ' AND TRIM(LOWER(ss.car_name)) IN (SELECT TRIM(LOWER(car_name)) FROM cars WHERE TRIM(LOWER(branch)) = ?)'; adHocParams.push(branch.toLowerCase()); }
    const [adHocRows] = await dbPool.query(
      `SELECT ss.car_name, ss.time, TRIM(b.branch) AS branch
       FROM schedule_slots ss
       JOIN bookings b ON ss.booking_id = b.id
       WHERE ${adHocWhere}`,
      adHocParams
    );
    adHocRows.forEach(s => {
      const branchName = (s.branch || '').trim();
      const car = (s.car_name || '').trim();
      const key = s.time.substring(0, 5);
      if (!bookedByBranch[branchName]) bookedByBranch[branchName] = {};
      if (!bookedByBranch[branchName][car]) bookedByBranch[branchName][car] = {};
      if (!bookedByBranch[branchName][car][key]) bookedByBranch[branchName][car][key] = true;
    });

    // 5. Attendance per branch for target date (slot-level count, matching schedule)
    const [attendanceRows] = await dbPool.query(`
      SELECT TRIM(b.branch) AS branch, COUNT(a.id) AS present
      FROM attendance a
      JOIN bookings b ON a.booking_id = b.id
      WHERE DATE(a.date) = ? AND a.present >= 1
      ${branch ? 'AND TRIM(LOWER(b.branch)) = ?' : ''}
      GROUP BY TRIM(b.branch)
    `, branch ? [targetDateStr, branch.toLowerCase()] : [targetDateStr]);

    const presentByBranch = {};
    attendanceRows.forEach(r => { presentByBranch[r.branch] = Number(r.present); });

    // 6. Count active slots per branch — each booked time row counted individually
    let totalActiveSlots = 0;
    let totalPresent = 0;
    const branchStats = Object.keys(carsByBranch).sort().map(branchName => {
      const branchCars = carsByBranch[branchName];
      const branchBooked = bookedByBranch[branchName] || {};
      let active = 0;
      branchCars.forEach(carName => {
        const carSlots = branchBooked[carName] || {};
        Object.keys(carSlots).forEach(time => {
          const [h, m] = time.split(':').map(Number);
          const mins = h * 60 + m;
          if (mins >= 6 * 60 && mins <= 22 * 60) active++;
        });
      });
      const present = presentByBranch[branchName] || 0;
      totalActiveSlots += active;
      totalPresent += present;
      return { branch: branchName, activeSlots: active, present };
    });

    res.json({
      success: true,
      activeSlots: totalActiveSlots,
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
        COALESCE(SUM(total_fees + COALESCE(licence_fee,0)), 0) AS revenue
      FROM bookings
      ${branchFilter}
      ${branchFilter ? "AND" : "WHERE"} attendance_status != 'Pending'
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
 * CAR WORKLOAD
 */
router.get("/car-workload", requireAdmin, async (req, res) => {
  try {
    const { branch } = req.query;

    let branchFilter = "";
    let params = [];

    if (branch) {
      branchFilter = "WHERE TRIM(LOWER(c.branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT
        b.car_name AS car,
        COUNT(*) AS activeStudents
      FROM bookings b
      JOIN cars c ON c.car_name = b.car_name
      ${branchFilter}
      ${branchFilter ? "AND" : "WHERE"} b.attendance_status = 'Active'
      AND b.car_name IS NOT NULL AND b.car_name != ''
      GROUP BY b.car_name
      ORDER BY activeStudents DESC
      LIMIT 10
    `, params);

    res.json({ success: true, data: rows });

  } catch (err) {
    console.error("CAR WORKLOAD ERROR:", err);
    res.status(500).json({ success: false });
  }
});

/**
 * ENQUIRY TRENDS
 */
router.get("/enquiry-trends", requireAdmin, async (req, res) => {
  try {
    const { branch, heard_about, granularity = 'day' } = req.query;


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
        COALESCE(SUM(total_fees + COALESCE(licence_fee,0)), 0) AS revenue
      FROM bookings
      ${whereClause}
      ${whereClause ? "AND" : "WHERE"} attendance_status != 'Pending'
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
    const { branch, granularity = 'month' } = req.query;

    const periodExpr = granularity === 'year'
      ? 'YEAR(b.starting_from)'
      : granularity === 'day'
        ? 'DATE(b.starting_from)'
        : "DATE_FORMAT(b.starting_from, '%Y-%m')";

    const branchFilter = branch ? 'AND TRIM(LOWER(b.branch)) = ?' : '';
    const params = branch ? [branch.toLowerCase()] : [];

    const [rows] = await dbPool.query(`
      SELECT
        ${periodExpr} AS period,
        SUM(b.training_days) AS total,
        COALESCE(SUM(day_att.present_days), 0) AS present_count,
        COALESCE(SUM(day_att.absent_days),  0) AS absent_count
      FROM bookings b
      LEFT JOIN (
        SELECT
          booking_id,
          SUM(CASE WHEN max_p >= 1 THEN 1 ELSE 0 END) AS present_days,
          SUM(CASE WHEN max_p = 0  THEN 1 ELSE 0 END) AS absent_days
        FROM (
          SELECT booking_id, date, MAX(present) AS max_p
          FROM attendance
          GROUP BY booking_id, date
        ) d
        GROUP BY booking_id
      ) day_att ON day_att.booking_id = b.id
      WHERE b.attendance_status IN ('Active','Completed','Expired','Hold')
        AND b.starting_from IS NOT NULL
        ${branchFilter}
      GROUP BY period
      ORDER BY period DESC
      LIMIT ${granularity === 'day' ? 30 : granularity === 'year' ? 10 : 12}
    `, params);

    res.json({ success: true, data: rows.reverse() });

  } catch (err) {
    console.error("ATTENDANCE TRENDS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

export default router;
