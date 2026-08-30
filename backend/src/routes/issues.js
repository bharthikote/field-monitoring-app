import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadPhoto } from '../storage.js';

export const issuesRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function handleFileUpload(req, res, next) {
  upload.any()(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'The photo is too large (max 8MB)' });
    res.status(400).json({ error: err.message });
  });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidId(value) {
  return value === null || value === undefined || value === '' || UUID_RE.test(value);
}

// Who can raise an issue, and which roles they're allowed to route it to.
// Only these three roles raise issues at all (PRD Section 8) - tfo/admin/
// super_admin/leadership never appear here.
const ASSIGNABLE_TARGETS = {
  country_manager: ['team_lead', 'supervisor'],
  team_lead: ['supervisor'],
  supervisor: ['tfo'],
};

const SELECT_ISSUES = `
  select i.id, i.demo_plot_id, i.status, i.photo_url, i.resolution_note, i.rejection_note,
    i.reopened_count, i.created_at, i.assigned_at, i.started_at, i.resolved_at, i.closed_at,
    it.name as issue_type_name,
    dp.farmer_name, dp.farmer_phone, vi.name as village_name,
    ru.id as raised_by_id, ru.name as raised_by_name,
    au.id as assigned_to_id, au.name as assigned_to_name
  from issues i
  join issue_types it on it.id = i.issue_type_id
  join demo_plots dp on dp.id = i.demo_plot_id
  join villages vi on vi.id = dp.village_id
  join users ru on ru.id = i.raised_by
  left join users au on au.id = i.assigned_to
`;

// Candidates for the current user to assign to: approved users of a valid
// target role for their own role, within one of their own countries. There's
// no "this TFO reports to this Supervisor" data in the schema, so same-country
// is the closest real restriction available without a new reporting-line table.
async function assignableUsersFor(req) {
  const targetRoles = ASSIGNABLE_TARGETS[req.user.role];
  if (!targetRoles || !req.user.countryIds.length) return [];
  const result = await pool.query(
    `select distinct u.id, u.name, u.role
     from users u
     join user_locations ul on ul.user_id = u.id
     where u.role = any($1) and u.status = 'approved'
       and (
         (ul.level = 'country' and ul.location_id = any($2))
         or (ul.level = 'state' and ul.location_id in (select id from states where country_id = any($2)))
         or (ul.level = 'district' and ul.location_id in (
           select d.id from districts d join states s on s.id = d.state_id where s.country_id = any($2)))
         or (ul.level = 'block' and ul.location_id in (
           select b.id from blocks b join districts d on d.id = b.district_id join states s on s.id = d.state_id where s.country_id = any($2)))
         or (ul.level = 'village' and ul.location_id in (
           select v.id from villages v join blocks b on b.id = v.block_id join districts d on d.id = b.district_id join states s on s.id = d.state_id where s.country_id = any($2)))
       )
     order by u.name`,
    [targetRoles, req.user.countryIds],
  );
  return result.rows;
}

async function isValidAssignee(req, assignedTo) {
  const candidates = await assignableUsersFor(req);
  return candidates.some((c) => c.id === assignedTo);
}

issuesRouter.get('/issues/assignable-users', requireAuth, async (req, res) => {
  const users = await assignableUsersFor(req);
  res.json({ users });
});

issuesRouter.get('/issues/assigned-to-me', requireAuth, async (req, res) => {
  const result = await pool.query(
    `${SELECT_ISSUES} where i.assigned_to = $1 order by i.created_at desc`,
    [req.user.userId],
  );
  res.json({ issues: result.rows });
});

issuesRouter.get('/issues/raised-by-me', requireAuth, async (req, res) => {
  const result = await pool.query(
    `${SELECT_ISSUES} where i.raised_by = $1 order by i.created_at desc`,
    [req.user.userId],
  );
  res.json({ issues: result.rows });
});

issuesRouter.get('/issues/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });
  const result = await pool.query(`${SELECT_ISSUES} where i.id = $1`, [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.raised_by_id !== req.user.userId && issue.assigned_to_id !== req.user.userId) {
    return res.status(403).json({ error: "This issue isn't yours to view" });
  }
  res.json({ issue });
});

issuesRouter.post('/issues', requireAuth, handleFileUpload, async (req, res) => {
  const { demoPlotId, issueTypeId, assignedTo } = req.body;

  if (!ASSIGNABLE_TARGETS[req.user.role]) {
    return res.status(403).json({ error: 'Your role cannot raise issues' });
  }
  if (!demoPlotId || !issueTypeId) {
    return res.status(400).json({ error: 'demoPlotId and issueTypeId are required' });
  }
  if (![demoPlotId, issueTypeId, assignedTo].every(isValidId)) {
    return res.status(400).json({ error: 'One of the submitted ids is invalid' });
  }
  // Only Team Lead can hold an issue unassigned for later delegation -
  // everyone else must route it to someone immediately (PRD Section 8).
  if (!assignedTo && req.user.role !== 'team_lead') {
    return res.status(400).json({ error: 'assignedTo is required for your role' });
  }
  if (assignedTo && !(await isValidAssignee(req, assignedTo))) {
    return res.status(400).json({ error: 'Not a valid person to assign this to' });
  }

  const plotResult = await pool.query('select id from demo_plots where id = $1', [demoPlotId]);
  if (plotResult.rowCount === 0) return res.status(400).json({ error: 'No such demo plot' });

  const files = req.files || [];
  const photo = files.find((f) => f.fieldname === 'photo');
  const photoUrl = photo ? await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype) : null;

  try {
    const status = assignedTo ? 'assigned' : 'raised';
    const result = await pool.query(
      `insert into issues (demo_plot_id, issue_type_id, photo_url, raised_by, assigned_to, status, assigned_at)
       values ($1, $2, $3, $4, $5, $6, ${assignedTo ? 'now()' : 'null'})
       returning id, status, created_at`,
      [demoPlotId, issueTypeId, photoUrl, req.user.userId, assignedTo || null, status],
    );
    res.status(201).json({ issue: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'The demo plot or issue type no longer exists' });
    res.status(500).json({ error: err.message });
  }
});

issuesRouter.post('/issues/:id/assign', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;
  if (!isValidId(id) || !UUID_RE.test(assignedTo || '')) return res.status(400).json({ error: 'Invalid id' });

  const result = await pool.query('select raised_by, status from issues where id = $1', [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.raised_by !== req.user.userId) return res.status(403).json({ error: 'Only the person who raised this can assign it' });
  if (issue.status !== 'raised') return res.status(400).json({ error: 'This issue is already assigned' });
  if (!(await isValidAssignee(req, assignedTo))) return res.status(400).json({ error: 'Not a valid person to assign this to' });

  await pool.query(
    `update issues set assigned_to = $1, status = 'assigned', assigned_at = now() where id = $2`,
    [assignedTo, id],
  );
  res.json({ ok: true });
});

issuesRouter.post('/issues/:id/start', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });

  const result = await pool.query('select assigned_to, status from issues where id = $1', [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.assigned_to !== req.user.userId) return res.status(403).json({ error: 'This issue is not assigned to you' });
  if (issue.status !== 'assigned') return res.status(400).json({ error: 'This issue is not waiting to be started' });

  await pool.query(`update issues set status = 'in_progress', started_at = now() where id = $1`, [id]);
  res.json({ ok: true });
});

issuesRouter.post('/issues/:id/resolve', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });

  const result = await pool.query('select assigned_to, status from issues where id = $1', [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.assigned_to !== req.user.userId) return res.status(403).json({ error: 'This issue is not assigned to you' });
  if (!['assigned', 'in_progress'].includes(issue.status)) {
    return res.status(400).json({ error: 'This issue is not in a state that can be resolved' });
  }

  await pool.query(
    `update issues set status = 'pending_verification', resolved_at = now(), resolution_note = $1 where id = $2`,
    [note?.trim() || null, id],
  );
  res.json({ ok: true });
});

issuesRouter.post('/issues/:id/verify', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { approved, note } = req.body;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });

  const result = await pool.query('select raised_by, status from issues where id = $1', [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.raised_by !== req.user.userId) return res.status(403).json({ error: 'Only the person who raised this can verify it' });
  if (issue.status !== 'pending_verification') return res.status(400).json({ error: 'This issue is not waiting for verification' });

  if (approved) {
    await pool.query(
      `update issues set status = 'closed', closed_at = now(), verified_by = $1 where id = $2`,
      [req.user.userId, id],
    );
  } else {
    await pool.query(
      `update issues set status = 'assigned', resolved_at = null, rejection_note = $1, reopened_count = reopened_count + 1 where id = $2`,
      [note?.trim() || null, id],
    );
  }
  res.json({ ok: true });
});
