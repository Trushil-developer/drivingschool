import express from 'express';
import { dbPool } from '../server.js';
import { requireAdmin, toMySQLDate } from '../server.js';

const router = express.Router();

// ---------- GET all active cars ----------
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM cars ORDER BY id ASC');
    res.json({ success: true, cars: rows });
  } catch (err) {
    console.error('FETCH CARS ERROR:', err);
    next(err);
  }
});

// ---------- ADD a new car ----------
router.post('/', requireAdmin, async (req, res, next) => {
  const { 
    car_name, branch, car_registration_no, insurance_policy_no, insurance_company, 
    insurance_issue_date, insurance_expiry_date, puc_issue_date, puc_expiry_date,
    inactive 
  } = req.body;

  if (!car_name) return res.json({ success: false, error: 'Car name is required' });

  try {
    const [result] = await dbPool.query(`
      INSERT INTO cars 
      (car_name, branch, car_registration_no, insurance_policy_no, insurance_company,
       insurance_issue_date, insurance_expiry_date, puc_issue_date, puc_expiry_date, inactive)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      car_name, branch || '', car_registration_no || '', insurance_policy_no || null,
      insurance_company || null, toMySQLDate(insurance_issue_date),
      toMySQLDate(insurance_expiry_date), toMySQLDate(puc_issue_date), toMySQLDate(puc_expiry_date),
      inactive ? 1 : 0 
    ]);

    res.json({ success: true, car_id: result.insertId });
  } catch (err) {
    console.error('ADD CAR ERROR:', err);
    next(err);
  }
});

// ---------- UPDATE a car ----------
router.put('/:id', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { 
    car_name, branch, car_registration_no, insurance_policy_no, insurance_company, 
    insurance_issue_date, insurance_expiry_date, puc_issue_date, puc_expiry_date,
    inactive 
  } = req.body;

  if (!car_name) return res.json({ success: false, error: 'Car name is required' });

  try {
    await dbPool.query(`
      UPDATE cars SET
        car_name=?, branch=?, car_registration_no=?, insurance_policy_no=?, insurance_company=?,
        insurance_issue_date=?, insurance_expiry_date=?, puc_issue_date=?, puc_expiry_date=?, inactive=?
      WHERE id=?
    `, [
      car_name, branch || '', car_registration_no || '', insurance_policy_no || null,
      insurance_company || null, toMySQLDate(insurance_issue_date), toMySQLDate(insurance_expiry_date),
      toMySQLDate(puc_issue_date), toMySQLDate(puc_expiry_date), inactive ? 1 : 0, id
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error('UPDATE CAR ERROR:', err);
    next(err);
  }
});

// ---------- DELETE a car ----------
router.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    await dbPool.query('DELETE FROM cars WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE CAR ERROR:', err);
    next(err);
  }
});

// ---------- TOGGLE ACTIVE / INACTIVE ----------
router.patch('/:id/active', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { inactive } = req.body; // 0 = active, 1 = inactive

  if (inactive === undefined) return res.json({ success: false, error: 'inactive field is required' });

  try {
    await dbPool.query('UPDATE cars SET inactive=? WHERE id=?', [inactive ? 1 : 0, id]);
    res.json({ success: true });
  } catch (err) {
    console.error('TOGGLE CAR ACTIVE ERROR:', err);
    next(err);
  }
});


export default router;
