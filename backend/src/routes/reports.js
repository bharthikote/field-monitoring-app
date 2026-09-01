import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';
import { SIMPLE_LISTS } from './simpleMasterLists.js';

export const reportsRouter = Router();

export const SELECT_DEMO_PLOTS = `
  select dp.id, dp.farmer_name, dp.farmer_phone, dp.demo_status, dp.created_at, dp.updated_at,
    c.name as crop_name, v.name as variety_name, vi.name as village_name
  from demo_plots dp
  join crops c on c.id = dp.crop_id
  join varieties v on v.id = dp.variety_id
  join villages vi on vi.id = dp.village_id
`;

// Same visibility rule as everywhere else demo plot data is read: Super
// Admin sees everything, everyone else is scoped to the villages their
// location assignments cover.
async function villageScopeClause(req, params) {
  // Leadership sees every country too (PRD Section 2: "All countries" /
  // "View/reporting access only"), same unscoped reach as Super Admin.
  if (req.user.role === 'super_admin' || req.user.role === 'leadership') return '';
  const villageIds = await getCoveredVillageIds(req.user.userId);
  params.push(villageIds);
  return ` where dp.village_id = any($${params.length})`;
}

reportsRouter.get('/reports/demos', requireAuth, async (req, res) => {
  const params = [];
  const whereClause = await villageScopeClause(req, params);
  const result = await pool.query(`${SELECT_DEMO_PLOTS} ${whereClause} order by dp.created_at desc`, params);
  res.json({ demoPlots: result.rows });
});

// Sources the real farmers master table directly (not derived from demo
// plots) - a farmer registered via Training/Field Day/the TFO detailed
// form with zero demo plots still needs to show up here. `villages` stays
// a single value now (a farmer has exactly one canonical village), kept as
// a column name for report-farmers.html's existing render/CSV code.
reportsRouter.get('/reports/farmers', requireAuth, async (req, res) => {
  const params = [];
  let whereClause = '';
  if (req.user.role !== 'super_admin' && req.user.role !== 'leadership') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    params.push(villageIds);
    whereClause = ` where f.village_id = any($${params.length})`;
  }
  const result = await pool.query(
    `select f.name as farmer_name, f.phone as farmer_phone, vi.name as villages,
       (select count(*)::int from demo_plots dp where dp.farmer_id = f.id)
         + (select count(*)::int from trainings tr where tr.farmer_id = f.id)
         + (select count(*)::int from field_days fd where fd.farmer_id = f.id) as activity_count,
       f.created_at as first_created_at
     from farmers f
     join villages vi on vi.id = f.village_id
     ${whereClause}
     order by f.name`,
    params,
  );
  res.json({ farmers: result.rows });
});

// Crops and varieties live in their own tables (variety belongs to a crop);
// everything else is a flat name-only list. Combine them into one menu of
// exportable lists so the Reports page doesn't need to know the difference.
export const REPORT_MASTER_LISTS = [
  { key: 'crops', label: 'Crops' },
  { key: 'varieties', label: 'Varieties' },
  ...SIMPLE_LISTS.map((l) => ({ key: l.path, label: l.label })),
];

reportsRouter.get('/reports/master-lists', requireAuth, async (_req, res) => {
  res.json({ lists: REPORT_MASTER_LISTS });
});

reportsRouter.get('/reports/master-lists/:key', requireAuth, async (req, res) => {
  const { key } = req.params;

  if (key === 'crops') {
    const result = await pool.query('select name from crops order by name');
    return res.json({ items: result.rows });
  }
  if (key === 'varieties') {
    const result = await pool.query(
      `select v.name, c.name as crop_name from varieties v join crops c on c.id = v.crop_id order by c.name, v.name`,
    );
    return res.json({ items: result.rows });
  }
  const list = SIMPLE_LISTS.find((l) => l.path === key);
  if (!list) return res.status(404).json({ error: 'No such list' });
  const result = await pool.query(`select name from ${list.table} order by name`);
  res.json({ items: result.rows });
});
