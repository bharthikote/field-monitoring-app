import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';

export const agroDealersRouter = Router();
agroDealersRouter.param('id', validateUuidParam);

const SELECT_AGRO_DEALERS = `
  select ad.id, ad.name, ad.created_at,
    ad.village_id, vi.name as village_name, b.name as block_name, di.name as district_name,
    s.name as state_name, co.name as country_name
  from agro_dealers ad
  join villages vi on vi.id = ad.village_id
  join blocks b on b.id = vi.block_id
  join districts di on di.id = b.district_id
  join states s on s.id = di.state_id
  join countries co on co.id = s.country_id
`;

// Same visibility rule as farmers/institutions: Super Admin sees
// everything, everyone else is scoped to the villages their location
// assignments cover.
agroDealersRouter.get('/agro-dealers', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(`${SELECT_AGRO_DEALERS} order by ad.created_at desc limit 200`);
    return res.json({ agroDealers: result.rows });
  }
  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_AGRO_DEALERS} where ad.village_id = any($1) order by ad.created_at desc limit 200`,
    [villageIds],
  );
  res.json({ agroDealers: result.rows });
});

agroDealersRouter.get('/agro-dealers/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  const params = [`%${q}%`];
  let whereClause = `(ad.name ilike $1 or vi.name ilike $1)`;
  if (req.user.role !== 'super_admin') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    params.push(villageIds);
    whereClause += ` and ad.village_id = any($${params.length})`;
  }

  const result = await pool.query(
    `${SELECT_AGRO_DEALERS} where ${whereClause} order by ad.created_at desc limit 100`,
    params,
  );
  res.json({ agroDealers: result.rows });
});

agroDealersRouter.get('/agro-dealers/:id', requireAuth, async (req, res) => {
  const result = await pool.query(`${SELECT_AGRO_DEALERS} where ad.id = $1`, [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such agro dealer' });
  res.json({ agroDealer: result.rows[0] });
});

agroDealersRouter.post('/agro-dealers', requireAuth, async (req, res) => {
  const { name, villageId } = req.body;
  if (!name || !villageId) {
    return res.status(400).json({ error: 'name and villageId are both required' });
  }
  try {
    const result = await pool.query(
      `insert into agro_dealers (name, village_id, created_by)
       values ($1, $2, $3)
       returning id, name, village_id, created_at`,
      [name, villageId, req.user.userId],
    );
    res.status(201).json({ agroDealer: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'No such village' });
    res.status(500).json({ error: err.message });
  }
});
