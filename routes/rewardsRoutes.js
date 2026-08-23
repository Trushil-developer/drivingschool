import express from 'express';
import { dbPool, requireAdmin, ensureRewardsLedgerTable, getInstructorRewardsBalance, REWARD_RUPEES_PER_POINT } from '../server.js';

const router = express.Router();

/*
  Admin: all instructors in this school with their current points balance
*/
router.get('/summary', requireAdmin, async (req, res) => {
  try {
    await ensureRewardsLedgerTable();
    const [rows] = await dbPool.query(
      `SELECT i.id AS instructor_id, i.employee_no, i.instructor_name,
              COALESCE(SUM(r.points), 0) AS balance
       FROM instructors i
       LEFT JOIN instructor_rewards_ledger r ON r.instructor_id = i.id
       WHERE i.school_id = ?
       GROUP BY i.id, i.employee_no, i.instructor_name
       ORDER BY i.instructor_name`,
      [req.schoolId]
    );
    const instructors = rows.map(r => ({
      ...r,
      balance: Number(r.balance),
      rupee_value: Number((Number(r.balance) * REWARD_RUPEES_PER_POINT).toFixed(2)),
    }));
    res.json({ success: true, instructors });
  } catch (err) {
    console.error('REWARDS SUMMARY ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/*
  Admin: one instructor's balance + full ledger history
*/
router.get('/:instructorId', requireAdmin, async (req, res) => {
  const { instructorId } = req.params;
  try {
    await ensureRewardsLedgerTable();
    const [[instructor]] = await dbPool.query(
      `SELECT id, employee_no, instructor_name FROM instructors WHERE id=? AND school_id=? LIMIT 1`,
      [instructorId, req.schoolId]
    );
    if (!instructor) return res.status(404).json({ success: false, error: 'Instructor not found' });

    const [history] = await dbPool.query(
      `SELECT id, trip_id, type, points, rupee_value, note, created_by_id, created_by_type, created_at
       FROM instructor_rewards_ledger WHERE instructor_id=? ORDER BY created_at DESC`,
      [instructorId]
    );
    const balance = await getInstructorRewardsBalance(instructorId);
    res.json({
      success: true,
      instructor,
      balance,
      rupee_value: Number((balance * REWARD_RUPEES_PER_POINT).toFixed(2)),
      history,
    });
  } catch (err) {
    console.error('REWARDS DETAIL ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/*
  Admin-only (not manager): withdraw/cash out points for an instructor
*/
router.post('/:instructorId/withdraw', requireAdmin, async (req, res) => {
  if (req.session.adminRole !== 'admin') {
    return res.status(403).json({ success: false, error: 'Only an admin can withdraw reward points' });
  }
  const { instructorId } = req.params;
  const points = Number(req.body?.points);
  const note = (req.body?.note || '').trim();

  if (!Number.isInteger(points) || points <= 0) {
    return res.json({ success: false, error: 'Enter a whole number of points to withdraw.' });
  }
  if (!note) {
    return res.json({ success: false, error: 'A note is required for a withdrawal.' });
  }

  let conn;
  try {
    await ensureRewardsLedgerTable();
    const [[instructor]] = await dbPool.query(
      `SELECT id FROM instructors WHERE id=? AND school_id=? LIMIT 1`,
      [instructorId, req.schoolId]
    );
    if (!instructor) return res.status(404).json({ success: false, error: 'Instructor not found' });

    conn = await dbPool.getConnection();
    await conn.beginTransaction();

    // FOR UPDATE locks every ledger row this SUM reads, so a second concurrent
    // withdrawal for the same instructor blocks here until this transaction
    // commits/rolls back, then re-reads the balance including this withdrawal —
    // preventing two simultaneous withdrawals from both passing the balance check.
    const [[balanceRow]] = await conn.query(
      `SELECT COALESCE(SUM(points), 0) AS balance FROM instructor_rewards_ledger WHERE instructor_id=? FOR UPDATE`,
      [instructorId]
    );
    const balance = Number(balanceRow.balance);
    if (points > balance) {
      await conn.rollback();
      return res.json({ success: false, error: `Cannot withdraw more than the current balance (${balance} points).` });
    }

    const rupeeValue = Number((points * REWARD_RUPEES_PER_POINT).toFixed(2));
    await conn.query(
      `INSERT INTO instructor_rewards_ledger (instructor_id, school_id, type, points, rupee_value, note, created_by_id, created_by_type)
       VALUES (?, ?, 'admin_withdraw', ?, ?, ?, ?, ?)`,
      [instructorId, req.schoolId, -points, rupeeValue, note, req.session.adminId, req.session.adminRole || 'admin']
    );

    await conn.commit();
    res.json({ success: true, balance: balance - points });
  } catch (err) {
    if (conn) await conn.rollback().catch(() => {});
    console.error('REWARDS WITHDRAW ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
