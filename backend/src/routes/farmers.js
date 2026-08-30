import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';
import { SELECT_DEMO_PLOTS } from './demoPlots.js';
import { SELECT_TRAININGS } from './trainings.js';
import { SELECT_FIELD_DAYS } from './fieldDays.js';

export const farmersRouter = Router();
farmersRouter.param('id', validateUuidParam);

const PHONE_LIKE = /^\d{6,}$/;

const SELECT_FARMERS = `
  select f.id, f.name, f.phone, f.created_at,
    f.village_id, vi.name as village_name, b.name as block_name, di.name as district_name,
    s.name as state_name, co.name as country_name
  from farmers f
  join villages vi on vi.id = f.village_id
  join blocks b on b.id = vi.block_id
  join districts di on di.id = b.district_id
  join states s on s.id = di.state_id
  join countries co on co.id = s.country_id
`;

// Same visibility rule as demo plots/trainings: Super Admin sees everything,
// everyone else is scoped to the villages their location assignments cover.
farmersRouter.get('/farmers', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(`${SELECT_FARMERS} order by f.created_at desc limit 200`);
    return res.json({ farmers: result.rows });
  }
  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_FARMERS} where f.village_id = any($1) order by f.created_at desc limit 200`,
    [villageIds],
  );
  res.json({ farmers: result.rows });
});

farmersRouter.get('/farmers/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  const params = [PHONE_LIKE.test(q) ? q : `%${q}%`];
  let whereClause = PHONE_LIKE.test(q)
    ? `f.phone = $1`
    : `(f.name ilike $1 or f.phone ilike $1 or vi.name ilike $1)`;

  if (req.user.role !== 'super_admin') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    params.push(villageIds);
    whereClause += ` and f.village_id = any($${params.length})`;
  }

  const result = await pool.query(
    `${SELECT_FARMERS} where ${whereClause} order by f.created_at desc limit 100`,
    params,
  );
  res.json({ farmers: result.rows });
});

// Powers the existing-farmer lookup on the Demo Plot/Training create forms.
// Deliberately unscoped by village coverage, matching creation itself
// (POST /demo-plots and POST /trainings aren't coverage-restricted either).
// `farmer` is present whenever the phone is registered, even with zero demo
// plots - `demoPlots` keeps its own shape for the "existing plots" banner.
farmersRouter.get('/farmers/by-phone', requireAuth, async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  const farmerResult = await pool.query(`${SELECT_FARMERS} where f.phone = $1`, [phone]);
  const farmer = farmerResult.rows[0] || null;
  if (!farmer) return res.json({ farmer: null, demoPlots: [] });

  const plotsResult = await pool.query(`${SELECT_DEMO_PLOTS} where dp.farmer_id = $1 order by dp.created_at`, [farmer.id]);
  res.json({ farmer, demoPlots: plotsResult.rows });
});

// Explicit registration - unlike the activity forms' silent find-or-create,
// this fails if the phone is already registered rather than silently
// reusing it, since registering is a deliberate action here.
farmersRouter.post('/farmers', requireAuth, async (req, res) => {
  const { name, phone, villageId } = req.body;
  if (!name || !phone || !villageId) {
    return res.status(400).json({ error: 'name, phone, and villageId are all required' });
  }
  try {
    const result = await pool.query(
      'insert into farmers (name, phone, village_id, created_by) values ($1, $2, $3, $4) returning id, name, phone, village_id, created_at',
      [name, phone, villageId, req.user.userId],
    );
    res.status(201).json({ farmer: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A farmer with this phone number is already registered' });
    if (err.code === '23503') return res.status(400).json({ error: 'No such village' });
    res.status(500).json({ error: err.message });
  }
});

async function requireCoverage(req, res, villageId) {
  if (req.user.role === 'super_admin') return true;
  const villageIds = await getCoveredVillageIds(req.user.userId);
  if (!villageIds.includes(villageId)) {
    res.status(403).json({ error: "This farmer isn't in your assigned coverage" });
    return false;
  }
  return true;
}

farmersRouter.get('/farmers/:id', requireAuth, async (req, res) => {
  const result = await pool.query(`${SELECT_FARMERS} where f.id = $1`, [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such farmer' });
  const farmer = result.rows[0];
  if (!(await requireCoverage(req, res, farmer.village_id))) return;
  res.json({ farmer });
});

// All activities (Demo/Adoption Plot, Training) logged for this farmer,
// merged and sorted by created_at desc - same "parallel queries + JS merge"
// style as visits.js's attachVisitExtras.
farmersRouter.get('/farmers/:id/activities', requireAuth, async (req, res) => {
  const farmerResult = await pool.query('select village_id from farmers where id = $1', [req.params.id]);
  if (farmerResult.rowCount === 0) return res.status(404).json({ error: 'No such farmer' });
  if (!(await requireCoverage(req, res, farmerResult.rows[0].village_id))) return;

  const [plotsResult, trainingsResult, fieldDaysResult] = await Promise.all([
    pool.query(`${SELECT_DEMO_PLOTS} where dp.farmer_id = $1 order by dp.created_at desc`, [req.params.id]),
    pool.query(`${SELECT_TRAININGS} where tr.farmer_id = $1 order by tr.created_at desc`, [req.params.id]),
    pool.query(`${SELECT_FIELD_DAYS} where fd.farmer_id = $1 order by fd.created_at desc`, [req.params.id]),
  ]);

  const activities = [
    ...plotsResult.rows.map((row) => ({ activityType: row.plot_type, ...row })),
    ...trainingsResult.rows.map((row) => ({ activityType: 'training', ...row })),
    ...fieldDaysResult.rows.map((row) => ({ activityType: 'fieldday', ...row })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ activities });
});
