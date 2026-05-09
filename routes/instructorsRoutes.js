import express from 'express';
import { dbPool, requireAdmin } from '../server.js';

const router = express.Router();

/*
  GET all instructors
*/
router.get('/', async (req, res) => {
  try {
    const role = (req.query.role || '').trim();
    const conditions = role ? ['role = ?'] : [];
    const params = role ? [role] : [];
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const [rows] = await dbPool.query(`
      SELECT id, employee_no, role, instructor_name, email, mobile_no, branch,
             drivers_license, adhar_no, address, is_active
      FROM instructors
      ${where}
      ORDER BY id DESC
    `, params);
    res.json({ success: true, instructors: rows });
  } catch (err) {
    console.error('INSTRUCTORS LIST ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/*
  ADD new instructor
*/
router.post('/', requireAdmin, async (req, res) => {
  const { instructor_name, email, mobile_no, branch, drivers_license, adhar_no, address, role } = req.body;

  if (!instructor_name) return res.json({ success: false, error: 'Employee name is required' });

  try {
    const [result] = await dbPool.query(`
      INSERT INTO instructors
      (instructor_name, email, mobile_no, branch, drivers_license, adhar_no, address, role, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [instructor_name, email || '', mobile_no || '', branch || '', drivers_license || '', adhar_no || '', address || '', role || 'Instructor']);

    const newId = result.insertId;
    const employee_no = `EMP${String(newId).padStart(3, '0')}`;
    await dbPool.query(`UPDATE instructors SET employee_no = ? WHERE id = ?`, [employee_no, newId]);

    res.json({ success: true, instructor_id: newId, employee_no });
  } catch (err) {
    console.error('INSTRUCTOR CREATE ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/*
  UPDATE instructor
*/
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { instructor_name, email, mobile_no, branch, drivers_license, adhar_no, address, role } = req.body;

  if (!instructor_name) return res.json({ success: false, error: 'Employee name is required' });

  try {
    await dbPool.query(`
      UPDATE instructors SET
        instructor_name=?, email=?, mobile_no=?, branch=?, drivers_license=?, adhar_no=?, address=?, role=?
      WHERE id=?
    `, [instructor_name, email || '', mobile_no || '', branch || '', drivers_license || '', adhar_no || '', address || '', role || 'Instructor', id]);

    res.json({ success: true });
  } catch (err) {
    console.error('INSTRUCTOR UPDATE ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/*
  TOGGLE instructor active/inactive
*/
router.patch('/:id/active', requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { is_active } = req.body;
    try {
        await dbPool.query(`UPDATE instructors SET is_active=? WHERE id=?`, [is_active ? 1 : 0, id]);
        res.json({ success: true });
    } catch(err) {
        console.error('INSTRUCTOR STATUS TOGGLE ERROR:', err);
        res.status(500).json({ success: false, error: 'Internal error' });
    }
});

/*
  DELETE instructor
*/
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await dbPool.query('DELETE FROM instructors WHERE id=?', [id]);

    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Instructor not found' });

    res.json({ success: true });
  } catch (err) {
    console.error('INSTRUCTOR DELETE ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
