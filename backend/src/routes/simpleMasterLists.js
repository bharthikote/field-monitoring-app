import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { countryIdsSubquery, scopeClause, registerCountryAssignmentRoutes } from '../db/masterDataScope.js';

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
  { path: 'units', table: 'units', label: 'Units' },
  { path: 'nutrients', table: 'nutrients', label: 'Nutrients' },
];

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

for (const list of SIMPLE_LISTS) {
  // Units alone carries a `category` column (Country Settings' Area/Weight/
  // Liquid/Time/Distance classification, migration 043) - included here
  // rather than duplicating the Unit Master with a second endpoint.
  // Issue types alone carry `acknowledge_only` (migration 047) - types that
  // are acknowledged by a Team Lead rather than resolved.
  const extraColumns = list.table === 'units' ? ', category' : list.table === 'issue_types' ? ', acknowledge_only' : '';

  simpleMasterListsRouter.get(`/master/${list.path}`, requireAuth, async (req, res) => {
    if (req.user.role === 'super_admin') {
      const result = await pool.query(
        `select id, name${extraColumns}, ${countryIdsSubquery('t', list.table)} as country_ids from ${list.table} t order by name`,
      );
      return res.json({ items: result.rows });
    }
    const result = await pool.query(
      `select t.id, t.name${extraColumns}, ${countryIdsSubquery('t', list.table)} as country_ids
       from ${list.table} t
       where ${scopeClause('t', list.table, 1)}
       order by t.name`,
      [req.user.countryIds],
    );
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
    const { name, acknowledgeOnly } = req.body;
    const canFlag = list.table === 'issue_types';
    const hasFlag = canFlag && typeof acknowledgeOnly === 'boolean';
    if (!name && !hasFlag) return res.status(400).json({ error: 'name is required' });
    try {
      const params = [req.params.id, name || null];
      let setClause = 'name = coalesce($2, name)';
      if (canFlag) {
        params.push(hasFlag ? acknowledgeOnly : null);
        setClause += ', acknowledge_only = coalesce($3, acknowledge_only)';
      }
      const result = await pool.query(
        `update ${list.table} set ${setClause} where id = $1 returning id, name`,
        params,
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

  registerCountryAssignmentRoutes(simpleMasterListsRouter, requireAdmin, { path: list.path, table: list.table });
}
