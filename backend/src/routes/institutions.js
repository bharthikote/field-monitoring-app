import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';

export const institutionsRouter = Router();
institutionsRouter.param('id', validateUuidParam);

const ORG_TYPES = ['kvk', 'icar', 'university', 'horticulture', 'others'];

const SELECT_INSTITUTIONS = `
  select i.id, i.name, i.org_type, i.org_type_other, i.created_at,
    i.village_id, vi.name as village_name, b.name as block_name, di.name as district_name,
    s.name as state_name, co.name as country_name
  from institutions i
  join villages vi on vi.id = i.village_id
  join blocks b on b.id = vi.block_id
  join districts di on di.id = b.district_id
  join states s on s.id = di.state_id
  join countries co on co.id = s.country_id
`;

// Same visibility rule as farmers/demo plots: Super Admin sees everything,
// everyone else is scoped to the villages their location assignments cover.
institutionsRouter.get('/institutions', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(`${SELECT_INSTITUTIONS} order by i.created_at desc limit 200`);
    return res.json({ institutions: result.rows });
  }
  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_INSTITUTIONS} where i.village_id = any($1) order by i.created_at desc limit 200`,
    [villageIds],
  );
  res.json({ institutions: result.rows });
});

institutionsRouter.get('/institutions/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  const params = [`%${q}%`];
  let whereClause = `(i.name ilike $1 or vi.name ilike $1)`;
  if (req.user.role !== 'super_admin') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    params.push(villageIds);
    whereClause += ` and i.village_id = any($${params.length})`;
  }

  const result = await pool.query(
    `${SELECT_INSTITUTIONS} where ${whereClause} order by i.created_at desc limit 100`,
    params,
  );
  res.json({ institutions: result.rows });
});

institutionsRouter.get('/institutions/:id', requireAuth, async (req, res) => {
  const result = await pool.query(`${SELECT_INSTITUTIONS} where i.id = $1`, [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such institution' });
  res.json({ institution: result.rows[0] });
});

institutionsRouter.post('/institutions', requireAuth, async (req, res) => {
  const { name, orgType, orgTypeOther, villageId } = req.body;
  if (!name || !orgType || !villageId) {
    return res.status(400).json({ error: 'name, orgType, and villageId are all required' });
  }
  if (!ORG_TYPES.includes(orgType)) {
    return res.status(400).json({ error: `orgType must be one of: ${ORG_TYPES.join(', ')}` });
  }
  if (orgType === 'others' && !orgTypeOther?.trim()) {
    return res.status(400).json({ error: 'orgTypeOther is required when orgType is "others"' });
  }
  try {
    const result = await pool.query(
      `insert into institutions (name, org_type, org_type_other, village_id, created_by)
       values ($1, $2, $3, $4, $5)
       returning id, name, org_type, org_type_other, village_id, created_at`,
      [name, orgType, orgType === 'others' ? orgTypeOther.trim() : null, villageId, req.user.userId],
    );
    res.status(201).json({ institution: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'No such village' });
    res.status(500).json({ error: err.message });
  }
});
