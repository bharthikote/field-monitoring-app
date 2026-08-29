import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { SELF_REGISTER_ROLES } from '../roles.js';

export const adminRouter = Router();

adminRouter.get('/admin/me', requireAdmin, async (req, res) => {
  const result = await pool.query(`select id, name, role from users where id = $1`, [req.user.userId]);
  res.json({ user: result.rows[0] });
});

adminRouter.get('/admin/users/pending', requireAdmin, async (_req, res) => {
  const result = await pool.query(
    `select id, user_code, name, mobile_number, email, role, status, created_at
     from users where status = 'pending' order by created_at asc`,
  );
  res.json({ users: result.rows });
});

adminRouter.post('/admin/users/:id/approve', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (role !== undefined && !SELF_REGISTER_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${SELF_REGISTER_ROLES.join(', ')}` });
  }

  const result = await pool.query(
    `update users set role = coalesce($3, role), status = 'approved',
       reviewed_by = $2, reviewed_at = now(), updated_at = now()
     where id = $1 and status = 'pending' returning id, name, role, status`,
    [req.params.id, req.user.userId, role ?? null],
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'No pending user with that id' });
  }
  res.json({ user: result.rows[0] });
});

adminRouter.post('/admin/users/:id/reject', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `update users set status = 'rejected', reviewed_by = $2, reviewed_at = now(), updated_at = now()
     where id = $1 and status = 'pending' returning id, name, status`,
    [req.params.id, req.user.userId],
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'No pending user with that id' });
  }
  res.json({ user: result.rows[0] });
});

adminRouter.get('/admin/users', requireAdmin, async (req, res) => {
  const scopeToOwnCountry = req.user.role !== 'super_admin';
  const result = await pool.query(
    `select u.id, u.user_code, u.name, u.mobile_number, u.email, u.role, u.status,
       u.location_level, c.name as country_name, s.name as state_name,
       d.name as district_name, b.name as block_name, v.name as village_name
     from users u
     left join countries c on c.id = u.country_id
     left join states s on s.id = u.state_id
     left join districts d on d.id = u.district_id
     left join blocks b on b.id = u.block_id
     left join villages v on v.id = u.village_id
     where not $1 or u.country_id = $2
     order by u.created_at asc`,
    [scopeToOwnCountry, req.user.countryId],
  );
  res.json({ users: result.rows });
});

adminRouter.post('/admin/users/:id/role', requireAdmin, async (req, res) => {
  const { role } = req.body;
  if (!SELF_REGISTER_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${SELF_REGISTER_ROLES.join(', ')}` });
  }
  const result = await pool.query(
    `update users set role = $2, updated_at = now() where id = $1 returning id, name, role`,
    [req.params.id, role],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such user' });
  res.json({ user: result.rows[0] });
});

const STATUSES = ['pending', 'approved', 'rejected'];

adminRouter.post('/admin/users/:id/status', requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  }
  if (req.params.id === req.user.userId) {
    return res.status(400).json({ error: "You can't change your own status" });
  }
  const result = await pool.query(
    `update users set status = $2, reviewed_by = $3, reviewed_at = now(), updated_at = now()
     where id = $1 returning id, name, status`,
    [req.params.id, status, req.user.userId],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such user' });
  res.json({ user: result.rows[0] });
});

const LOCATION_LEVELS = ['country', 'state', 'district', 'block', 'village'];

adminRouter.post('/admin/users/:id/assign-location', requireAdmin, async (req, res) => {
  const { level, locationId } = req.body;
  if (!LOCATION_LEVELS.includes(level) || !locationId) {
    return res.status(400).json({ error: `level must be one of: ${LOCATION_LEVELS.join(', ')}, with a locationId` });
  }

  if ((level === 'country' || level === 'state') && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can assign Country or State level' });
  }

  let chain;
  if (level === 'country') {
    const r = await pool.query('select id from countries where id = $1', [locationId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'No such country' });
    chain = { countryId: locationId, stateId: null, districtId: null, blockId: null, villageId: null };
  } else if (level === 'state') {
    const r = await pool.query('select country_id from states where id = $1', [locationId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'No such state' });
    chain = { countryId: r.rows[0].country_id, stateId: locationId, districtId: null, blockId: null, villageId: null };
  } else if (level === 'district') {
    const r = await pool.query(
      `select s.country_id, d.state_id from districts d join states s on s.id = d.state_id where d.id = $1`,
      [locationId],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No such district' });
    chain = { countryId: r.rows[0].country_id, stateId: r.rows[0].state_id, districtId: locationId, blockId: null, villageId: null };
  } else if (level === 'block') {
    const r = await pool.query(
      `select s.country_id, s.id as state_id, b.district_id from blocks b
       join districts d on d.id = b.district_id join states s on s.id = d.state_id where b.id = $1`,
      [locationId],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No such block' });
    chain = { countryId: r.rows[0].country_id, stateId: r.rows[0].state_id, districtId: r.rows[0].district_id, blockId: locationId, villageId: null };
  } else {
    const r = await pool.query(
      `select s.country_id, s.id as state_id, d.id as district_id, v.block_id from villages v
       join blocks b on b.id = v.block_id join districts d on d.id = b.district_id
       join states s on s.id = d.state_id where v.id = $1`,
      [locationId],
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'No such village' });
    chain = { countryId: r.rows[0].country_id, stateId: r.rows[0].state_id, districtId: r.rows[0].district_id, blockId: r.rows[0].block_id, villageId: locationId };
  }

  if (req.user.role !== 'super_admin' && req.user.countryId !== chain.countryId) {
    return res.status(403).json({ error: 'You can only assign locations within your own assigned country' });
  }

  const result = await pool.query(
    `update users set location_level = $2, country_id = $3, state_id = $4, district_id = $5,
       block_id = $6, village_id = $7, updated_at = now()
     where id = $1
     returning id, name, location_level`,
    [req.params.id, level, chain.countryId, chain.stateId, chain.districtId, chain.blockId, chain.villageId],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such user' });
  res.json({ user: result.rows[0] });
});
