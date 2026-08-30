import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds, attachLocationNames, isLocationCovered, resolveLocationPath } from '../db/locationHelpers.js';

export const institutionsRouter = Router();
institutionsRouter.param('id', validateUuidParam);

const ORG_TYPES = ['kvk', 'icar', 'university', 'horticulture', 'others'];
const LOCATION_LEVELS = ['village', 'block', 'district'];

const SELECT_INSTITUTIONS_RAW = `
  select id, name, org_type, org_type_other, location_level, location_id, created_at
  from institutions
`;

// Same visibility rule as farmers/demo plots: Super Admin sees everything,
// everyone else is scoped to the villages their location assignments
// cover - generalized here since a profile's own location can itself be a
// village, block, or district (see isLocationCovered).
institutionsRouter.get('/institutions', requireAuth, async (req, res) => {
  const raw = await pool.query(`${SELECT_INSTITUTIONS_RAW} order by created_at desc limit 500`);
  let rows = raw.rows;
  if (req.user.role !== 'super_admin') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    const covered = await Promise.all(rows.map((r) => isLocationCovered(r.location_level, r.location_id, villageIds)));
    rows = rows.filter((_, i) => covered[i]);
  }
  const institutions = await attachLocationNames(rows.slice(0, 200));
  res.json({ institutions });
});

institutionsRouter.get('/institutions/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  const raw = await pool.query(
    `${SELECT_INSTITUTIONS_RAW} where name ilike $1 order by created_at desc limit 500`,
    [`%${q}%`],
  );
  let rows = raw.rows;
  if (req.user.role !== 'super_admin') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    const covered = await Promise.all(rows.map((r) => isLocationCovered(r.location_level, r.location_id, villageIds)));
    rows = rows.filter((_, i) => covered[i]);
  }
  const institutions = await attachLocationNames(rows.slice(0, 100));
  res.json({ institutions });
});

institutionsRouter.get('/institutions/:id', requireAuth, async (req, res) => {
  const result = await pool.query(`${SELECT_INSTITUTIONS_RAW} where id = $1`, [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such institution' });
  const [institution] = await attachLocationNames(result.rows);
  res.json({ institution });
});

institutionsRouter.post('/institutions', requireAuth, async (req, res) => {
  const { name, orgType, orgTypeOther, locationLevel, locationId } = req.body;
  if (!name || !orgType || !locationLevel || !locationId) {
    return res.status(400).json({ error: 'name, orgType, locationLevel, and locationId are all required' });
  }
  if (!ORG_TYPES.includes(orgType)) {
    return res.status(400).json({ error: `orgType must be one of: ${ORG_TYPES.join(', ')}` });
  }
  if (orgType === 'others' && !orgTypeOther?.trim()) {
    return res.status(400).json({ error: 'orgTypeOther is required when orgType is "others"' });
  }
  if (!LOCATION_LEVELS.includes(locationLevel)) {
    return res.status(400).json({ error: `locationLevel must be one of: ${LOCATION_LEVELS.join(', ')}` });
  }

  // No FK is possible on location_id (it can point at three different
  // tables), so confirm it actually exists at the given level before
  // inserting - resolveLocationPath returns null for a bad id.
  const path = await resolveLocationPath(locationLevel, locationId);
  if (!path) return res.status(400).json({ error: 'No such location' });

  try {
    const result = await pool.query(
      `insert into institutions (name, org_type, org_type_other, location_level, location_id, created_by)
       values ($1, $2, $3, $4, $5, $6)
       returning id, name, org_type, org_type_other, location_level, location_id, created_at`,
      [name, orgType, orgType === 'others' ? orgTypeOther.trim() : null, locationLevel, locationId, req.user.userId],
    );
    const institution = {
      ...result.rows[0],
      location_name: path.village_name ?? path.block_name ?? path.district_name ?? null,
      block_name: path.block_name,
      district_name: path.district_name,
      state_name: path.state_name,
      country_name: path.country_name,
    };
    res.status(201).json({ institution });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
