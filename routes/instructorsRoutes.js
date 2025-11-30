import express from 'express';
import { dbPool, requireAdmin } from '../server.js';

const router = express.Router();

/*
  GET all instructors
*/
router.get('/', async (req, res) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT id, employee_no, instructor_name, email, mobile_no, branch, 
             drivers_license, adhar_no, address, is_active
      FROM instructors
      ORDER BY id DESC
    `);
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
  const { instructor_name, email, mobile_no, branch, drivers_license, adhar_no, address } = req.body;

  if (!instructor_name) return res.json({ success: false, error: 'Instructor name is required' });

  try {
    const [result] = await dbPool.query(`
      INSERT INTO instructors 
      (instructor_name, email, mobile_no, branch, drivers_license, adhar_no, address, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `, [instructor_name, email || '', mobile_no || '', branch || '', drivers_license || '', adhar_no || '', address || '']);

    res.json({ success: true, instructor_id: result.insertId });
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
  const { instructor_name, email, mobile_no, branch, drivers_license, adhar_no, address } = req.body;

  if (!instructor_name) return res.json({ success: false, error: 'Instructor name is required' });

  try {
    await dbPool.query(`
      UPDATE instructors SET
        instructor_name=?, email=?, mobile_no=?, branch=?, drivers_license=?, adhar_no=?, address=?
      WHERE id=?
    `, [instructor_name, email || '', mobile_no || '', branch || '', drivers_license || '', adhar_no || '', address || '', id]);

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
