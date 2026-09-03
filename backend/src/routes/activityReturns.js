import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';

// Business Plan master data for the Return side (Activity -> Activity Item,
// each Item scoped to countries and carrying applicable units) - same shape
// as activities.js/Activity Cost, deliberately kept as its own tables since
// Cost and Return are different business objects (see migration 039).
// Super Admin only, same as Activity Cost.
export const activityReturnsRouter = Router();
activityReturnsRouter.param('id', validateUuidParam);
activityReturnsRouter.param('itemId', validateUuidParam);

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

const SELECT_ACTIVITY_RETURNS = `
  select ar.id, ar.name, ar.has_item, ar.created_at,
    coalesce((
      select string_agg(ari.name, ', ' order by ari.name)
      from activity_return_items ari where ari.activity_return_id = ar.id and ari.status = 'active'
    ), '') as item_names,
    (select count(*) from activity_return_items ari where ari.activity_return_id = ar.id and ari.status = 'active') as item_count
  from activity_returns ar
  where ar.status = 'active'
`;

activityReturnsRouter.get('/activity-returns', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(`${SELECT_ACTIVITY_RETURNS} order by ar.name asc`);
  res.json({ activityReturns: result.rows });
});

activityReturnsRouter.post('/activity-returns', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name, hasItem } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const result = await pool.query(
    `insert into activity_returns (name, has_item) values ($1, $2) returning id, name, has_item, created_at`,
    [name.trim(), hasItem !== false],
  );
  res.status(201).json({ activityReturn: result.rows[0] });
});

const SELECT_ACTIVITY_RETURN_ITEMS = `
  select ari.id, ari.name, ari.remark, ari.created_at,
    coalesce((select array_agg(aric.country_id) from activity_return_item_countries aric where aric.item_id = ari.id), '{}') as country_ids,
    coalesce((
      select json_agg(json_build_object('id', u.id, 'name', u.name) order by u.name)
      from activity_return_item_units ariu join units u on u.id = ariu.unit_id where ariu.item_id = ari.id
    ), '[]') as units
  from activity_return_items ari
  where ari.activity_return_id = $1 and ari.status = 'active'
  order by ari.name asc
`;

activityReturnsRouter.get('/activity-returns/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const activityResult = await pool.query(
    `select id, name, has_item, created_at from activity_returns where id = $1 and status = 'active'`,
    [req.params.id],
  );
  if (activityResult.rowCount === 0) return res.status(404).json({ error: 'No such activity return' });

  const itemsResult = await pool.query(SELECT_ACTIVITY_RETURN_ITEMS, [req.params.id]);
  res.json({ activityReturn: activityResult.rows[0], items: itemsResult.rows });
});

activityReturnsRouter.patch('/activity-returns/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name, hasItem } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const result = await pool.query(
    `update activity_returns set name = $1, has_item = $2 where id = $3 and status = 'active' returning id, name, has_item`,
    [name.trim(), hasItem !== false, req.params.id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such activity return' });
  res.json({ activityReturn: result.rows[0] });
});

// Soft-delete, same reasoning as DELETE /activities/:id - a future
// Expected Return entry may already reference this activity's items.
activityReturnsRouter.delete('/activity-returns/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `update activity_returns set status = 'inactive' where id = $1 and status = 'active' returning id`,
      [req.params.id],
    );
    if (result.rowCount === 0) {
      await client.query('rollback');
      return res.status(404).json({ error: 'No such activity return' });
    }
    await client.query(`update activity_return_items set status = 'inactive' where activity_return_id = $1`, [req.params.id]);
    await client.query('commit');
    res.status(204).end();
  } catch (err) {
    await client.query('rollback');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

async function replaceCountriesAndUnits(client, itemId, countryIds, unitIds) {
  await client.query('delete from activity_return_item_countries where item_id = $1', [itemId]);
  for (const countryId of countryIds) {
    await client.query('insert into activity_return_item_countries (item_id, country_id) values ($1, $2)', [itemId, countryId]);
  }
  await client.query('delete from activity_return_item_units where item_id = $1', [itemId]);
  for (const unitId of unitIds) {
    await client.query('insert into activity_return_item_units (item_id, unit_id) values ($1, $2)', [itemId, unitId]);
  }
}

function validateItemFields({ name, countryIds, unitIds }) {
  if (!name || !name.trim()) return 'name is required';
  if (!Array.isArray(countryIds) || countryIds.length === 0) return 'At least one country is required';
  if (!Array.isArray(unitIds) || unitIds.length === 0) return 'At least one unit is required';
  return null;
}

activityReturnsRouter.post('/activity-returns/:id/items', requireAdmin, requireSuperAdmin, async (req, res) => {
  const activityResult = await pool.query(`select id from activity_returns where id = $1 and status = 'active'`, [req.params.id]);
  if (activityResult.rowCount === 0) return res.status(404).json({ error: 'No such activity return' });

  const { name, countryIds, unitIds, remark } = req.body;
  const validationError = validateItemFields({ name, countryIds, unitIds });
  if (validationError) return res.status(400).json({ error: validationError });

  const client = await pool.connect();
  try {
    await client.query('begin');
    const itemResult = await client.query(
      `insert into activity_return_items (activity_return_id, name, remark) values ($1, $2, $3) returning id`,
      [req.params.id, name.trim(), remark?.trim() || null],
    );
    const itemId = itemResult.rows[0].id;
    await replaceCountriesAndUnits(client, itemId, countryIds, unitIds);
    await client.query('commit');
    res.status(201).json({ item: { id: itemId } });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'Unknown country or unit' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

activityReturnsRouter.patch('/activity-return-items/:itemId', requireAdmin, requireSuperAdmin, async (req, res) => {
  const existing = await pool.query(`select id from activity_return_items where id = $1 and status = 'active'`, [req.params.itemId]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such item' });

  const { name, countryIds, unitIds, remark } = req.body;
  const validationError = validateItemFields({ name, countryIds, unitIds });
  if (validationError) return res.status(400).json({ error: validationError });

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update activity_return_items set name = $1, remark = $2 where id = $3`,
      [name.trim(), remark?.trim() || null, req.params.itemId],
    );
    await replaceCountriesAndUnits(client, req.params.itemId, countryIds, unitIds);
    await client.query('commit');
    res.json({ ok: true });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'Unknown country or unit' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

activityReturnsRouter.delete('/activity-return-items/:itemId', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    `update activity_return_items set status = 'inactive' where id = $1 and status = 'active' returning id`,
    [req.params.itemId],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such item' });
  res.status(204).end();
});
