import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';
import { findFarmerByPhone } from '../db/farmers.js';

export const demoPlotsRouter = Router();

const STATUSES = ['ongoing', 'completed', 'terminated'];

const PLOT_TYPES = ['demo', 'adoption'];

export const SELECT_DEMO_PLOTS = `
  select dp.id, dp.farmer_id, dp.farmer_name, dp.farmer_phone, dp.demo_status, dp.plot_type, dp.created_at,
    c.name as crop_name, v.name as variety_name,
    dp.village_id, vi.name as village_name, b.name as block_name, di.name as district_name,
    s.name as state_name, co.name as country_name
  from demo_plots dp
  join crops c on c.id = dp.crop_id
  join varieties v on v.id = dp.variety_id
  join villages vi on vi.id = dp.village_id
  join blocks b on b.id = vi.block_id
  join districts di on di.id = b.district_id
  join states s on s.id = di.state_id
  join countries co on co.id = s.country_id
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

  // Phone number is the farmer's key identifier (PRD Section 5) - resolved
  // against the farmers master table (backend/src/db/farmers.js) rather than
  // scanning demo_plots itself, so a farmer who only has a Training on file
  // is still recognized here.
  let farmerId;
  const existingFarmer = await findFarmerByPhone(phone);
  if (existingFarmer) {
    if (existingFarmer.name.trim().toLowerCase() !== farmerName.trim().toLowerCase()) {
      return res.status(409).json({
        error: `This phone number is already registered to ${existingFarmer.name}.`,
        code: 'name_mismatch',
        existingFarmerName: existingFarmer.name,
      });
    }
    // A farmer lives in one village - every activity for the same phone
    // number must share their registered village.
    if (existingFarmer.village_id !== villageId) {
      return res.status(409).json({
        error: `${existingFarmer.name} is already registered in a different village. A farmer's plots must all be in the same village.`,
        code: 'village_mismatch',
        villageId: existingFarmer.village_id,
      });
    }
    farmerId = existingFarmer.id;
  } else {
    const created = await pool.query(
      'insert into farmers (name, phone, village_id, created_by) values ($1, $2, $3, $4) returning id',
      [farmerName, phone, villageId, req.user.userId],
    );
    farmerId = created.rows[0].id;
  }

  // Never the exact same crop+variety twice within the same plot type for
  // the same farmer (a demo plot and an adoption plot for the same crop are
  // legitimately different records, not a duplicate).
  const exactDuplicate = await pool.query(
    'select id from demo_plots where farmer_id = $1 and crop_id = $2 and variety_id = $3 and plot_type = $4',
    [farmerId, cropId, varietyId, type],
  );
  if (exactDuplicate.rowCount > 0) {
    return res.status(409).json({
      error: 'This demo plot already exists - same farmer, crop, and variety.',
      code: 'duplicate_plot',
    });
  }

  try {
    const result = await pool.query(
      `insert into demo_plots (farmer_id, farmer_name, farmer_phone, crop_id, variety_id, village_id, demo_status, plot_type, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       returning id, farmer_name, farmer_phone, demo_status, plot_type, created_at`,
      [farmerId, farmerName, phone, cropId, varietyId, villageId, status, type, req.user.userId],
    );
    res.status(201).json({ demoPlot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
