import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';

// Business Plan master data (Activity -> Activity Item, each Item scoped to
// countries and carrying applicable units) - Super Admin only, per the
// spec's permission table. Nothing outside this file consumes it yet; the
// mobile Business Plan that will read it is future work.
export const activitiesRouter = Router();
activitiesRouter.param('id', validateUuidParam);
activitiesRouter.param('itemId', validateUuidParam);

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

// One row per active Activity, with its active Items' names aggregated for
// the list page's "Items" column (a summary, not the full per-item detail -
// see GET /activities/:id for that).
const SELECT_ACTIVITIES = `
  select a.id, a.name, a.created_at,
    coalesce((
      select string_agg(ai.name, ', ' order by ai.name)
      from activity_items ai where ai.activity_id = a.id and ai.status = 'active'
    ), '') as item_names,
    (select count(*) from activity_items ai where ai.activity_id = a.id and ai.status = 'active') as item_count
  from activities a
  where a.status = 'active'
`;

activitiesRouter.get('/activities', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(`${SELECT_ACTIVITIES} order by a.name asc`);
  res.json({ activities: result.rows });
});

activitiesRouter.post('/activities', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const result = await pool.query(
    `insert into activities (name) values ($1) returning id, name, created_at`,
    [name.trim()],
  );
  res.status(201).json({ activity: result.rows[0] });
});

// Full detail for the Preview page: the Activity itself plus every active
// Item under it, each with its assigned country ids and unit ids/names (so
// the edit panel can prefill without a second round trip).
const SELECT_ACTIVITY_ITEMS = `
  select ai.id, ai.name, ai.remark, ai.created_at, ai.is_nutrient, ai.nutrient_configuration_id,
    nconf.name as nutrient_configuration_name,
    coalesce((select array_agg(aic.country_id) from activity_item_countries aic where aic.item_id = ai.id), '{}') as country_ids,
    coalesce((
      select json_agg(json_build_object('id', u.id, 'name', u.name) order by u.name)
      from activity_item_units aiu join units u on u.id = aiu.unit_id where aiu.item_id = ai.id
    ), '[]') as units
  from activity_items ai
  left join nutrient_configurations nconf on nconf.id = ai.nutrient_configuration_id
  where ai.activity_id = $1 and ai.status = 'active'
  order by ai.name asc
`;

activitiesRouter.get('/activities/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const activityResult = await pool.query(
    `select id, name, created_at from activities where id = $1 and status = 'active'`,
    [req.params.id],
  );
  if (activityResult.rowCount === 0) return res.status(404).json({ error: 'No such activity' });

  const itemsResult = await pool.query(SELECT_ACTIVITY_ITEMS, [req.params.id]);
  res.json({ activity: activityResult.rows[0], items: itemsResult.rows });
});

activitiesRouter.patch('/activities/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const result = await pool.query(
    `update activities set name = $1 where id = $2 and status = 'active' returning id, name`,
    [name.trim(), req.params.id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such activity' });
  res.json({ activity: result.rows[0] });
});

// Soft-delete: a future Business Plan entry may already reference this
// activity's items, so nothing is ever actually removed - just hidden from
// the active list/preview. Deactivating an activity deactivates its items
// too, so a "deleted" activity can't still surface applicable items
// anywhere.
activitiesRouter.delete('/activities/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `update activities set status = 'inactive' where id = $1 and status = 'active' returning id`,
      [req.params.id],
    );
    if (result.rowCount === 0) {
      await client.query('rollback');
      return res.status(404).json({ error: 'No such activity' });
    }
    await client.query(`update activity_items set status = 'inactive' where activity_id = $1`, [req.params.id]);
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
  await client.query('delete from activity_item_countries where item_id = $1', [itemId]);
  for (const countryId of countryIds) {
    await client.query('insert into activity_item_countries (item_id, country_id) values ($1, $2)', [itemId, countryId]);
  }
  await client.query('delete from activity_item_units where item_id = $1', [itemId]);
  for (const unitId of unitIds) {
    await client.query('insert into activity_item_units (item_id, unit_id) values ($1, $2)', [itemId, unitId]);
  }
}

// Is Nutrient = true requires a configuration; false requires none - same
// rule the DB's activity_items_nutrient_check constraint enforces, checked
// here first for a clear error message.
function validateItemFields({ name, countryIds, unitIds, isNutrient, nutrientConfigurationId }) {
  if (!name || !name.trim()) return 'name is required';
  if (!Array.isArray(countryIds) || countryIds.length === 0) return 'At least one country is required';
  if (!Array.isArray(unitIds) || unitIds.length === 0) return 'At least one unit is required';
  if (isNutrient && !nutrientConfigurationId) return 'A Nutrient Configuration is required for a nutrient item';
  return null;
}

// Items are always created under a specific Activity (matching the spec's
// "Create Item" action living on the Activity Preview page, not a
// standalone top-level list) - the Activity is fixed at creation and never
// reassignable afterwards (also matching the reference form, where Activity
// shows as a locked field on edit).
activitiesRouter.post('/activities/:id/items', requireAdmin, requireSuperAdmin, async (req, res) => {
  const activityResult = await pool.query(`select id from activities where id = $1 and status = 'active'`, [req.params.id]);
  if (activityResult.rowCount === 0) return res.status(404).json({ error: 'No such activity' });

  const { name, countryIds, unitIds, remark, isNutrient, nutrientConfigurationId } = req.body;
  const validationError = validateItemFields({ name, countryIds, unitIds, isNutrient, nutrientConfigurationId });
  if (validationError) return res.status(400).json({ error: validationError });

  const client = await pool.connect();
  try {
    await client.query('begin');
    const itemResult = await client.query(
      `insert into activity_items (activity_id, name, remark, is_nutrient, nutrient_configuration_id)
       values ($1, $2, $3, $4, $5) returning id`,
      [req.params.id, name.trim(), remark?.trim() || null, !!isNutrient, isNutrient ? nutrientConfigurationId : null],
    );
    const itemId = itemResult.rows[0].id;
    await replaceCountriesAndUnits(client, itemId, countryIds, unitIds);
    await client.query('commit');
    res.status(201).json({ item: { id: itemId } });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'Unknown country, unit, or nutrient configuration' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

activitiesRouter.patch('/activity-items/:itemId', requireAdmin, requireSuperAdmin, async (req, res) => {
  const existing = await pool.query(`select id from activity_items where id = $1 and status = 'active'`, [req.params.itemId]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such item' });

  const { name, countryIds, unitIds, remark, isNutrient, nutrientConfigurationId } = req.body;
  const validationError = validateItemFields({ name, countryIds, unitIds, isNutrient, nutrientConfigurationId });
  if (validationError) return res.status(400).json({ error: validationError });

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update activity_items set name = $1, remark = $2, is_nutrient = $3, nutrient_configuration_id = $4 where id = $5`,
      [name.trim(), remark?.trim() || null, !!isNutrient, isNutrient ? nutrientConfigurationId : null, req.params.itemId],
    );
    await replaceCountriesAndUnits(client, req.params.itemId, countryIds, unitIds);
    await client.query('commit');
    res.json({ ok: true });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'Unknown country, unit, or nutrient configuration' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Soft-delete, same reasoning as DELETE /activities/:id.
activitiesRouter.delete('/activity-items/:itemId', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    `update activity_items set status = 'inactive' where id = $1 and status = 'active' returning id`,
    [req.params.itemId],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such item' });
  res.status(204).end();
});
