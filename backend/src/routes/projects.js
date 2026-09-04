import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { resolveCountryId, resolveLocationPath } from '../db/locationHelpers.js';

// Project management - System Setting -> Project. Super Admin only for
// everything administrative (enforced below, not just hidden in the UI).
// Location/user assignment deliberately mirrors admin.js's existing
// user_locations pattern (one row per assignment, added/removed
// individually) rather than the batch-Save tree shown in the reference
// screenshots - that batch pattern doesn't actually exist anywhere in
// this app today; the real, working User Location Allocation tree
// auto-saves per checkbox, and this reuses that same shape.
export const projectsRouter = Router();
projectsRouter.param('id', validateUuidParam);
projectsRouter.param('assignmentId', validateUuidParam);
projectsRouter.param('userId', validateUuidParam);

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

function pathString(row) {
  return [row.country_name, row.state_name, row.district_name, row.block_name, row.village_name]
    .filter(Boolean)
    .join(' › ');
}

const STATUSES = ['ongoing', 'completed', 'terminated'];

// --- Project CRUD ---

const SELECT_PROJECTS = `
  select p.id, p.title, p.status, p.start_date::text as start_date, p.end_date::text as end_date,
    c.id as country_id, c.name as country_name
  from projects p join countries c on c.id = p.country_id
`;

projectsRouter.get('/projects', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { q, status, countryId } = req.query;
  const conditions = [];
  const params = [];
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    conditions.push(`p.title ilike $${params.length}`);
  }
  if (status && STATUSES.includes(status)) {
    params.push(status);
    conditions.push(`p.status = $${params.length}`);
  }
  if (countryId) {
    params.push(countryId);
    conditions.push(`p.country_id = $${params.length}`);
  }
  const where = conditions.length ? `where ${conditions.join(' and ')}` : '';
  const result = await pool.query(`${SELECT_PROJECTS} ${where} order by p.created_at desc`, params);
  res.json({ projects: result.rows });
});

function validateProjectFields(body) {
  const { title, countryId, startDate, endDate } = body;
  if (!title || !title.trim()) return 'Project Title is required';
  if (!countryId) return 'Country is required';
  if (!startDate || !endDate) return 'Start Date and End Date are required';
  if (endDate < startDate) return 'End Date cannot be before Start Date';
  for (const [key, label] of [
    ['targetFarmerTrained', 'Target Farmer Trained'], ['targetKeyFarmerTrained', 'Target Key Farmer Trained'],
    ['targetCoreFarmerTrained', 'Target Core Farmer Trained'], ['targetDemo', 'Target Demo'],
    ['targetKnowledgeAcquisition', 'Target Knowledge Acquisition'],
  ]) {
    const v = body[key];
    if (v !== undefined && v !== null && v !== '' && (Number.isNaN(Number(v)) || Number(v) < 0)) {
      return `${label} must be a non-negative number`;
    }
  }
  return null;
}

projectsRouter.post('/projects', requireAdmin, requireSuperAdmin, async (req, res) => {
  const validationError = validateProjectFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const {
    title, description, countryId, startDate, endDate,
    targetFarmerTrained, targetKeyFarmerTrained, targetCoreFarmerTrained, targetDemo, targetKnowledgeAcquisition,
  } = req.body;
  try {
    const result = await pool.query(
      `insert into projects (title, description, country_id, start_date, end_date,
         target_farmer_trained, target_key_farmer_trained, target_core_farmer_trained, target_demo, target_knowledge_acquisition, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id`,
      [
        title.trim(), description?.trim() || null, countryId, startDate, endDate,
        targetFarmerTrained || null, targetKeyFarmerTrained || null, targetCoreFarmerTrained || null,
        targetDemo || null, targetKnowledgeAcquisition || null, req.user.userId,
      ],
    );
    res.status(201).json({ project: { id: result.rows[0].id } });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'No such country' });
    res.status(500).json({ error: err.message });
  }
});

projectsRouter.get('/projects/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    `select p.id, p.title, p.description, p.status,
       p.start_date::text as start_date, p.end_date::text as end_date,
       p.target_farmer_trained, p.target_key_farmer_trained, p.target_core_farmer_trained,
       p.target_demo, p.target_knowledge_acquisition,
       c.id as country_id, c.name as country_name
     from projects p join countries c on c.id = p.country_id where p.id = $1`,
    [req.params.id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such project' });
  res.json({ project: result.rows[0] });
});

projectsRouter.patch('/projects/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const validationError = validateProjectFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const {
    title, description, countryId, startDate, endDate,
    targetFarmerTrained, targetKeyFarmerTrained, targetCoreFarmerTrained, targetDemo, targetKnowledgeAcquisition,
  } = req.body;
  try {
    const result = await pool.query(
      `update projects set title = $1, description = $2, country_id = $3, start_date = $4, end_date = $5,
         target_farmer_trained = $6, target_key_farmer_trained = $7, target_core_farmer_trained = $8,
         target_demo = $9, target_knowledge_acquisition = $10, updated_at = now()
       where id = $11 returning id`,
      [
        title.trim(), description?.trim() || null, countryId, startDate, endDate,
        targetFarmerTrained || null, targetKeyFarmerTrained || null, targetCoreFarmerTrained || null,
        targetDemo || null, targetKnowledgeAcquisition || null, req.params.id,
      ],
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'No such project' });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'No such country' });
    res.status(500).json({ error: err.message });
  }
});

// A normal user can only move Ongoing forward to Completed/Terminated;
// reopening back to Ongoing (a data-quality override) is Super Admin only
// here too - matches tfo_demos' own status transition rule exactly, for
// the same reason (this whole router is already Super Admin only, but
// kept explicit for symmetry/documentation with that established pattern).
projectsRouter.post('/projects/:id/status', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  const result = await pool.query('update projects set status = $1, updated_at = now() where id = $2 returning id, status', [status, req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such project' });
  res.json({ project: result.rows[0] });
});

// Hard delete only when genuinely unused (no locations, no members
// assigned yet) - otherwise this is exactly the "already has operational
// data" case the spec says must never be hard-deleted. Terminate instead.
projectsRouter.delete('/projects/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const used = await pool.query(
    `select exists(select 1 from project_locations where project_id = $1) or
            exists(select 1 from project_users where project_id = $1) as in_use`,
    [req.params.id],
  );
  if (used.rows[0].in_use) {
    return res.status(409).json({ error: 'This project has locations or users assigned and can\'t be deleted. Terminate it instead.' });
  }
  const result = await pool.query('delete from projects where id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such project' });
  res.status(204).end();
});

// --- Project Locations (flat set, no include/exclude - see file header) ---

const LOCATION_LEVELS = ['country', 'state', 'district', 'block', 'village'];

projectsRouter.get('/projects/:id/locations', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    'select id, level, location_id from project_locations where project_id = $1 order by created_at asc',
    [req.params.id],
  );
  const assignments = [];
  for (const row of result.rows) {
    const path = await resolveLocationPath(row.level, row.location_id);
    assignments.push({ id: row.id, level: row.level, locationId: row.location_id, path: path ? pathString(path) : '(deleted location)' });
  }
  res.json({ assignments });
});

projectsRouter.post('/projects/:id/locations', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { level, locationId } = req.body;
  if (!LOCATION_LEVELS.includes(level) || !locationId) {
    return res.status(400).json({ error: `level must be one of: ${LOCATION_LEVELS.join(', ')}, with a locationId` });
  }
  const countryId = await resolveCountryId(level, locationId);
  if (!countryId) return res.status(404).json({ error: 'No such location' });

  try {
    const result = await pool.query(
      `insert into project_locations (project_id, level, location_id, created_by) values ($1, $2, $3, $4) returning id`,
      [req.params.id, level, locationId, req.user.userId],
    );
    const path = await resolveLocationPath(level, locationId);
    res.status(201).json({ assignment: { id: result.rows[0].id, level, locationId, path: path ? pathString(path) : null } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That location is already assigned to this project' });
    if (err.code === '23503') return res.status(404).json({ error: 'No such project' });
    res.status(500).json({ error: err.message });
  }
});

// Removing a project location that a member's own project-scoped
// assignment depends on cascades that assignment too (see the FK on
// project_user_locations -> project_locations is NOT declared, so this
// is handled explicitly here) - rather than silently leaving an orphaned
// per-user assignment pointing at a location the project no longer has.
projectsRouter.delete('/projects/:id/locations/:assignmentId', requireAdmin, requireSuperAdmin, async (req, res) => {
  const existing = await pool.query('select level, location_id from project_locations where id = $1 and project_id = $2', [req.params.assignmentId, req.params.id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such assignment' });

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      'delete from project_user_locations where project_id = $1 and level = $2 and location_id = $3',
      [req.params.id, existing.rows[0].level, existing.rows[0].location_id],
    );
    await client.query('delete from project_locations where id = $1', [req.params.assignmentId]);
    await client.query('commit');
    res.status(204).end();
  } catch (err) {
    await client.query('rollback');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// --- Project Users (membership) ---

projectsRouter.get('/projects/:id/users', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    `select pu.user_id, u.name, u.role,
       (select count(*) from project_user_locations pul where pul.project_id = pu.project_id and pul.user_id = pu.user_id) as location_count
     from project_users pu join users u on u.id = pu.user_id
     where pu.project_id = $1 order by u.name asc`,
    [req.params.id],
  );
  res.json({ users: result.rows });
});

projectsRouter.post('/projects/:id/users', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId is required' });
  try {
    await pool.query(
      'insert into project_users (project_id, user_id, created_by) values ($1, $2, $3)',
      [req.params.id, userId, req.user.userId],
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'This user is already assigned to this project' });
    if (err.code === '23503') return res.status(404).json({ error: 'No such project or user' });
    res.status(500).json({ error: err.message });
  }
});

// Removing a member cascades their project_user_locations automatically
// (the composite FK is ON DELETE CASCADE).
projectsRouter.delete('/projects/:id/users/:userId', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query('delete from project_users where project_id = $1 and user_id = $2', [req.params.id, req.params.userId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such assignment' });
  res.status(204).end();
});

// --- Project + User Locations (the third level - a subset of the
// project's own locations, scoped to one member) ---

projectsRouter.get('/projects/:id/users/:userId/locations', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    'select id, level, location_id from project_user_locations where project_id = $1 and user_id = $2 order by created_at asc',
    [req.params.id, req.params.userId],
  );
  const assignments = [];
  for (const row of result.rows) {
    const path = await resolveLocationPath(row.level, row.location_id);
    assignments.push({ id: row.id, level: row.level, locationId: row.location_id, path: path ? pathString(path) : '(deleted location)' });
  }
  res.json({ assignments });
});

// The critical rule: a user can only receive a location that's already
// assigned to the project itself.
projectsRouter.post('/projects/:id/users/:userId/locations', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { level, locationId } = req.body;
  if (!LOCATION_LEVELS.includes(level) || !locationId) {
    return res.status(400).json({ error: `level must be one of: ${LOCATION_LEVELS.join(', ')}, with a locationId` });
  }
  const member = await pool.query('select 1 from project_users where project_id = $1 and user_id = $2', [req.params.id, req.params.userId]);
  if (member.rowCount === 0) return res.status(400).json({ error: 'This user must be assigned to the project before receiving a project location' });

  const inProject = await pool.query(
    'select 1 from project_locations where project_id = $1 and level = $2 and location_id = $3',
    [req.params.id, level, locationId],
  );
  if (inProject.rowCount === 0) {
    return res.status(400).json({ error: 'This location is not assigned to the project, so it can\'t be given to a user' });
  }

  try {
    const result = await pool.query(
      `insert into project_user_locations (project_id, user_id, level, location_id, created_by) values ($1, $2, $3, $4, $5) returning id`,
      [req.params.id, req.params.userId, level, locationId, req.user.userId],
    );
    const path = await resolveLocationPath(level, locationId);
    res.status(201).json({ assignment: { id: result.rows[0].id, level, locationId, path: path ? pathString(path) : null } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That location is already assigned to this user for this project' });
    res.status(500).json({ error: err.message });
  }
});

projectsRouter.delete('/projects/:id/users/:userId/locations/:assignmentId', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    'delete from project_user_locations where id = $1 and project_id = $2 and user_id = $3',
    [req.params.assignmentId, req.params.id, req.params.userId],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such assignment' });
  res.status(204).end();
});

// Powers the Projects section on a user's own profile page (reached from
// both All Users and Pending Approval, per the spec) - same
// requireAdminOrSelf shape as admin.js's other profile-facing endpoints
// would use, but this whole router is already Super Admin only, so a
// plain requireAdmin+requireSuperAdmin here is consistent with everything
// else in this file.
projectsRouter.get('/users/:userId/projects', requireAdmin, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    `select p.id, p.title, p.status,
       (select count(*) from project_user_locations pul where pul.project_id = p.id and pul.user_id = pu.user_id) as location_count
     from project_users pu join projects p on p.id = pu.project_id
     where pu.user_id = $1 order by p.title asc`,
    [req.params.userId],
  );
  res.json({ projects: result.rows });
});

// --- Mobile: resolving the active project for a logged-in field user ---

// Any authenticated user can see their own project memberships - used by
// the mobile app to decide whether a project-selection step is needed at
// all (zero -> proceed unscoped same as today, one -> auto-select, many
// -> ask), per the spec's explicit "don't force a selection screen if it
// can be automatically established" instruction.
projectsRouter.get('/my-projects', requireAuth, async (req, res) => {
  const result = await pool.query(
    `select p.id, p.title, p.status
     from project_users pu join projects p on p.id = pu.project_id
     where pu.user_id = $1 and p.status = 'ongoing'
     order by p.title asc`,
    [req.user.userId],
  );
  res.json({ projects: result.rows });
});
