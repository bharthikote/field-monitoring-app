import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';

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

demoPlotsRouter.get('/demo-plots', requireAuth, async (_req, res) => {
  const result = await pool.query(`${SELECT_DEMO_PLOTS} order by dp.created_at desc limit 200`);
  res.json({ demoPlots: result.rows });
});

demoPlotsRouter.get('/demo-plots/lookup', requireAuth, async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const result = await pool.query(
    `${SELECT_DEMO_PLOTS} where dp.farmer_phone = $1 order by dp.created_at desc`,
    [phone],
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
