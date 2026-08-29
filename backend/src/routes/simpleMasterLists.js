import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';

export const simpleMasterListsRouter = Router();
simpleMasterListsRouter.param('id', validateUuidParam);

// Flat, single-level master lists per PRD Section 7. Each gets its own
// table (rather than one polymorphic table) since future features -
// the Issue Lifecycle, disease/pest identification on the visit form -
// will need real foreign keys into these.
export const SIMPLE_LISTS = [
  { path: 'training-topics', table: 'training_topics', label: 'Training Topics' },
  { path: 'field-day-topics', table: 'field_day_topics', label: 'Field Day Topics' },
  { path: 'issue-types', table: 'issue_types', label: 'Issue Types' },
  { path: 'diseases', table: 'diseases', label: 'Diseases' },
  { path: 'pests', table: 'pests', label: 'Pests' },
  { path: 'techniques', table: 'techniques', label: 'Techniques / Recommendations' },
  { path: 'good-things-observed', table: 'good_things_observed', label: 'Good Things Observed' },
];

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

for (const list of SIMPLE_LISTS) {
  simpleMasterListsRouter.get(`/master/${list.path}`, requireAuth, async (_req, res) => {
    const result = await pool.query(`select id, name from ${list.table} order by name`);
    res.json({ items: result.rows });
  });

  simpleMasterListsRouter.post(`/master/${list.path}`, requireAdmin, requireSuperAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
      const result = await pool.query(`insert into ${list.table} (name) values ($1) returning id, name`, [name]);
      res.status(201).json({ item: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That name already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  simpleMasterListsRouter.patch(`/master/${list.path}/:id`, requireAdmin, requireSuperAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    try {
      const result = await pool.query(
        `update ${list.table} set name = $2 where id = $1 returning id, name`,
        [req.params.id, name],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'No such item' });
      res.json({ item: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That name already exists' });
      res.status(500).json({ error: err.message });
    }
  });

  simpleMasterListsRouter.delete(`/master/${list.path}/:id`, requireAdmin, requireSuperAdmin, async (req, res) => {
    try {
      const result = await pool.query(`delete from ${list.table} where id = $1`, [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'No such item' });
      res.status(204).end();
    } catch (err) {
      if (err.code === '23503') return res.status(409).json({ error: 'This item is in use and cannot be deleted' });
      res.status(500).json({ error: err.message });
    }
  });
}
