import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';

export const demoPlotsRouter = Router();

const STATUSES = ['ongoing', 'completed', 'terminated'];

const PLOT_TYPES = ['demo', 'adoption'];

const SELECT_DEMO_PLOTS = `
  select dp.id, dp.farmer_name, dp.farmer_phone, dp.demo_status, dp.plot_type, dp.created_at,
    c.name as crop_name, v.name as variety_name, vi.name as village_name
  from demo_plots dp
  join crops c on c.id = dp.crop_id
  join varieties v on v.id = dp.variety_id
  join villages vi on vi.id = dp.village_id
`;

function plotTypeFromQuery(req) {
  const { plot_type } = req.query;
  return PLOT_TYPES.includes(plot_type) ? plot_type : 'demo';
}

// Super Admin sees everything, like everywhere else in this app. Everyone
// else is scoped to the villages their location assignments cover - no
// assignment means no visibility, not "see everything". `plot_type`
// defaults to 'demo' so existing callers that don't pass it are unaffected.
demoPlotsRouter.get('/demo-plots', requireAuth, async (req, res) => {
  const plotType = plotTypeFromQuery(req);
  if (req.user.role === 'super_admin') {
    const result = await pool.query(
      `${SELECT_DEMO_PLOTS} where dp.plot_type = $1 order by dp.created_at desc limit 200`,
      [plotType],
    );
    return res.json({ demoPlots: result.rows });
  }

  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_DEMO_PLOTS} where dp.plot_type = $1 and dp.village_id = any($2) order by dp.created_at desc limit 200`,
    [plotType, villageIds],
  );
  res.json({ demoPlots: result.rows });
});

const PHONE_LIKE = /^\d{6,}$/;

demoPlotsRouter.get('/demo-plots/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });
  const plotType = plotTypeFromQuery(req);

  // Phone number is the farmer's exact identifier (PRD Section 5), so a
  // numeric query is matched exactly against farmer_phone - a substring
  // match here would wrongly surface any other number sharing a prefix
  // (e.g. searching "123456789" would also match "1234567891"). A
  // non-numeric query keeps the broad free-text search across every field.
  const params = [PHONE_LIKE.test(q) ? q : `%${q}%`, plotType];
  let whereClause = PHONE_LIKE.test(q)
    ? `dp.farmer_phone = $1 and dp.plot_type = $2`
    : `(dp.farmer_name ilike $1 or dp.farmer_phone ilike $1 or vi.name ilike $1 or c.name ilike $1 or v.name ilike $1) and dp.plot_type = $2`;

  if (req.user.role !== 'super_admin') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    params.push(villageIds);
    whereClause += ` and dp.village_id = any($${params.length})`;
  }

  const result = await pool.query(
    `${SELECT_DEMO_PLOTS} where ${whereClause} order by dp.created_at desc limit 100`,
    params,
  );
  res.json({ demoPlots: result.rows });
});

// Every plot (demo AND adoption) already on file for an exact phone number -
// powers the "this farmer already exists" notice on the create form, so a
// name/crop/village entered for a known farmer is informed, not a guess.
// Deliberately unscoped by village coverage, matching creation itself
// (POST /demo-plots isn't coverage-restricted either).
demoPlotsRouter.get('/demo-plots/by-phone', requireAuth, async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  const result = await pool.query(`${SELECT_DEMO_PLOTS} where dp.farmer_phone = $1 order by dp.created_at`, [phone]);
  res.json({ demoPlots: result.rows });
});

demoPlotsRouter.post('/demo-plots', requireAuth, async (req, res) => {
  const { farmerName, phone, cropId, varietyId, villageId, demoStatus, plotType } = req.body;

  if (!farmerName || !phone || !cropId || !varietyId || !villageId) {
    return res.status(400).json({ error: 'farmerName, phone, cropId, varietyId, and villageId are all required' });
  }
  const status = demoStatus || 'ongoing';
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `demoStatus must be one of: ${STATUSES.join(', ')}` });
  }
  const type = PLOT_TYPES.includes(plotType) ? plotType : 'demo';

  // Phone number is the farmer's key identifier (PRD Section 5) - the same
  // number can carry multiple plots (different crops), but only for the
  // same farmer, and never the exact same crop+variety twice within the
  // same plot type (a demo plot and an adoption plot for the same crop are
  // legitimately different records, not a duplicate).
  const existing = await pool.query(
    'select farmer_name, crop_id, variety_id, plot_type from demo_plots where farmer_phone = $1',
    [phone],
  );
  const exactDuplicate = existing.rows.find(
    (row) => row.crop_id === cropId && row.variety_id === varietyId && row.plot_type === type,
  );
  if (exactDuplicate) {
    return res.status(409).json({
      error: 'This demo plot already exists - same farmer, crop, and variety.',
      code: 'duplicate_plot',
    });
  }
  const nameMatches = existing.rows.some(
    (row) => row.farmer_name.trim().toLowerCase() === farmerName.trim().toLowerCase(),
  );
  if (existing.rowCount > 0 && !nameMatches) {
    const existingFarmerName = existing.rows[0].farmer_name;
    return res.status(409).json({
      error: `This phone number is already registered to ${existingFarmerName}.`,
      code: 'name_mismatch',
      existingFarmerName,
    });
  }

  try {
    const result = await pool.query(
      `insert into demo_plots (farmer_name, farmer_phone, crop_id, variety_id, village_id, demo_status, plot_type, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, farmer_name, farmer_phone, demo_status, plot_type, created_at`,
      [farmerName, phone, cropId, varietyId, villageId, status, type, req.user.userId],
    );
    res.status(201).json({ demoPlot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
