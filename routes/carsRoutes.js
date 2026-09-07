import express from 'express';
import { dbPool } from '../server.js';
import { requireAdmin, toMySQLDate, maxPastOdometer, ensureMeterResetsTable } from '../server.js';

const router = express.Router();

// ---------- GET all active cars ----------
router.get('/', async (req, res, next) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM cars WHERE school_id = 1 ORDER BY id ASC');
    res.json({ success: true, cars: rows });
  } catch (err) {
    console.error('FETCH CARS ERROR:', err);
    next(err);
  }
});

// ---------- ADD a new car ----------
router.post('/', requireAdmin, async (req, res, next) => {
  const {
    car_name, tag, branch, car_registration_no, insurance_policy_no, insurance_company,
    insurance_issue_date, insurance_expiry_date, puc_issue_date, puc_expiry_date,
    price_15_days, price_21_days, inactive
  } = req.body;

  if (!car_name) return res.json({ success: false, error: 'Car name is required' });

  try {
    const [result] = await dbPool.query(`
      INSERT INTO cars
      (car_name, tag, branch, car_registration_no, insurance_policy_no, insurance_company,
       insurance_issue_date, insurance_expiry_date, puc_issue_date, puc_expiry_date,
       price_15_days, price_21_days, inactive, school_id, created_by_id, created_by_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      car_name,
      tag?.trim() || null,
      branch || null,
      car_registration_no || null,
      insurance_policy_no || null,
      insurance_company || null,
      toMySQLDate(insurance_issue_date),
      toMySQLDate(insurance_expiry_date),
      toMySQLDate(puc_issue_date),
      toMySQLDate(puc_expiry_date),
      price_15_days ?? 0,
      price_21_days ?? 0,
      inactive ? 1 : 0,
      req.schoolId,
      req.session.adminId,
      req.session.adminRole || 'instructor',
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
    car_name, tag, branch, car_registration_no, insurance_policy_no, insurance_company,
    insurance_issue_date, insurance_expiry_date, puc_issue_date, puc_expiry_date,
    price_15_days, price_21_days, inactive
  } = req.body;

  if (!car_name) return res.json({ success: false, error: 'Car name is required' });

  try {
    await dbPool.query(`
      UPDATE cars SET
        car_name=?,
        tag=?,
        branch=?,
        car_registration_no=?,
        insurance_policy_no=?,
        insurance_company=?,
        insurance_issue_date=?,
        insurance_expiry_date=?,
        puc_issue_date=?,
        puc_expiry_date=?,
        price_15_days=?,
        price_21_days=?,
        inactive=?,
        updated_by_id=?,
        updated_by_type=?
      WHERE id=? AND school_id=?
    `, [
      car_name,
      tag?.trim() || null,
      branch || null,
      car_registration_no || null,
      insurance_policy_no || null,
      insurance_company || null,
      toMySQLDate(insurance_issue_date),
      toMySQLDate(insurance_expiry_date),
      toMySQLDate(puc_issue_date),
      toMySQLDate(puc_expiry_date),
      price_15_days ?? 0,
      price_21_days ?? 0,
      inactive ? 1 : 0,
      req.session.adminId,
      req.session.adminRole || 'instructor',
      id,
      req.schoolId
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
    await dbPool.query('DELETE FROM cars WHERE id=? AND school_id=?', [req.params.id, req.schoolId]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE CAR ERROR:', err);
    next(err);
  }
});

// ---------- TOGGLE ACTIVE / INACTIVE ----------
router.patch('/:id/active', requireAdmin, async (req, res, next) => {
  const { id } = req.params;
  const { inactive } = req.body;

  if (inactive === undefined) return res.json({ success: false, error: 'inactive field is required' });

  try {
    await dbPool.query(
      'UPDATE cars SET inactive=?, updated_by_id=?, updated_by_type=? WHERE id=? AND school_id=?',
      [inactive ? 1 : 0, req.session.adminId, req.session.adminRole || 'instructor', id, req.schoolId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('TOGGLE CAR ACTIVE ERROR:', err);
    next(err);
  }
});

// ---------- CAR METER: current reading + reset history ----------
// "Current meter" is the floor the next instructor reading must meet or beat
// for this car (see maxPastOdometer in server.js).
router.get('/:id/meter', requireAdmin, async (req, res, next) => {
  try {
    const [[car]] = await dbPool.query(
      'SELECT car_name FROM cars WHERE id=? AND school_id=? LIMIT 1',
      [req.params.id, req.schoolId]
    );
    if (!car || !car.car_name) return res.json({ success: false, error: 'Car not found' });

    await ensureMeterResetsTable();
    const current = await maxPastOdometer(car.car_name, req.schoolId, 0);
    const [resets] = await dbPool.query(
      `SELECT reading, note, created_at, created_by_type
       FROM car_meter_resets
       WHERE car_name=? AND school_id=?
       ORDER BY created_at DESC, id DESC
       LIMIT 10`,
      [car.car_name, req.schoolId]
    );
    res.json({ success: true, car_name: car.car_name, current_meter: current, resets });
  } catch (err) {
    console.error('CAR METER FETCH ERROR:', err);
    next(err);
  }
});

// ---------- CAR METER: reset the baseline for one car ----------
// Records a reset row; from now on the car's odometer floor is this reading
// (or any higher reading recorded after this moment). Readings entered before
// now are ignored for the floor check — this is how a wrong high reading gets
// unstuck, or a replaced odometer cluster gets a fresh start.
router.post('/:id/meter/reset', requireAdmin, async (req, res, next) => {
  const reading = Number(req.body?.reading);
  const note = (req.body?.note ?? '').toString().trim().slice(0, 255) || null;

  if (!Number.isInteger(reading) || reading < 0) {
    return res.json({ success: false, error: 'Enter a valid meter reading (a whole number, 0 or more).' });
  }

  try {
    const [[car]] = await dbPool.query(
      'SELECT car_name FROM cars WHERE id=? AND school_id=? LIMIT 1',
      [req.params.id, req.schoolId]
    );
    if (!car || !car.car_name) return res.json({ success: false, error: 'Car not found' });

    await ensureMeterResetsTable();
    await dbPool.query(
      `INSERT INTO car_meter_resets
       (school_id, car_name, reading, note, created_by_id, created_by_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.schoolId, car.car_name, reading, note, req.session.adminId, req.session.adminRole || 'admin']
    );

    const current = await maxPastOdometer(car.car_name, req.schoolId, 0);
    res.json({ success: true, current_meter: current });
  } catch (err) {
    console.error('CAR METER RESET ERROR:', err);
    next(err);
  }
});

export default router;
