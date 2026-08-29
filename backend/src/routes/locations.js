import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import {
  countryIdForState,
  countryIdForDistrict,
  countryIdForBlock,
  countryIdForVillage,
} from '../db/locationHelpers.js';

export const locationsRouter = Router();
locationsRouter.param('id', validateUuidParam);

// --- Read endpoints: any logged-in, approved user can browse the hierarchy
// (every field role needs this to pick a Village, not just Admin/Super Admin) ---

locationsRouter.get('/locations/countries', requireAuth, async (_req, res) => {
  const result = await pool.query('select id, name from countries order by name');
  res.json({ countries: result.rows });
});

locationsRouter.get('/locations/states', requireAuth, async (req, res) => {
  const { country_id } = req.query;
  if (!country_id) return res.status(400).json({ error: 'country_id is required' });
  const result = await pool.query('select id, name from states where country_id = $1 order by name', [country_id]);
  res.json({ states: result.rows });
});

locationsRouter.get('/locations/districts', requireAuth, async (req, res) => {
  const { state_id } = req.query;
  if (!state_id) return res.status(400).json({ error: 'state_id is required' });
  const result = await pool.query('select id, name from districts where state_id = $1 order by name', [state_id]);
  res.json({ districts: result.rows });
});

locationsRouter.get('/locations/blocks', requireAuth, async (req, res) => {
  const { district_id } = req.query;
  if (!district_id) return res.status(400).json({ error: 'district_id is required' });
  const result = await pool.query('select id, name from blocks where district_id = $1 order by name', [district_id]);
  res.json({ blocks: result.rows });
});

locationsRouter.get('/locations/villages', requireAuth, async (req, res) => {
  const { block_id } = req.query;
  if (!block_id) return res.status(400).json({ error: 'block_id is required' });
  const result = await pool.query('select id, name from villages where block_id = $1 order by name', [block_id]);
  res.json({ villages: result.rows });
});

// --- Authorization helpers ---

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

function requireOwnCountry(actualCountryId, req, res) {
  if (req.user.role === 'super_admin') return true;
  if (!req.user.countryId || req.user.countryId !== actualCountryId) {
    res.status(403).json({ error: "You can only manage locations within your own assigned country" });
    return false;
  }
  return true;
}

// --- Create ---

locationsRouter.post('/locations/countries', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query('insert into countries (name) values ($1) returning id, name', [name]);
    res.status(201).json({ country: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That country already exists' });
    res.status(500).json({ error: err.message });
  }
});

locationsRouter.post('/locations/states', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { country_id, name } = req.body;
  if (!country_id || !name) return res.status(400).json({ error: 'country_id and name are required' });
  try {
    const result = await pool.query(
      'insert into states (country_id, name) values ($1, $2) returning id, name',
      [country_id, name],
    );
    res.status(201).json({ state: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That state already exists in this country' });
    res.status(500).json({ error: err.message });
  }
});

locationsRouter.post('/locations/districts', requireAdmin, async (req, res) => {
  const { state_id, name } = req.body;
  if (!state_id || !name) return res.status(400).json({ error: 'state_id and name are required' });

  const countryId = await countryIdForState(state_id);
  if (!countryId) return res.status(404).json({ error: 'No such state' });
  if (!requireOwnCountry(countryId, req, res)) return;

  try {
    const result = await pool.query(
      'insert into districts (state_id, name) values ($1, $2) returning id, name',
      [state_id, name],
    );
    res.status(201).json({ district: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That district already exists in this state' });
    res.status(500).json({ error: err.message });
  }
});

locationsRouter.post('/locations/blocks', requireAdmin, async (req, res) => {
  const { district_id, name } = req.body;
  if (!district_id || !name) return res.status(400).json({ error: 'district_id and name are required' });

  const countryId = await countryIdForDistrict(district_id);
  if (!countryId) return res.status(404).json({ error: 'No such district' });
  if (!requireOwnCountry(countryId, req, res)) return;

  try {
    const result = await pool.query(
      'insert into blocks (district_id, name) values ($1, $2) returning id, name',
      [district_id, name],
    );
    res.status(201).json({ block: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That block already exists in this district' });
    res.status(500).json({ error: err.message });
  }
});

locationsRouter.post('/locations/villages', requireAdmin, async (req, res) => {
  const { block_id, name } = req.body;
  if (!block_id || !name) return res.status(400).json({ error: 'block_id and name are required' });

  const countryId = await countryIdForBlock(block_id);
  if (!countryId) return res.status(404).json({ error: 'No such block' });
  if (!requireOwnCountry(countryId, req, res)) return;

  try {
    const result = await pool.query(
      'insert into villages (block_id, name) values ($1, $2) returning id, name',
      [block_id, name],
    );
    res.status(201).json({ village: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That village already exists in this block' });
    res.status(500).json({ error: err.message });
  }
});

// --- Rename ---

const RENAME_TABLES = {
  countries: { table: 'countries', singular: 'country', superAdminOnly: true, resolveCountry: async (id) => id },
  states: { table: 'states', singular: 'state', superAdminOnly: true, resolveCountry: countryIdForState },
  districts: { table: 'districts', singular: 'district', superAdminOnly: false, resolveCountry: countryIdForDistrict },
  blocks: { table: 'blocks', singular: 'block', superAdminOnly: false, resolveCountry: countryIdForBlock },
  villages: { table: 'villages', singular: 'village', superAdminOnly: false, resolveCountry: countryIdForVillage },
};

for (const [path, config] of Object.entries(RENAME_TABLES)) {
  locationsRouter.patch(`/locations/${path}/:id`, requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (config.superAdminOnly && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admin can do this' });
    }

    const countryId = await config.resolveCountry(req.params.id);
    if (!countryId) return res.status(404).json({ error: 'No such location' });
    if (!requireOwnCountry(countryId, req, res)) return;

    try {
      const result = await pool.query(
        `update ${config.table} set name = $2 where id = $1 returning id, name`,
        [req.params.id, name],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'No such location' });
      res.json({ [config.singular]: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That name already exists at this level' });
      res.status(500).json({ error: err.message });
    }
  });

  locationsRouter.delete(`/locations/${path}/:id`, requireAdmin, async (req, res) => {
    if (config.superAdminOnly && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admin can do this' });
    }

    const countryId = await config.resolveCountry(req.params.id);
    if (!countryId) return res.status(404).json({ error: 'No such location' });
    if (!requireOwnCountry(countryId, req, res)) return;

    try {
      const result = await pool.query(`delete from ${config.table} where id = $1`, [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'No such location' });
      res.status(204).end();
    } catch (err) {
      if (err.code === '23503') {
        return res.status(409).json({ error: 'Delete everything under this location first (or unassign users from it)' });
      }
      res.status(500).json({ error: err.message });
    }
  });
}
