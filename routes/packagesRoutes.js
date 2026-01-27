import express from 'express';
import { dbPool, requireAdmin } from '../server.js'; // adjust path if needed

const router = express.Router();

/**
 * GET all driving packages (public)
 */
router.get('/', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM driving_packages ORDER BY id ASC');
    res.json({ success: true, packages: rows });
  } catch (err) {
    console.error('Fetch driving packages error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch packages' });
  }
});

/**
 * GET a single package by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await dbPool.query('SELECT * FROM driving_packages WHERE id=?', [req.params.id]);
    if (!rows.length) return res.status(404).json({ success: false, error: 'Package not found' });
    res.json({ success: true, package: rows[0] });
  } catch (err) {
    console.error('Fetch driving package error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch package' });
  }
});

/**
 * CREATE a new package (admin only)
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { badge, title, description, practical_sessions, session_duration, daily_distance, extra_features } = req.body;

    const [result] = await dbPool.query(
      `INSERT INTO driving_packages
      (badge, title, description, practical_sessions, session_duration, daily_distance, extra_features)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        badge || null,
        title,
        description || null,
        practical_sessions || null,
        session_duration || null,
        daily_distance || null,
        extra_features ? JSON.stringify(extra_features) : null
      ]
    );

    res.json({ success: true, package_id: result.insertId });
  } catch (err) {
    console.error('Create driving package error:', err);
    res.status(500).json({ success: false, error: 'Failed to create package' });
  }
});

/**
 * UPDATE a package (admin only)
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { badge, title, description, practical_sessions, session_duration, daily_distance, extra_features } = req.body;

    await dbPool.query(
      `UPDATE driving_packages SET badge=?, title=?, description=?, practical_sessions=?, session_duration=?, daily_distance=?, extra_features=? WHERE id=?`,
      [
        badge || null,
        title,
        description || null,
        practical_sessions || null,
        session_duration || null,
        daily_distance || null,
        extra_features ? JSON.stringify(extra_features) : null,
        req.params.id
      ]
    );

    res.json({ success: true, message: 'Package updated successfully' });
  } catch (err) {
    console.error('Update driving package error:', err);
    res.status(500).json({ success: false, error: 'Failed to update package' });
  }
});

/**
 * DELETE a package (admin only)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await dbPool.query('DELETE FROM driving_packages WHERE id=?', [req.params.id]);
    res.json({ success: true, message: 'Package deleted successfully' });
  } catch (err) {
    console.error('Delete driving package error:', err);
    res.status(500).json({ success: false, error: 'Failed to delete package' });
  }
});

export default router;
