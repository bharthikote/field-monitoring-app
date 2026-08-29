import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { resolveCountryId, resolveLocationPath } from '../db/locationHelpers.js';
import { SELF_REGISTER_ROLES } from '../roles.js';

export const adminRouter = Router();
adminRouter.param('id', validateUuidParam);
adminRouter.param('assignmentId', validateUuidParam);

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

// One row per user_locations assignment, with the full resolved name path
// and the country it falls under - regardless of which level it's at.
const LOCATION_SUMMARY_SQL = `
  select ul.user_id, ul.id as assignment_id, ul.level,
    c.id as country_id, c.name as country_name,
    null::text as state_name, null::text as district_name, null::text as block_name, null::text as village_name
  from user_locations ul join countries c on c.id = ul.location_id where ul.level = 'country'
  union all
  select ul.user_id, ul.id, ul.level, c.id, c.name, s.name, null, null, null
  from user_locations ul join states s on s.id = ul.location_id join countries c on c.id = s.country_id
  where ul.level = 'state'
  union all
  select ul.user_id, ul.id, ul.level, c.id, c.name, s.name, d.name, null, null
  from user_locations ul join districts d on d.id = ul.location_id
    join states s on s.id = d.state_id join countries c on c.id = s.country_id
  where ul.level = 'district'
  union all
  select ul.user_id, ul.id, ul.level, c.id, c.name, s.name, d.name, b.name, null
  from user_locations ul join blocks b on b.id = ul.location_id
    join districts d on d.id = b.district_id join states s on s.id = d.state_id join countries c on c.id = s.country_id
  where ul.level = 'block'
  union all
  select ul.user_id, ul.id, ul.level, c.id, c.name, s.name, d.name, b.name, v.name
  from user_locations ul join villages v on v.id = ul.location_id
    join blocks b on b.id = v.block_id join districts d on d.id = b.district_id
    join states s on s.id = d.state_id join countries c on c.id = s.country_id
  where ul.level = 'village'
`;

function pathString(row) {
  return [row.country_name, row.state_name, row.district_name, row.block_name, row.village_name]
    .filter(Boolean)
    .join(' › ');
}

async function getLocationSummaries() {
  const result = await pool.query(LOCATION_SUMMARY_SQL);
  const byUser = new Map();
  for (const row of result.rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, { paths: [], countryIds: new Set() });
    const entry = byUser.get(row.user_id);
    entry.paths.push(pathString(row));
    entry.countryIds.add(row.country_id);
  }
  return byUser;
}

adminRouter.get('/admin/users', requireAdmin, async (req, res) => {
  const scopeToOwnCountry = req.user.role !== 'super_admin';
  const result = await pool.query(
    `select id, user_code, name, mobile_number, email, role, status from users order by created_at asc`,
  );
  const summaries = await getLocationSummaries();

  const users = result.rows
    .map((u) => {
      const summary = summaries.get(u.id);
      return {
        ...u,
        location_summary: summary ? summary.paths.join('; ') : null,
        country_ids: summary ? [...summary.countryIds] : [],
      };
    })
    .filter((u) => !scopeToOwnCountry || u.country_ids.some((cid) => req.user.countryIds.includes(cid)));

  res.json({ users });
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

const STATUSES = ['pending', 'approved', 'rejected', 'deactivated'];

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

adminRouter.get('/admin/users/:id/profile', requireAdmin, async (req, res) => {
  const result = await pool.query(
    `select u.id, u.user_code, u.name, u.mobile_number, u.email, u.role, u.status,
       u.created_at, u.updated_at, u.reviewed_at, r.name as reviewed_by_name
     from users u
     left join users r on r.id = u.reviewed_by
     where u.id = $1`,
    [req.params.id],
  );
  if (!result.rows[0]) return res.status(404).json({ error: 'No such user' });
  res.json({ user: result.rows[0] });
});

adminRouter.post('/admin/users/:id/profile', requireAdmin, async (req, res) => {
  const { name, mobileNumber, email, role } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (!mobileNumber && !email) return res.status(400).json({ error: 'mobileNumber or email is required' });
  if (role !== undefined && !SELF_REGISTER_ROLES.includes(role)) {
    return res.status(400).json({ error: `role must be one of: ${SELF_REGISTER_ROLES.join(', ')}` });
  }

  try {
    const result = await pool.query(
      `update users set name = $2, mobile_number = $3, email = $4, role = coalesce($5, role), updated_at = now()
       where id = $1
       returning id, name, mobile_number, email, role`,
      [req.params.id, name, mobileNumber || null, email || null, role ?? null],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'No such user' });
    res.json({ user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Another account already uses that mobile number or email' });
    }
    res.status(500).json({ error: err.message });
  }
});

adminRouter.delete('/admin/users/:id', requireAdmin, async (req, res) => {
  if (req.params.id === req.user.userId) {
    return res.status(400).json({ error: "You can't delete your own account" });
  }
  try {
    const result = await pool.query('delete from users where id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'No such user' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'This user has related records (approvals reviewed, demo plots created, etc.) and can\'t be permanently deleted. Deactivate them instead.',
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// --- Location assignments: a user can hold multiple, at mixed levels
// (e.g. two whole blocks plus a handful of individual villages elsewhere).
// Coverage is the union of everything under every assigned node. ---

const LOCATION_LEVELS = ['country', 'state', 'district', 'block', 'village'];

adminRouter.get('/admin/users/:id/locations', requireAdmin, async (req, res) => {
  const result = await pool.query(
    'select id, level, location_id, mode from user_locations where user_id = $1 order by created_at asc',
    [req.params.id],
  );
  const assignments = [];
  for (const row of result.rows) {
    const path = await resolveLocationPath(row.level, row.location_id);
    assignments.push({
      id: row.id,
      level: row.level,
      locationId: row.location_id,
      mode: row.mode,
      path: path ? pathString(path) : '(deleted location)',
    });
  }
  res.json({ assignments });
});

// mode: 'include' assigns a location to the user; 'exclude' carves it (and
// everything under it) back out of a broader assignment inherited from an
// ancestor - e.g. include the whole country, exclude one district within it.
adminRouter.post('/admin/users/:id/locations', requireAdmin, async (req, res) => {
  const { level, locationId, mode } = req.body;
  const effectiveMode = mode || 'include';
  if (!LOCATION_LEVELS.includes(level) || !locationId) {
    return res.status(400).json({ error: `level must be one of: ${LOCATION_LEVELS.join(', ')}, with a locationId` });
  }
  if (!['include', 'exclude'].includes(effectiveMode)) {
    return res.status(400).json({ error: 'mode must be include or exclude' });
  }
  if ((level === 'country' || level === 'state') && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can assign Country or State level' });
  }

  const countryId = await resolveCountryId(level, locationId);
  if (!countryId) return res.status(404).json({ error: 'No such location' });
  if (req.user.role !== 'super_admin' && !req.user.countryIds.includes(countryId)) {
    return res.status(403).json({ error: 'You can only assign locations within your own assigned country' });
  }

  try {
    const result = await pool.query(
      `insert into user_locations (user_id, level, location_id, mode, created_by)
       values ($1, $2, $3, $4, $5)
       returning id, level, location_id, mode`,
      [req.params.id, level, locationId, effectiveMode, req.user.userId],
    );
    const path = await resolveLocationPath(level, locationId);
    res.status(201).json({ assignment: { ...result.rows[0], path: path ? pathString(path) : null } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That location already has an assignment for this user' });
    if (err.code === '23503') return res.status(404).json({ error: 'No such user' });
    res.status(500).json({ error: err.message });
  }
});

adminRouter.delete('/admin/users/:id/locations/:assignmentId', requireAdmin, async (req, res) => {
  const existing = await pool.query('select level, location_id from user_locations where id = $1 and user_id = $2', [
    req.params.assignmentId,
    req.params.id,
  ]);
  if (!existing.rows[0]) return res.status(404).json({ error: 'No such assignment' });

  const countryId = await resolveCountryId(existing.rows[0].level, existing.rows[0].location_id);
  if (req.user.role !== 'super_admin' && (!countryId || !req.user.countryIds.includes(countryId))) {
    return res.status(403).json({ error: 'You can only manage assignments within your own assigned country' });
  }

  await pool.query('delete from user_locations where id = $1', [req.params.assignmentId]);
  res.status(204).end();
});
