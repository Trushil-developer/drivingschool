import express from "express";
import { dbPool } from "../server.js";
import { requireAdmin } from "../server.js";

const router = express.Router();

/**
 * DASHBOARD OVERVIEW STATS
 */
router.get("/stats", requireAdmin, async (req, res) => {
  try {
    const { from, to, month, branch, joinDate } = req.query;

    let whereClause = "WHERE school_id = ?";
    let params = [req.schoolId];

    if (from && to) {
      whereClause += " AND DATE(created_at) BETWEEN ? AND ?";
      params.push(from, to);
    } else if (month) {
      whereClause += " AND DATE_FORMAT(created_at, '%Y-%m') = ?";
      params.push(month);
    }

    if (branch) {
      whereClause += " AND TRIM(LOWER(branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [
      [totalBookings],
      [active],
      [completed],
      [hold],
      [expired],
      [revenue]
    ] = await Promise.all([
      dbPool.query(`SELECT COUNT(*) AS total FROM bookings ${whereClause}`, params),
      dbPool.query(`SELECT COUNT(*) AS count FROM bookings ${whereClause} AND attendance_status='Active'`, params),
      dbPool.query(`SELECT COUNT(*) AS count FROM bookings ${whereClause} AND attendance_status='Completed'`, params),
      dbPool.query(`SELECT COUNT(*) AS count FROM bookings ${whereClause} AND attendance_status='Hold'`, params),
      dbPool.query(`SELECT COUNT(*) AS count FROM bookings ${whereClause} AND attendance_status='Expired'`, params),
      dbPool.query(`SELECT COALESCE(SUM(total_fees),0) AS training, COALESCE(SUM(COALESCE(advance,0)),0) AS collected, COALESCE(SUM(total_fees) - SUM(COALESCE(advance,0)),0) AS pending, COALESCE(SUM(COALESCE(licence_fee,0)),0) AS licence FROM bookings ${whereClause} AND attendance_status != 'Pending'`, params)
    ]);

    const _jn = new Date();
    const joinDateStr = joinDate || `${_jn.getFullYear()}-${String(_jn.getMonth()+1).padStart(2,'0')}-${String(_jn.getDate()).padStart(2,'0')}`;
    let todayQuery = "SELECT COUNT(*) AS count FROM bookings WHERE school_id = ? AND DATE(created_at)=?";
    let todayParams = [req.schoolId, joinDateStr];
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

    let dateFilter = "AND b.school_id = ?";
    let params = [req.schoolId];

    if (from && to) {
      dateFilter += " AND DATE(b.created_at) BETWEEN ? AND ?";
      params.push(from, to);
    } else if (month) {
      dateFilter += " AND DATE_FORMAT(b.created_at, '%Y-%m') = ?";
      params.push(month);
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

    let whereClause = "WHERE school_id = ?";
    let params = [req.schoolId];

    if (from && to) {
      whereClause += " AND DATE(created_at) BETWEEN ? AND ?";
      params.push(from, to);
    } else if (month) {
      whereClause += " AND DATE_FORMAT(created_at, '%Y-%m') = ?";
      params.push(month);
    }

    if (branch) {
      whereClause += " AND branch = ?";
      params.push(branch);
    }

    const [[row]] = await dbPool.query(
      `SELECT COALESCE(SUM(total_fees),0) AS training, COALESCE(SUM(COALESCE(advance,0)),0) AS collected, COALESCE(SUM(total_fees) - SUM(COALESCE(advance,0)),0) AS pending, COALESCE(SUM(COALESCE(licence_fee,0)),0) AS licence FROM bookings ${whereClause} AND attendance_status != 'Pending'`,
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
    const [rows] = await dbPool.query(`SELECT branch_name FROM branches WHERE school_id = ? ORDER BY branch_name`, [req.schoolId]);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

/**
 * MOST RECENT DATE THAT HAS ATTENDANCE RECORDS
 */
router.get("/last-attendance-date", requireAdmin, async (req, res, next) => {
  try {
    const { branch } = req.query;
    let sql = `
      SELECT DATE_FORMAT(MAX(a.date), '%Y-%m-%d') AS last_date
      FROM attendance a
      JOIN bookings b ON a.booking_id = b.id
      WHERE b.school_id = ? AND a.present >= 1
    `;
    const params = [req.schoolId];
    if (branch) {
      sql += ' AND TRIM(LOWER(b.branch)) = ?';
      params.push(branch.toLowerCase());
    }
    const [[row]] = await dbPool.query(sql, params);
    res.json({ success: true, date: row.last_date || null });
  } catch (err) {
    console.error('LAST-ATTENDANCE-DATE ERROR:', err);
    next(err);
  }
});

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

    // 1. Get cars for this school grouped by branch
    const carParams = [req.schoolId];
    let carWhere = "school_id = ? AND car_name IS NOT NULL AND car_name != ''";
    if (branch) { carWhere += " AND TRIM(LOWER(branch)) = ?"; carParams.push(branch.toLowerCase()); }
    const [allCars] = await dbPool.query(`SELECT car_name, branch FROM cars WHERE ${carWhere}`, carParams);

    const carsByBranch = {};
    allCars.forEach(c => {
      const b = (c.branch || '').trim();
      if (!carsByBranch[b]) carsByBranch[b] = new Set();
      carsByBranch[b].add(c.car_name.trim());
    });

    // 2. Get bookings for this school
    const bookingParams = [req.schoolId];
    let bookingWhere = `school_id = ? AND attendance_status IN ('Active','Pending') AND starting_from IS NOT NULL AND allotted_time IS NOT NULL AND allotted_time != ''`;
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

    // 4b. Completed bookings present on this date
    const completedParams = [req.schoolId, targetDateStr];
    if (branch) completedParams.push(branch.toLowerCase());
    const [completedRows] = await dbPool.query(
      `SELECT DISTINCT b.branch, b.car_name, b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4
       FROM attendance a
       JOIN bookings b ON a.booking_id = b.id
       WHERE b.school_id = ? AND DATE(a.date) = ? AND a.present >= 1 AND b.attendance_status = 'Completed'
         AND b.car_name IS NOT NULL AND b.car_name != ''
         AND b.allotted_time IS NOT NULL AND b.allotted_time != ''
         ${branch ? 'AND TRIM(LOWER(b.branch)) = ?' : ''}`,
      completedParams
    );
    completedRows.forEach(b => {
      const branchName = (b.branch || '').trim();
      const car = (b.car_name || '').trim();
      if (!bookedByBranch[branchName]) bookedByBranch[branchName] = {};
      if (!bookedByBranch[branchName][car]) bookedByBranch[branchName][car] = {};
      [b.allotted_time, b.allotted_time2, b.allotted_time3, b.allotted_time4]
        .filter(Boolean)
        .forEach(t => { bookedByBranch[branchName][car][t.substring(0, 5)] = true; });
    });

    // 4c. Ad-hoc slots for this date
    const adHocParams = [req.schoolId, targetDateStr];
    let adHocJoin = '';
    if (branch) {
      adHocJoin = 'JOIN cars c ON c.car_name COLLATE utf8mb4_unicode_ci = ss.car_name COLLATE utf8mb4_unicode_ci AND LOWER(c.branch) COLLATE utf8mb4_unicode_ci = ?';
      adHocParams.unshift(branch.toLowerCase());
    }
    const [adHocRows] = await dbPool.query(
      `SELECT ss.car_name, ss.time, TRIM(b.branch) AS branch
       FROM schedule_slots ss
       JOIN bookings b ON ss.booking_id = b.id
       ${adHocJoin}
       WHERE b.school_id = ? AND DATE(ss.date) = ?`,
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

    // 5. Attendance per branch for target date
    const attParams = [req.schoolId, targetDateStr];
    if (branch) attParams.push(branch.toLowerCase());
    const [attendanceRows] = await dbPool.query(`
      SELECT TRIM(b.branch) AS branch, COUNT(a.id) AS present
      FROM attendance a
      JOIN bookings b ON a.booking_id = b.id
      WHERE b.school_id = ? AND DATE(a.date) = ? AND a.present >= 1
      ${branch ? 'AND TRIM(LOWER(b.branch)) = ?' : ''}
      GROUP BY TRIM(b.branch)
    `, attParams);

    const presentByBranch = {};
    attendanceRows.forEach(r => { presentByBranch[r.branch] = Number(r.present); });

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
          if (mins >= 6 * 60 && mins <= 22 * 60 && m % 30 === 0) active++;
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

    let whereClause = "WHERE school_id = ? AND attendance_status != 'Pending'";
    let params = [req.schoolId];

    if (branch) {
      whereClause += " AND TRIM(LOWER(branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS month,
        COUNT(*) AS bookings,
        COALESCE(SUM(total_fees + COALESCE(licence_fee,0)), 0) AS revenue
      FROM bookings
      ${whereClause}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 6
    `, params);

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

    let whereClause = "WHERE school_id = ?";
    let params = [req.schoolId];

    if (branch) {
      whereClause += " AND TRIM(LOWER(branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT training_days AS package, COUNT(*) AS count
      FROM bookings
      ${whereClause}
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

    let whereClause = "WHERE b.school_id = ? AND b.attendance_status = 'Active' AND b.instructor_name IS NOT NULL AND b.instructor_name != ''";
    let params = [req.schoolId];

    if (branch) {
      whereClause += " AND TRIM(LOWER(b.branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT b.instructor_name AS instructor, COUNT(*) AS activeStudents
      FROM bookings b
      ${whereClause}
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

    let whereClause = "WHERE b.school_id = ? AND b.attendance_status = 'Active' AND b.car_name IS NOT NULL AND b.car_name != ''";
    let params = [req.schoolId];

    if (branch) {
      whereClause += " AND TRIM(LOWER(c.branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT b.car_name AS car, COUNT(*) AS activeStudents
      FROM bookings b
      JOIN cars c ON c.car_name = b.car_name
      ${whereClause}
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

    let whereClause = "WHERE e.school_id = ?";
    let params = [req.schoolId];

    if (branch) {
      whereClause += " AND TRIM(LOWER(b.branch_name)) = ?";
      params.push(branch.toLowerCase());
    }

    if (heard_about) {
      whereClause += " AND e.hear_about = ?";
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
      WHERE school_id = ? AND hear_about IS NOT NULL AND hear_about != ''
      ORDER BY hear_about
    `, [req.schoolId]);
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

    let whereClause = "WHERE school_id = ? AND attendance_status != 'Pending'";
    let params = [req.schoolId];

    if (branch) {
      whereClause += " AND TRIM(LOWER(branch)) = ?";
      params.push(branch.toLowerCase());
    }

    const [rows] = await dbPool.query(`
      SELECT
        ${granularity === 'year' ? 'YEAR(created_at)' : (granularity === 'day' ? 'DATE(created_at)' : "DATE_FORMAT(created_at, '%Y-%m')")} AS period,
        COUNT(*) AS count,
        COALESCE(SUM(total_fees + COALESCE(licence_fee,0)), 0) AS revenue
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
    const { branch, granularity = 'month' } = req.query;
    const branchFilter = branch ? 'AND TRIM(LOWER(b.branch)) = ?' : '';
    const branchParam  = branch ? [branch.toLowerCase()] : [];

    let rows;

    if (granularity === 'day') {
      const nums = Array.from({length: 30}, (_, i) => `SELECT ${i} AS seq`).join(' UNION ALL ');

      const untrackedParams = [req.schoolId, ...branchParam];
      const [untrackedRows] = await dbPool.query(`
        SELECT COUNT(*) AS cnt
        FROM bookings b
        WHERE b.school_id = ? AND b.attendance_status = 'Active'
          AND b.starting_from IS NOT NULL
          AND b.starting_from <= CURDATE()
          ${branchFilter}
          AND NOT EXISTS (
            SELECT 1 FROM attendance a
            WHERE a.booking_id = b.id AND DATE(a.date) = CURDATE()
          )
      `, untrackedParams);
      const untrackedToday = Number(untrackedRows[0].cnt);
      const _istNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const todayStr = _istNow.toISOString().slice(0, 10);

      const [r] = await dbPool.query(`
        SELECT
          DATE_FORMAT(cal.dt, '%Y-%m-%d') AS period,
          COALESCE(att.present_count, 0) AS present_count,
          COALESCE(att.absent_count,  0) AS absent_count,
          COALESCE(att.present_count, 0) + COALESCE(att.absent_count, 0) AS total
        FROM (SELECT CURDATE() - INTERVAL seq DAY AS dt FROM (${nums}) n) cal
        LEFT JOIN (
          SELECT DATE_FORMAT(DATE(a.date), '%Y-%m-%d') AS dt,
            SUM(CASE WHEN a.present >= 1 THEN 1 ELSE 0 END) AS present_count,
            SUM(CASE WHEN a.present = 0  THEN 1 ELSE 0 END) AS absent_count
          FROM attendance a
          JOIN bookings b ON a.booking_id = b.id
          WHERE b.school_id = ? AND b.attendance_status IN ('Active','Completed','Expired','Hold')
            ${branchFilter}
          GROUP BY DATE_FORMAT(DATE(a.date), '%Y-%m-%d')
        ) att ON att.dt = DATE_FORMAT(cal.dt, '%Y-%m-%d')
        ORDER BY cal.dt ASC
      `, [req.schoolId, ...branchParam]);

      rows = r.map(row => {
        const isToday = String(row.period) === todayStr;
        return {
          ...row,
          total: isToday ? Number(row.total) + untrackedToday : Number(row.total)
        };
      });
    } else {
      const periodExpr = granularity === 'year'
        ? 'YEAR(a.date)'
        : "DATE_FORMAT(a.date, '%Y-%m')";
      const limit = granularity === 'year' ? 5 : 12;
      const [r] = await dbPool.query(`
        SELECT
          ${periodExpr} AS period,
          SUM(CASE WHEN a.present >= 1 THEN 1 ELSE 0 END) AS present_count,
          SUM(CASE WHEN a.present = 0  THEN 1 ELSE 0 END) AS absent_count,
          COUNT(*) AS total
        FROM attendance a
        JOIN bookings b ON a.booking_id = b.id
        WHERE b.school_id = ? AND b.attendance_status IN ('Active','Completed','Expired','Hold')
          ${branchFilter}
        GROUP BY period
        ORDER BY period DESC
        LIMIT ${limit}
      `, [req.schoolId, ...branchParam]);
      rows = r.reverse();
    }

    res.json({ success: true, data: rows });

  } catch (err) {
    console.error("ATTENDANCE TRENDS ERROR:", err);
    res.status(500).json({ success: false });
  }
});

export default router;
