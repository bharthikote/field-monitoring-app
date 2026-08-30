import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';

export const demoPlotsRouter = Router();

const STATUSES = ['ongoing', 'completed', 'terminated'];

const SELECT_DEMO_PLOTS = `
  select dp.id, dp.farmer_name, dp.farmer_phone, dp.demo_status, dp.created_at,
    c.name as crop_name, v.name as variety_name, vi.name as village_name
  from demo_plots dp
  join crops c on c.id = dp.crop_id
  join varieties v on v.id = dp.variety_id
  join villages vi on vi.id = dp.village_id
`;

// Super Admin sees everything, like everywhere else in this app. Everyone
// else is scoped to the villages their location assignments cover - no
// assignment means no visibility, not "see everything".
demoPlotsRouter.get('/demo-plots', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(`${SELECT_DEMO_PLOTS} order by dp.created_at desc limit 200`);
    return res.json({ demoPlots: result.rows });
  }

  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_DEMO_PLOTS} where dp.village_id = any($1) order by dp.created_at desc limit 200`,
    [villageIds],
  );
  res.json({ demoPlots: result.rows });
});

const PHONE_LIKE = /^\d{6,}$/;

demoPlotsRouter.get('/demo-plots/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  // Phone number is the farmer's exact identifier (PRD Section 5), so a
  // numeric query is matched exactly against farmer_phone - a substring
  // match here would wrongly surface any other number sharing a prefix
  // (e.g. searching "123456789" would also match "1234567891"). A
  // non-numeric query keeps the broad free-text search across every field.
  const params = [PHONE_LIKE.test(q) ? q : `%${q}%`];
  let whereClause = PHONE_LIKE.test(q)
    ? `dp.farmer_phone = $1`
    : `(dp.farmer_name ilike $1 or dp.farmer_phone ilike $1 or vi.name ilike $1 or c.name ilike $1 or v.name ilike $1)`;

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
  const { farmerName, phone, cropId, varietyId, villageId, demoStatus } = req.body;

  if (!farmerName || !phone || !cropId || !varietyId || !villageId) {
    return res.status(400).json({ error: 'farmerName, phone, cropId, varietyId, and villageId are all required' });
  }
  const status = demoStatus || 'ongoing';
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `demoStatus must be one of: ${STATUSES.join(', ')}` });
  }

  // Phone number is the farmer's key identifier (PRD Section 5) - the same
  // number can carry multiple plots (different crops), but only for the
  // same farmer, and never the exact same crop+variety twice.
  const existing = await pool.query(
    'select farmer_name, crop_id, variety_id from demo_plots where farmer_phone = $1',
    [phone],
  );
  const exactDuplicate = existing.rows.find((row) => row.crop_id === cropId && row.variety_id === varietyId);
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
      `insert into demo_plots (farmer_name, farmer_phone, crop_id, variety_id, village_id, demo_status, created_by)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, farmer_name, farmer_phone, demo_status, created_at`,
      [farmerName, phone, cropId, varietyId, villageId, status, req.user.userId],
    );
    res.status(201).json({ demoPlot: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
