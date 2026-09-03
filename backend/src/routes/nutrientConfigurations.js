import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';

// Nutrient Configuration Master - distinct from the Activity Item Master
// (activities.js). A configuration is a named nutrient composition (e.g.
// "Urea" = 46% Nitrogen); Activity Items reference one when Is Nutrient is
// Yes. Super Admin only, same as the rest of the Business Plan master data.
export const nutrientConfigurationsRouter = Router();
nutrientConfigurationsRouter.param('id', validateUuidParam);

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

// One row per active configuration, with its components summarized as
// "Nitrogen 46%, Phosphorus 18%" for the list page - same "aggregate for
// the list, full detail on demand" split as SELECT_ACTIVITIES.
const SELECT_CONFIGURATIONS = `
  select nconf.id, nconf.name, nconf.created_at,
    coalesce((
      select string_agg(n.name || ' ' || ncc.percentage || '%', ', ' order by n.name)
      from nutrient_configuration_components ncc join nutrients n on n.id = ncc.nutrient_id
      where ncc.configuration_id = nconf.id
    ), '') as composition_summary
  from nutrient_configurations nconf
  where nconf.status = 'active'
`;

nutrientConfigurationsRouter.get('/nutrient-configurations', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(`${SELECT_CONFIGURATIONS} order by nconf.name asc`);
  res.json({ configurations: result.rows });
});

const SELECT_CONFIGURATION_COMPONENTS = `
  select ncc.id, ncc.nutrient_id, n.name as nutrient_name, ncc.percentage
  from nutrient_configuration_components ncc
  join nutrients n on n.id = ncc.nutrient_id
  where ncc.configuration_id = $1
  order by n.name asc
`;

nutrientConfigurationsRouter.get('/nutrient-configurations/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const configResult = await pool.query(
    `select id, name, created_at from nutrient_configurations where id = $1 and status = 'active'`,
    [req.params.id],
  );
  if (configResult.rowCount === 0) return res.status(404).json({ error: 'No such nutrient configuration' });
  const componentsResult = await pool.query(SELECT_CONFIGURATION_COMPONENTS, [req.params.id]);
  res.json({ configuration: configResult.rows[0], components: componentsResult.rows });
});

// A configuration needs a name and at least one component; each component's
// percentage must be 0-100 and each nutrient may appear at most once - the
// same rules the DB's own CHECK/UNIQUE constraints enforce, checked here
// first for a clear error message instead of a raw constraint violation.
function validateConfigFields({ name, components }) {
  if (!name || !name.trim()) return 'name is required';
  if (!Array.isArray(components) || components.length === 0) return 'At least one nutrient component is required';

  const seenNutrientIds = new Set();
  for (let i = 0; i < components.length; i++) {
    const { nutrientId, percentage } = components[i];
    if (!nutrientId) return `Component ${i + 1}: nutrient is required`;
    if (seenNutrientIds.has(nutrientId)) return 'The same nutrient can\'t be added twice in one configuration';
    seenNutrientIds.add(nutrientId);
    const p = Number(percentage);
    if (percentage === undefined || percentage === '' || Number.isNaN(p) || p < 0 || p > 100) {
      return `Component ${i + 1}: percentage must be a number between 0 and 100`;
    }
  }
  return null;
}

async function replaceComponents(client, configId, components) {
  await client.query('delete from nutrient_configuration_components where configuration_id = $1', [configId]);
  for (const c of components) {
    await client.query(
      'insert into nutrient_configuration_components (configuration_id, nutrient_id, percentage) values ($1, $2, $3)',
      [configId, c.nutrientId, c.percentage],
    );
  }
}

nutrientConfigurationsRouter.post('/nutrient-configurations', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name, components } = req.body;
  const validationError = validateConfigFields({ name, components });
  if (validationError) return res.status(400).json({ error: validationError });

  const client = await pool.connect();
  try {
    await client.query('begin');
    const configResult = await client.query(
      `insert into nutrient_configurations (name) values ($1) returning id, created_at`,
      [name.trim()],
    );
    const configId = configResult.rows[0].id;
    await replaceComponents(client, configId, components);
    await client.query('commit');
    res.status(201).json({ configuration: { id: configId, name: name.trim(), created_at: configResult.rows[0].created_at } });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'Unknown nutrient' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

nutrientConfigurationsRouter.patch('/nutrient-configurations/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const existing = await pool.query(`select id from nutrient_configurations where id = $1 and status = 'active'`, [req.params.id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such nutrient configuration' });

  const { name, components } = req.body;
  const validationError = validateConfigFields({ name, components });
  if (validationError) return res.status(400).json({ error: validationError });

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('update nutrient_configurations set name = $1 where id = $2', [name.trim(), req.params.id]);
    await replaceComponents(client, req.params.id, components);
    await client.query('commit');
    res.json({ ok: true });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'Unknown nutrient' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Soft-delete, same reasoning as activities.js - an Activity Item may
// already reference this configuration, so it's never actually removed,
// just hidden from the active list and the Activity Item form's dropdown.
nutrientConfigurationsRouter.delete('/nutrient-configurations/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    `update nutrient_configurations set status = 'inactive' where id = $1 and status = 'active' returning id`,
    [req.params.id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such nutrient configuration' });
  res.status(204).end();
});
