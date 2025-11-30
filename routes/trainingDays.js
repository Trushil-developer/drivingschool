import express from 'express';
import { dbPool } from '../server.js';
import { requireAdmin } from '../server.js'; 

const router = express.Router();

/*
  GET all training days
*/
router.get('/', async (req, res) => {
  try {
    const [rows] = await dbPool.query(`
      SELECT id, days, is_active 
      FROM training_days
      ORDER BY days ASC
    `);
    res.json({ success: true, training_days: rows });
  } catch (err) {
    console.error('TRAINING_DAYS LIST ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/*
  ADD new training days
*/
router.post('/', requireAdmin, async (req, res) => {
  const { days } = req.body;

  if (!days) return res.json({ success: false, error: 'days is required' });

  try {
    const [result] = await dbPool.query(
      `INSERT INTO training_days (days, is_active) VALUES (?, 1)`,
      [days]
    );
    res.json({ success: true, id: result.insertId });
  } catch (err) {
    console.error('TRAINING_DAYS CREATE ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/*
  UPDATE number of days
*/
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { days } = req.body;

  if (!days) return res.json({ success: false, error: 'days is required' });

  try {
    await dbPool.query(
      `UPDATE training_days SET days=? WHERE id=?`,
      [days, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('TRAINING_DAYS UPDATE ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/*
  DISABLE or ENABLE training days
*/
router.put('/:id/toggle', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  try {
    await dbPool.query(
      `UPDATE training_days SET is_active=? WHERE id=?`,
      [is_active ? 1 : 0, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('TRAINING_DAYS TOGGLE ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/*
  DELETE a training day
*/
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await dbPool.query(
      `DELETE FROM training_days WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, error: 'Training day not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('TRAINING_DAYS DELETE ERROR:', err);
    res.status(500).json({ success: false, error: 'Internal error' });
  }
});

export default router;
