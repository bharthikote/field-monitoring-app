import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { createNotification, createNotifications } from './notifications.js';
import { getCoveredVillageIds, countryIdForVillage, GLOBAL_SCOPE_ROLES } from '../db/locationHelpers.js';

export const issuesRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidId(value) {
  return value === null || value === undefined || value === '' || UUID_RE.test(value);
}

// Who ends up with an issue is decided by walking a ladder of roles, lowest
// first, and taking the first active person who actually covers the plot's
// village - so an issue never lands on someone with no connection to it.
// Nobody at a level covers the village -> it climbs to the next level, up to
// Super Admin (who covers everything), and that person can then reassign it
// to anyone appropriate.
//
// Issues: the covering TFO first (routing is flat - whoever raised it).
export const ROUTING_LADDER = ['tfo', 'supervisor', 'team_lead', 'country_manager', 'admin', 'leadership', 'super_admin'];
// Acknowledge-only issues start at the Team Lead instead.
export const ACK_LADDER = ['team_lead', 'country_manager', 'admin', 'leadership', 'super_admin'];
// Who reviews a disputed issue: the Supervisor, then up.
const REVIEW_LADDER = ['supervisor', 'team_lead', 'country_manager', 'admin', 'leadership', 'super_admin'];

// Who verifies a resolution, keyed by the resolver's own role - one rung
// above them, then up. A role missing here (country_manager and above)
// means "nobody left to check this - auto-close on resolve" instead.
const VERIFIER_LADDER_FOR = {
  tfo: ['supervisor', 'team_lead', 'country_manager', 'admin', 'leadership', 'super_admin'],
  supervisor: ['country_manager', 'admin', 'leadership', 'super_admin'],
  team_lead: ['country_manager', 'admin', 'leadership', 'super_admin'],
};

// Roles a current holder can hand an issue to when it's real but not their
// responsibility (e.g. a missing crop board that was someone else's to
// supply, or nobody covers the village and it climbed to them). Chainable:
// whoever receives it can reassign again the same way.
const REASSIGNABLE_ROLES = ['supervisor', 'team_lead', 'country_manager', 'admin'];

// Anyone above a TFO can also hand an issue back down to a TFO - the usual
// case being a Team Lead who took it because he had to supply something
// (chemicals, a crop board), and now needs the TFO to actually apply it. A
// TFO still can't hand it sideways to another TFO.
function reassignTargetRoles(callerRole) {
  return callerRole === 'tfo' ? REASSIGNABLE_ROLES : [...REASSIGNABLE_ROLES, 'tfo'];
}

const SELECT_ISSUES = `
  select i.id, i.demo_plot_id, i.status, i.photo_url, i.resolution_note, i.rejection_note,
    i.dispute_note, i.dismissal_note, i.reopened_count, i.created_at, i.assigned_at,
    i.started_at, i.resolved_at, i.disputed_at, i.dismissed_at, i.closed_at,
    it.name as issue_type_name, it.acknowledge_only,
    dp.farmer_name, dp.farmer_phone, dp.village_id, vi.name as village_name,
    ru.id as raised_by_id, ru.name as raised_by_name,
    au.id as assigned_to_id, au.name as assigned_to_name, au.role as assigned_to_role,
    rb.id as resolved_by_id, rb.name as resolved_by_name,
    db.id as disputed_by_id, db.name as disputed_by_name
  from issues i
  join issue_types it on it.id = i.issue_type_id
  join demo_plots dp on dp.id = i.demo_plot_id
  join villages vi on vi.id = dp.village_id
  join users ru on ru.id = i.raised_by
  left join users au on au.id = i.assigned_to
  left join users rb on rb.id = i.resolved_by
  left join users db on db.id = i.disputed_by
`;

// Active users of `role` who actually cover `villageId`. Only 'approved'
// accounts count, so deactivated/rejected/pending people are never picked.
// Leadership and Super Admin work across every country, so they cover
// everything; every other role has to have the village in their assigned
// coverage (the same include/exclude logic every list in the app uses). No
// fallback to "anyone in the country" - that's what the ladder is for.
export async function findCoveringUsers(role, villageId) {
  if (GLOBAL_SCOPE_ROLES.includes(role)) {
    const all = await pool.query(
      `select id, name, role from users where role = $1 and status = 'approved' order by name`,
      [role],
    );
    return all.rows;
  }
  const countryId = await countryIdForVillage(villageId);
  if (!countryId) return [];
  const candidates = await findCountryUsers([role], villageId);
  const checks = await Promise.all(
    candidates.map(async (u) => ((await getCoveredVillageIds(u.id)).includes(villageId) ? u : null)),
  );
  return checks.filter(Boolean);
}

// Approved users of any of `roles` who have some location in this village's
// country (Leadership/Super Admin, if asked for, count everywhere) - the wide
// list behind the reassign picker and manual assignment, where the person
// choosing knows better than coverage does who should take it.
export async function findCountryUsers(roles, villageId) {
  const countryId = await countryIdForVillage(villageId);
  if (!countryId) return [];
  const result = await pool.query(
    `select distinct u.id, u.name, u.role
     from users u
     left join user_locations ul on ul.user_id = u.id
     where u.role = any($1) and u.status = 'approved'
       and (
         u.role = any($3)
         or (ul.level = 'country' and ul.location_id = $2)
         or (ul.level = 'state' and ul.location_id in (select id from states where country_id = $2))
         or (ul.level = 'district' and ul.location_id in (
           select d.id from districts d join states s on s.id = d.state_id where s.country_id = $2))
         or (ul.level = 'block' and ul.location_id in (
           select b.id from blocks b join districts d on d.id = b.district_id join states s on s.id = d.state_id where s.country_id = $2))
         or (ul.level = 'village' and ul.location_id in (
           select v.id from villages v join blocks b on b.id = v.block_id join districts d on d.id = b.district_id join states s on s.id = d.state_id where s.country_id = $2))
       )
     order by u.name`,
    [roles, countryId, GLOBAL_SCOPE_ROLES],
  );
  return result.rows;
}

// Walk a ladder of roles and return the first person who covers the village
// (name-sorted within a level), or null if nobody at any level does.
// `excludeUserId` skips one person - whoever raised/resolved/disputed it, who
// can't be the one to act on their own item.
export async function findResponsible(villageId, ladder, excludeUserId) {
  for (const role of ladder) {
    const covering = (await findCoveringUsers(role, villageId)).filter((u) => u.id !== excludeUserId);
    if (covering.length > 0) return covering[0];
  }
  return null;
}

// Who an issue starts with when it's created: acknowledge-only types go to
// the Team Lead level, everything else to the TFO level.
function routingLadderFor(acknowledgeOnly) {
  return acknowledgeOnly ? ACK_LADDER : ROUTING_LADDER;
}

issuesRouter.get('/issues/assignable-users', requireAuth, async (req, res) => {
  // Only reachable for a 'raised' issue (the ladder found nobody at all) -
  // the manual fallback offers the level automatic routing would have
  // started at, which depends on the issue's type.
  const { villageId, issueId } = req.query;
  if (!isValidId(villageId) || !isValidId(issueId)) return res.status(400).json({ error: 'Invalid id' });
  if (!villageId) return res.json({ users: [] });
  let acknowledgeOnly = false;
  if (issueId) {
    const typeResult = await pool.query(
      `select it.acknowledge_only from issues i join issue_types it on it.id = i.issue_type_id where i.id = $1`,
      [issueId],
    );
    acknowledgeOnly = typeResult.rows[0]?.acknowledge_only ?? false;
  }
  res.json({ users: await findCountryUsers([routingLadderFor(acknowledgeOnly)[0]], villageId) });
});

issuesRouter.get('/issues/reassignable-users', requireAuth, async (req, res) => {
  const { villageId } = req.query;
  if (!villageId || !isValidId(villageId)) return res.status(400).json({ error: 'villageId is required' });
  const users = await findCountryUsers(reassignTargetRoles(req.user.role), villageId);
  res.json({ users: users.filter((u) => u.id !== req.user.userId) });
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

// Dashboard counts across every issue this user is involved in (raised,
// currently holding, resolved, disputed, or part of a reassignment) - not
// just what's sitting with them right now, since a TFO who disputes or
// reassigns an issue no longer holds it but still needs to see it counted.
// Buckets are mutually exclusive: an open issue that has been reassigned at
// least once counts as Reassigned, not also as Assigned/In Progress.
issuesRouter.get('/issues/stats', requireAuth, async (req, res) => {
  const result = await pool.query(
    `with mine as (
       select i.status, i.assigned_to = $1 as is_mine,
         exists (select 1 from issue_reassignments ir where ir.issue_id = i.id) as was_reassigned
       from issues i
       where i.raised_by = $1 or i.assigned_to = $1 or i.resolved_by = $1 or i.disputed_by = $1
         or exists (
           select 1 from issue_reassignments ir
           where ir.issue_id = i.id and (ir.from_user_id = $1 or ir.to_user_id = $1)
         )
     )
     select
       count(*) filter (where status = 'assigned' and not was_reassigned)::int as assigned,
       count(*) filter (where status = 'in_progress' and not was_reassigned)::int as in_progress,
       count(*) filter (where status = 'pending_verification')::int as pending_verification,
       count(*) filter (where status in ('assigned', 'in_progress') and was_reassigned)::int as reassigned,
       count(*) filter (where status = 'disputed')::int as disputed,
       count(*) filter (where status = 'closed')::int as closed,
       count(*) filter (where is_mine and status in ('assigned', 'pending_verification', 'disputed'))::int as needs_action
     from mine`,
    [req.user.userId],
  );
  res.json({ stats: result.rows[0] });
});

// What's already open on a plot and who has it - so Log Visit can say
// "this is already raised, with <name>" instead of the visitor creating a
// duplicate. "Open" is anything not yet closed or dismissed.
issuesRouter.get('/issues/open-for-plot', requireAuth, async (req, res) => {
  const { demoPlotId } = req.query;
  if (!demoPlotId || !isValidId(demoPlotId)) return res.status(400).json({ error: 'demoPlotId is required' });
  const result = await pool.query(
    `select i.issue_type_id, it.name as issue_type_name, i.status, au.name as holder_name
     from issues i
     join issue_types it on it.id = i.issue_type_id
     left join users au on au.id = i.assigned_to
     where i.demo_plot_id = $1 and i.status not in ('closed', 'dismissed')
     order by it.name`,
    [demoPlotId],
  );
  res.json({ issues: result.rows });
});

// Anyone who has touched the issue can still open it - not just the current
// holder. assigned_to moves on at every hand-off (resolve -> verifier,
// dispute -> reviewer, reassign -> new holder), so without this a TFO who
// resolved something couldn't open the "verified and closed" notification
// they get about their own work.
async function canViewIssue(issueId, userId) {
  const result = await pool.query(
    `select 1 from issues i where i.id = $1 and (
       i.raised_by = $2 or i.assigned_to = $2 or i.resolved_by = $2 or i.disputed_by = $2
       or exists (
         select 1 from issue_reassignments ir
         where ir.issue_id = i.id and (ir.from_user_id = $2 or ir.to_user_id = $2)
       )
     )`,
    [issueId, userId],
  );
  return result.rowCount > 0;
}

issuesRouter.get('/issues/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });
  const result = await pool.query(`${SELECT_ISSUES} where i.id = $1`, [id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  if (!(await canViewIssue(id, req.user.userId))) {
    return res.status(403).json({ error: "This issue isn't yours to view" });
  }
  res.json({ issue: result.rows[0] });
});

// Manual fallback - only for an issue auto-routing couldn't place (no TFO
// found at all). Same person who raised it picks a TFO from the same
// coverage-matched candidate list automatic routing would have used.
issuesRouter.post('/issues/:id/assign', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { assignedTo } = req.body;
  if (!isValidId(id) || !UUID_RE.test(assignedTo || '')) return res.status(400).json({ error: 'Invalid id' });

  const result = await pool.query(
    `select i.raised_by, i.status, it.name as issue_type_name, it.acknowledge_only, dp.village_id
     from issues i join issue_types it on it.id = i.issue_type_id join demo_plots dp on dp.id = i.demo_plot_id
     where i.id = $1`,
    [id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.raised_by !== req.user.userId) return res.status(403).json({ error: 'Only the person who raised this can assign it' });
  if (issue.status !== 'raised') return res.status(400).json({ error: 'This issue is already assigned' });

  const candidates = await findCountryUsers([routingLadderFor(issue.acknowledge_only)[0]], issue.village_id);
  if (!candidates.some((c) => c.id === assignedTo)) {
    return res.status(400).json({ error: 'Not a valid person to assign this to' });
  }

  await pool.query(
    `update issues set assigned_to = $1, status = 'assigned', assigned_at = now() where id = $2`,
    [assignedTo, id],
  );
  await createNotification(assignedTo, id, 'issue_assigned', `You've been assigned a new issue: ${issue.issue_type_name}`);
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

// Marks the current holder's work done and routes it on for verification,
// escalating by the resolver's own role (see VERIFIER_LADDER_FOR) rather than
// assuming a TFO always did the work, since reassignment can hand this to
// a Team Lead/Country Manager/Supervisor instead. No one left to check
// (Country Manager resolving, or nobody of the escalation role exists at
// all) closes it outright rather than stranding it.
issuesRouter.post('/issues/:id/resolve', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });

  const result = await pool.query(
    `select i.assigned_to, i.status, i.raised_by, dp.village_id, it.name as issue_type_name, it.acknowledge_only
     from issues i join issue_types it on it.id = i.issue_type_id join demo_plots dp on dp.id = i.demo_plot_id
     where i.id = $1`,
    [id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.assigned_to !== req.user.userId) return res.status(403).json({ error: 'This issue is not assigned to you' });
  if (!['assigned', 'in_progress'].includes(issue.status)) {
    return res.status(400).json({ error: 'This issue is not in a state that can be resolved' });
  }
  if (issue.acknowledge_only) {
    return res.status(400).json({ error: 'This kind of issue is acknowledged, not resolved' });
  }

  const verifierLadder = VERIFIER_LADDER_FOR[req.user.role];
  const verifier = verifierLadder ? await findResponsible(issue.village_id, verifierLadder, req.user.userId) : null;

  if (verifier) {
    await pool.query(
      `update issues set status = 'pending_verification', resolved_at = now(), resolution_note = $1,
         resolved_by = $2, assigned_to = $3 where id = $4`,
      [note?.trim() || null, req.user.userId, verifier.id, id],
    );
    await createNotification(
      verifier.id,
      id,
      'issue_resolved',
      `${issue.issue_type_name} was marked resolved and is waiting for your verification`,
    );
  } else {
    await pool.query(
      `update issues set status = 'closed', closed_at = now(), resolved_at = now(), resolution_note = $1,
         resolved_by = $2, assigned_to = $2 where id = $3`,
      [note?.trim() || null, req.user.userId, id],
    );
    await createNotification(issue.raised_by, id, 'issue_verified', `${issue.issue_type_name} was resolved and closed`);
  }
  res.json({ ok: true });
});

// For issue types flagged acknowledge-only (a fact about the site that
// can't be fixed, like a plot not being visible from the main road): the
// holder (normally the covering Team Lead) acknowledges it, and that closes
// it - there's nothing to resolve or verify.
issuesRouter.post('/issues/:id/acknowledge', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });

  const result = await pool.query(
    `select i.assigned_to, i.status, i.raised_by, it.name as issue_type_name, it.acknowledge_only
     from issues i join issue_types it on it.id = i.issue_type_id where i.id = $1`,
    [id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (!issue.acknowledge_only) return res.status(400).json({ error: 'This issue needs resolving, not acknowledging' });
  if (issue.assigned_to !== req.user.userId) return res.status(403).json({ error: 'This issue is not assigned to you' });
  if (!['assigned', 'in_progress'].includes(issue.status)) {
    return res.status(400).json({ error: 'This issue is not in a state that can be acknowledged' });
  }

  await pool.query(
    `update issues set status = 'closed', closed_at = now(), resolved_at = now(), resolution_note = $1,
       resolved_by = $2, verified_by = $2 where id = $3`,
    [note?.trim() || null, req.user.userId, id],
  );
  if (issue.raised_by !== req.user.userId) {
    await createNotification(issue.raised_by, id, 'issue_verified', `${issue.issue_type_name} you raised was acknowledged and closed`);
  }
  res.json({ ok: true });
});

issuesRouter.post('/issues/:id/verify', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { approved, note } = req.body;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });

  const result = await pool.query(
    `select i.raised_by, i.status, i.assigned_to, i.resolved_by, it.name as issue_type_name
     from issues i join issue_types it on it.id = i.issue_type_id where i.id = $1`,
    [id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.assigned_to !== req.user.userId) return res.status(403).json({ error: 'This issue is not waiting for your verification' });
  if (issue.status !== 'pending_verification') return res.status(400).json({ error: 'This issue is not waiting for verification' });

  if (approved) {
    await pool.query(
      `update issues set status = 'closed', closed_at = now(), verified_by = $1 where id = $2`,
      [req.user.userId, id],
    );
    await createNotification(issue.resolved_by, id, 'issue_verified', `${issue.issue_type_name} was verified and closed`);
    await createNotification(issue.raised_by, id, 'issue_verified', `${issue.issue_type_name} you raised was resolved and closed`);
  } else {
    await pool.query(
      `update issues set status = 'assigned', assigned_to = $1, resolved_at = null, rejection_note = $2, reopened_count = reopened_count + 1 where id = $3`,
      [issue.resolved_by, note?.trim() || null, id],
    );
    await createNotification(issue.resolved_by, id, 'issue_reopened', `${issue.issue_type_name} was rejected and reopened for you`);
  }
  res.json({ ok: true });
});

// Approve many resolutions in one shot - a Supervisor gets a steady stream
// from many TFOs and verifying each individually doesn't scale. Approve
// only: rejecting needs a note per issue, so that stays a one-at-a-time
// action from the issue itself. Anything not currently waiting on this
// user (already handled, or never theirs) is skipped rather than failing
// the whole batch.
issuesRouter.post('/issues/bulk-verify', requireAuth, async (req, res) => {
  const { issueIds } = req.body;
  if (!Array.isArray(issueIds) || issueIds.length === 0) {
    return res.status(400).json({ error: 'issueIds must be a non-empty list' });
  }
  if (issueIds.length > 100) {
    return res.status(400).json({ error: 'Verify at most 100 issues at a time' });
  }
  if (!issueIds.every((v) => typeof v === 'string' && UUID_RE.test(v))) {
    return res.status(400).json({ error: 'One of the submitted ids is invalid' });
  }

  const result = await pool.query(
    `update issues i set status = 'closed', closed_at = now(), verified_by = $1
     from issue_types it
     where it.id = i.issue_type_id and i.id = any($2)
       and i.assigned_to = $1 and i.status = 'pending_verification'
     returning i.id, i.raised_by, i.resolved_by, it.name as issue_type_name`,
    [req.user.userId, issueIds],
  );

  const notifications = [];
  for (const row of result.rows) {
    notifications.push({ userId: row.resolved_by, issueId: row.id, type: 'issue_verified', message: `${row.issue_type_name} was verified and closed` });
    notifications.push({ userId: row.raised_by, issueId: row.id, type: 'issue_verified', message: `${row.issue_type_name} you raised was resolved and closed` });
  }
  await createNotifications(notifications);

  res.json({ closed: result.rowCount, skipped: issueIds.length - result.rowCount });
});

// The current holder questions whether this is even a real issue (as
// opposed to reassign, which accepts it's real but says it's someone
// else's job) - routes to the Supervisor for this village to check
// authenticity, regardless of who originally raised it.
issuesRouter.post('/issues/:id/dispute', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { note } = req.body;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!note?.trim()) return res.status(400).json({ error: 'A note explaining the dispute is required' });

  const result = await pool.query(
    `select i.assigned_to, i.status, i.raised_by, dp.village_id, it.name as issue_type_name
     from issues i join issue_types it on it.id = i.issue_type_id join demo_plots dp on dp.id = i.demo_plot_id
     where i.id = $1`,
    [id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.assigned_to !== req.user.userId) return res.status(403).json({ error: 'This issue is not assigned to you' });
  if (!['assigned', 'in_progress'].includes(issue.status)) {
    return res.status(400).json({ error: 'This issue is not in a state that can be disputed' });
  }
  // Disputing means "I don't think this is real" - it can't come from the
  // person who raised it, who is vouching that it is. An issue can come
  // back to its raiser via reassignment (e.g. a Team Lead who has to supply
  // something), and that must not open a dispute against himself.
  if (issue.raised_by === req.user.userId) {
    return res.status(400).json({ error: "You raised this issue, so you can't dispute it" });
  }

  const reviewer = await findResponsible(issue.village_id, REVIEW_LADDER, req.user.userId);
  await pool.query(
    `update issues set status = 'disputed', assigned_to = $1, disputed_by = $2, dispute_note = $3, disputed_at = now() where id = $4`,
    [reviewer?.id ?? null, req.user.userId, note.trim(), id],
  );
  if (reviewer) {
    await createNotification(reviewer.id, id, 'issue_disputed', `${issue.issue_type_name} was disputed - please check if it's genuine`);
  }
  res.json({ ok: true });
});

// The Supervisor's call on a disputed issue: genuine -> they resolve it
// directly and it closes immediately (no bouncing back to the TFO, no
// separate verification step - the Supervisor already is the verifier for
// a TFO's work, so there's nothing left to check). Not genuine -> a
// distinct dismissed state, so reporting can tell "actually fixed" apart
// from "was never real" rather than lumping both into a plain closed count.
issuesRouter.post('/issues/:id/dispute-review', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { genuine, note } = req.body;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!genuine && !note?.trim()) {
    return res.status(400).json({ error: 'A note explaining why this is being dismissed is required' });
  }

  const result = await pool.query(
    `select i.assigned_to, i.status, i.raised_by, i.disputed_by, it.name as issue_type_name
     from issues i join issue_types it on it.id = i.issue_type_id where i.id = $1`,
    [id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.assigned_to !== req.user.userId) return res.status(403).json({ error: 'This dispute is not assigned to you to review' });
  if (issue.status !== 'disputed') return res.status(400).json({ error: 'This issue is not waiting for a dispute review' });

  if (genuine) {
    await pool.query(
      `update issues set status = 'closed', closed_at = now(), resolved_at = now(), resolution_note = $1,
         resolved_by = $2, verified_by = $2 where id = $3`,
      [note?.trim() || null, req.user.userId, id],
    );
    await createNotification(issue.disputed_by, id, 'issue_verified', `${issue.issue_type_name} was confirmed genuine and resolved`);
    await createNotification(issue.raised_by, id, 'issue_verified', `${issue.issue_type_name} you raised was resolved and closed`);
  } else {
    await pool.query(
      `update issues set status = 'dismissed', dismissed_at = now(), dismissal_note = $1 where id = $2`,
      [note.trim(), id],
    );
    await createNotification(issue.disputed_by, id, 'issue_dismissed', `${issue.issue_type_name} was dismissed as not genuine`);
    await createNotification(issue.raised_by, id, 'issue_dismissed', `${issue.issue_type_name} you raised was dismissed as not genuine`);
  }
  res.json({ ok: true });
});

// Hands a real issue to whoever's actually responsible for it (e.g. a
// missing crop board that a Team Lead/Country Manager/Supervisor was
// supposed to supply) - chainable, so the new holder can reassign again if
// it's still not their job. Full history kept in issue_reassignments so a
// pattern of bouncing is visible later, not just the latest hop.
issuesRouter.post('/issues/:id/reassign', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { assignedTo, comment } = req.body;
  if (!isValidId(id) || !UUID_RE.test(assignedTo || '')) return res.status(400).json({ error: 'Invalid id' });
  if (!comment?.trim()) return res.status(400).json({ error: 'A comment explaining the reassignment is required' });
  if (assignedTo === req.user.userId) return res.status(400).json({ error: 'Cannot reassign to yourself' });

  const result = await pool.query(
    `select i.assigned_to, i.status, dp.village_id, it.name as issue_type_name
     from issues i join issue_types it on it.id = i.issue_type_id join demo_plots dp on dp.id = i.demo_plot_id
     where i.id = $1`,
    [id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such issue' });
  const issue = result.rows[0];
  if (issue.assigned_to !== req.user.userId) return res.status(403).json({ error: 'This issue is not assigned to you' });
  if (!['assigned', 'in_progress'].includes(issue.status)) {
    return res.status(400).json({ error: 'This issue is not in a state that can be reassigned' });
  }

  const candidates = await findCountryUsers(reassignTargetRoles(req.user.role), issue.village_id);
  if (!candidates.some((c) => c.id === assignedTo)) {
    return res.status(400).json({ error: 'Not a valid person to reassign this to' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update issues set assigned_to = $1, status = 'assigned', started_at = null where id = $2`,
      [assignedTo, id],
    );
    await client.query(
      `insert into issue_reassignments (issue_id, from_user_id, to_user_id, comment) values ($1, $2, $3, $4)`,
      [id, req.user.userId, assignedTo, comment.trim()],
    );
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    return res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
  await createNotification(
    assignedTo,
    id,
    'issue_reassigned',
    `${issue.issue_type_name} was reassigned to you: "${comment.trim()}"`,
  );
  res.json({ ok: true });
});

issuesRouter.get('/issues/:id/reassignments', requireAuth, async (req, res) => {
  const { id } = req.params;
  if (!isValidId(id)) return res.status(400).json({ error: 'Invalid id' });
  if (!(await canViewIssue(id, req.user.userId))) {
    return res.status(403).json({ error: "This issue isn't yours to view" });
  }
  const result = await pool.query(
    `select ir.id, ir.comment, ir.created_at,
       fu.name as from_name, tu.name as to_name
     from issue_reassignments ir
     join users fu on fu.id = ir.from_user_id
     join users tu on tu.id = ir.to_user_id
     where ir.issue_id = $1
     order by ir.created_at asc`,
    [id],
  );
  res.json({ reassignments: result.rows });
});
