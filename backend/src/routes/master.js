import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { countryIdsSubquery, scopeClause, registerCountryAssignmentRoutes } from '../db/masterDataScope.js';

export const masterRouter = Router();
masterRouter.param('id', validateUuidParam);

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

// --- Read: any logged-in, approved user (needed for the demo plot form) ---

// Super Admin manages the full global list, so always sees everything
// unfiltered. Everyone else only sees crops/varieties usable in a country
// they're covered in - either because the item has no country restriction
// at all (the default), or because one of its assigned countries matches
// one of theirs.
masterRouter.get('/master/crops', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(
      `select id, name, ${countryIdsSubquery('c', 'crops')} as country_ids from crops c order by name`,
    );
    return res.json({ crops: result.rows });
  }
  const result = await pool.query(
    `select c.id, c.name, ${countryIdsSubquery('c', 'crops')} as country_ids
     from crops c
     where ${scopeClause('c', 'crops', 1)}
     order by c.name`,
    [req.user.countryIds],
  );
  res.json({ crops: result.rows });
});

masterRouter.get('/master/varieties', requireAuth, async (req, res) => {
  const { crop_id } = req.query;
  if (!crop_id) return res.status(400).json({ error: 'crop_id is required' });

  if (req.user.role === 'super_admin') {
    const result = await pool.query(
      `select id, name, ${countryIdsSubquery('v', 'varieties')} as country_ids
       from varieties v where crop_id = $1 order by name`,
      [crop_id],
    );
    return res.json({ varieties: result.rows });
  }

  // A variety only shows up where its crop is also usable - its own
  // assignment (if any) can only narrow that further, never expand it.
  const result = await pool.query(
    `select v.id, v.name, ${countryIdsSubquery('v', 'varieties')} as country_ids
     from varieties v
     join crops c on c.id = v.crop_id
     where v.crop_id = $1
       and ${scopeClause('c', 'crops', 2)}
       and ${scopeClause('v', 'varieties', 2)}
     order by v.name`,
    [crop_id, req.user.countryIds],
  );
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

registerCountryAssignmentRoutes(masterRouter, requireAdmin, { path: 'crops', table: 'crops' });
registerCountryAssignmentRoutes(masterRouter, requireAdmin, { path: 'varieties', table: 'varieties' });
