import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const masterRouter = Router();

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

// --- Read: any logged-in, approved user (needed for the demo plot form) ---

masterRouter.get('/master/crops', requireAuth, async (_req, res) => {
  const result = await pool.query('select id, name from crops order by name');
  res.json({ crops: result.rows });
});

masterRouter.get('/master/varieties', requireAuth, async (req, res) => {
  const { crop_id } = req.query;
  if (!crop_id) return res.status(400).json({ error: 'crop_id is required' });
  const result = await pool.query('select id, name from varieties where crop_id = $1 order by name', [crop_id]);
  res.json({ varieties: result.rows });
});

// --- Write: Super Admin only, per PRD Section 7 ("Super Admin-owned") ---

masterRouter.post('/master/crops', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query('insert into crops (name) values ($1) returning id, name', [name]);
    res.status(201).json({ crop: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That crop already exists' });
    res.status(500).json({ error: err.message });
  }
});

masterRouter.patch('/master/crops/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query('update crops set name = $2 where id = $1 returning id, name', [req.params.id, name]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'No such crop' });
    res.json({ crop: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That name already exists' });
    res.status(500).json({ error: err.message });
  }
});

masterRouter.delete('/master/crops/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query('delete from crops where id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'No such crop' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'Delete its varieties first (or it is used by a demo plot)' });
    res.status(500).json({ error: err.message });
  }
});

masterRouter.post('/master/varieties', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { crop_id, name } = req.body;
  if (!crop_id || !name) return res.status(400).json({ error: 'crop_id and name are required' });
  try {
    const result = await pool.query(
      'insert into varieties (crop_id, name) values ($1, $2) returning id, name',
      [crop_id, name],
    );
    res.status(201).json({ variety: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That variety already exists for this crop' });
    res.status(500).json({ error: err.message });
  }
});

masterRouter.patch('/master/varieties/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query('update varieties set name = $2 where id = $1 returning id, name', [req.params.id, name]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'No such variety' });
    res.json({ variety: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That name already exists' });
    res.status(500).json({ error: err.message });
  }
});

masterRouter.delete('/master/varieties/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query('delete from varieties where id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'No such variety' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') return res.status(409).json({ error: 'This variety is used by a demo plot' });
    res.status(500).json({ error: err.message });
  }
});
