import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadPhoto } from '../storage.js';
import { getCoveredVillageIds, requireVillageInCoverage } from '../db/locationHelpers.js';
import { findResponsible, ROUTING_LADDER, ACK_LADDER } from './issues.js';
import { createNotifications } from './notifications.js';
import { requireLocation } from '../middleware/requireLocation.js';
import { parseGps } from '../gps.js';

export const visitsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function handleFileUpload(req, res, next) {
  upload.any()(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'A photo is too large (max 8MB each)' });
    res.status(400).json({ error: err.message });
  });
}

function fileFor(files, fieldname) {
  return files.find((f) => f.fieldname === fieldname);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidId(value) {
  return value === null || value === undefined || value === '' || UUID_RE.test(value);
}

function parseIdList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

const SELECT_VISITS = `
  select v.id, v.demo_plot_id, v.action_plan, v.comments, v.overall_photo_url, v.created_at,
    v.gps_lat, v.gps_lng, v.gps_accuracy,
    u.name as visited_by_name
  from visits v
  join users u on u.id = v.visited_by
`;

function groupByVisit(rows, mapRow) {
  const byVisit = new Map();
  for (const row of rows) {
    if (!byVisit.has(row.visit_id)) byVisit.set(row.visit_id, []);
    byVisit.get(row.visit_id).push(mapRow(row));
  }
  return byVisit;
}

async function attachVisitExtras(visits) {
  if (!visits.length) return visits;
  const ids = visits.map((v) => v.id);
  const [issuesResult, goodThingsResult, techniquesResult, diseasesResult, pestsResult] = await Promise.all([
    pool.query(
      `select vi.visit_id, it.name, vi.photo_url from visit_issues vi
       join issue_types it on it.id = vi.issue_type_id where vi.visit_id = any($1)`,
      [ids],
    ),
    pool.query(
      `select vg.visit_id, gt.name, vg.photo_url from visit_good_things vg
       join good_things_observed gt on gt.id = vg.good_thing_id where vg.visit_id = any($1)`,
      [ids],
    ),
    pool.query(
      `select vt.visit_id, t.name from visit_techniques vt
       join techniques t on t.id = vt.technique_id where vt.visit_id = any($1)`,
      [ids],
    ),
    pool.query(
      `select vd.visit_id, d.name, vd.disease_other, vd.photo_url from visit_diseases vd
       left join diseases d on d.id = vd.disease_id where vd.visit_id = any($1)`,
      [ids],
    ),
    pool.query(
      `select vp.visit_id, p.name, vp.pest_other, vp.photo_url from visit_pests vp
       left join pests p on p.id = vp.pest_id where vp.visit_id = any($1)`,
      [ids],
    ),
  ]);
  const issuesByVisit = groupByVisit(issuesResult.rows, (row) => ({ name: row.name, photoUrl: row.photo_url }));
  const goodThingsByVisit = groupByVisit(goodThingsResult.rows, (row) => ({ name: row.name, photoUrl: row.photo_url }));
  const techniquesByVisit = groupByVisit(techniquesResult.rows, (row) => ({ name: row.name }));
  const diseasesByVisit = groupByVisit(diseasesResult.rows, (row) => ({ name: row.name || row.disease_other, photoUrl: row.photo_url }));
  const pestsByVisit = groupByVisit(pestsResult.rows, (row) => ({ name: row.name || row.pest_other, photoUrl: row.photo_url }));
  return visits.map((v) => ({
    ...v,
    issues: issuesByVisit.get(v.id) || [],
    goodThings: goodThingsByVisit.get(v.id) || [],
    techniques: techniquesByVisit.get(v.id) || [],
    diseases: diseasesByVisit.get(v.id) || [],
    pests: pestsByVisit.get(v.id) || [],
  }));
}

// Powers the count badge on the Home screen's activity cards - how many
// visits this user has personally logged, all-time, optionally scoped to
// one plot type (Demo Plot vs Adoption Plot each show their own count).
visitsRouter.get('/visits/my-count', requireAuth, async (req, res) => {
  const { plot_type } = req.query;
  const result = await pool.query(
    `select count(*)::int as count from visits v
     join demo_plots dp on dp.id = v.demo_plot_id
     where v.visited_by = $1 and ($2::text is null or dp.plot_type = $2)`,
    [req.user.userId, plot_type || null],
  );
  res.json({ count: result.rows[0].count });
});

// Same visibility rule as demo plots themselves: Super Admin sees
// everything, everyone else is scoped to the villages their location
// assignments cover.
visitsRouter.get('/visits', requireAuth, async (req, res) => {
  const { demo_plot_id } = req.query;
  if (!demo_plot_id) return res.status(400).json({ error: 'demo_plot_id is required' });
  if (!isValidId(demo_plot_id)) return res.status(400).json({ error: 'Invalid demo_plot_id' });

  const plotResult = await pool.query('select village_id from demo_plots where id = $1', [demo_plot_id]);
  if (plotResult.rowCount === 0) return res.status(404).json({ error: 'No such demo plot' });

  if (req.user.role !== 'super_admin') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    if (!villageIds.includes(plotResult.rows[0].village_id)) {
      return res.status(403).json({ error: "This demo plot isn't in your assigned coverage" });
    }
  }

  const result = await pool.query(`${SELECT_VISITS} where v.demo_plot_id = $1 order by v.created_at desc`, [demo_plot_id]);
  const visits = await attachVisitExtras(result.rows);
  res.json({ visits });
});

visitsRouter.post('/visits', requireAuth, requireLocation, handleFileUpload, async (req, res) => {
  const files = req.files || [];
  const { demoPlotId, actionPlan, comments, diseaseOther, pestOther } = req.body;
  const issueTypeIds = parseIdList(req.body.issueTypeIds);
  const goodThingIds = parseIdList(req.body.goodThingIds);
  const techniqueIds = parseIdList(req.body.techniqueIds);
  const diseaseIds = parseIdList(req.body.diseaseIds);
  const pestIds = parseIdList(req.body.pestIds);

  if (!demoPlotId || !actionPlan?.trim() || !comments?.trim()) {
    return res.status(400).json({ error: 'demoPlotId, actionPlan, and comments are all required' });
  }
  if (![demoPlotId, ...issueTypeIds, ...goodThingIds, ...techniqueIds, ...diseaseIds, ...pestIds].every(isValidId)) {
    return res.status(400).json({ error: 'One of the submitted ids is invalid' });
  }

  const plotResult = await pool.query('select id, village_id from demo_plots where id = $1', [demoPlotId]);
  if (plotResult.rowCount === 0) return res.status(400).json({ error: 'No such demo plot' });
  const plotVillageId = plotResult.rows[0].village_id;
  // Logging a visit needs the plot to be in the caller's own coverage - the
  // mobile list only shows covered plots, but the endpoint itself never
  // checked, so anyone holding a plot id could log against it.
  if (!(await requireVillageInCoverage(req, res, plotVillageId))) return;

  const gps = parseGps(req.body);
  if (gps.error) return res.status(400).json({ error: gps.error });

  const overallPhoto = fileFor(files, 'overallPhoto');
  if (!overallPhoto) return res.status(400).json({ error: 'A photo of the visit is required' });

  // A photo is required for every selected disease/pest, including the
  // "Other" slot - matches the pre-existing "photo required when a
  // disease/pest is identified" rule, just enforced per item now.
  for (const diseaseId of diseaseIds) {
    if (!fileFor(files, `diseasePhoto_${diseaseId}`)) {
      return res.status(400).json({ error: 'A photo is required for every disease selected' });
    }
  }
  if (diseaseOther?.trim() && !fileFor(files, 'diseasePhotoOther')) {
    return res.status(400).json({ error: 'A photo is required for the Other disease entry' });
  }
  for (const pestId of pestIds) {
    if (!fileFor(files, `pestPhoto_${pestId}`)) {
      return res.status(400).json({ error: 'A photo is required for every pest selected' });
    }
  }
  if (pestOther?.trim() && !fileFor(files, 'pestPhotoOther')) {
    return res.status(400).json({ error: 'A photo is required for the Other pest entry' });
  }

  // Every issue type ticked under "Issues Observed Today" now becomes a
  // real, routed issue automatically - there's no separate manual raise-
  // issue step any more (that duplicated this exact checklist and only
  // confused which one was "the real" way to flag something). Routing is
  // flat: whoever logs the visit (Super Admin/Admin/Leadership/Country
  // Manager/Team Lead/Supervisor), it goes straight to the TFO who covers
  // this village. Nobody at TFO level covers it -> it climbs the ladder to
  // the first level that does (Supervisor, Team Lead, ... Super Admin), who
  // can reassign it. Acknowledge-only types (a fact about the site that can't
  // be fixed, e.g. plot not visible from the main road) start at the Team
  // Lead level instead, and closing them is just acknowledging - or, if a
  // Team Lead is the one raising it, they close immediately, since raising
  // it is already the acknowledgement. The raiser is never picked as the
  // person to act on their own issue.
  let issueTypes = new Map();
  if (issueTypeIds.length > 0) {
    const typesResult = await pool.query('select id, name, acknowledge_only from issue_types where id = any($1)', [issueTypeIds]);
    issueTypes = new Map(typesResult.rows.map((r) => [r.id, r]));
  }
  const needsTfo = issueTypeIds.some((id) => !issueTypes.get(id)?.acknowledge_only);
  const needsTeamLead = issueTypeIds.some((id) => issueTypes.get(id)?.acknowledge_only) && req.user.role !== 'team_lead';
  const tfoAssignee = needsTfo ? await findResponsible(plotVillageId, ROUTING_LADDER, req.user.userId) : null;
  const teamLeadAssignee = needsTeamLead ? await findResponsible(plotVillageId, ACK_LADDER, req.user.userId) : null;

  // An issue type that's already open on this plot isn't raised a second
  // time - the visit still records it as observed, but the visitor is told
  // it's already with someone (and who) instead of a duplicate being created.
  const skippedIssues = [];
  const alreadyOpen = new Map();
  if (issueTypeIds.length > 0) {
    const openResult = await pool.query(
      `select i.issue_type_id, i.status, au.name as holder_name
       from issues i left join users au on au.id = i.assigned_to
       where i.demo_plot_id = $1 and i.issue_type_id = any($2) and i.status not in ('closed', 'dismissed')`,
      [demoPlotId, issueTypeIds],
    );
    for (const row of openResult.rows) alreadyOpen.set(row.issue_type_id, row);
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    const overallPhotoUrl = await uploadPhoto(overallPhoto.buffer, overallPhoto.originalname, overallPhoto.mimetype);

    const visitResult = await client.query(
      `insert into visits (demo_plot_id, visited_by, action_plan, comments, overall_photo_url, gps_lat, gps_lng, gps_accuracy)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning id, created_at`,
      [demoPlotId, req.user.userId, actionPlan.trim(), comments.trim(), overallPhotoUrl, gps.lat, gps.lng, gps.accuracy],
    );
    const visitId = visitResult.rows[0].id;

    const pendingNotifications = [];
    for (const issueTypeId of issueTypeIds) {
      const photo = fileFor(files, `issuePhoto_${issueTypeId}`);
      const photoUrl = photo ? await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype) : null;
      await client.query(
        'insert into visit_issues (visit_id, issue_type_id, photo_url) values ($1, $2, $3)',
        [visitId, issueTypeId, photoUrl],
      );

      const issueType = issueTypes.get(issueTypeId);
      const typeName = issueType?.name || 'issue';

      if (alreadyOpen.has(issueTypeId)) {
        const open = alreadyOpen.get(issueTypeId);
        skippedIssues.push({ issueType: typeName, status: open.status, holder: open.holder_name });
        continue;
      }

      if (issueType?.acknowledge_only && req.user.role === 'team_lead') {
        await client.query(
          `insert into issues (demo_plot_id, issue_type_id, photo_url, raised_by, assigned_to, status,
             assigned_at, resolved_at, closed_at, resolved_by, verified_by)
           values ($1, $2, $3, $4, $4, 'closed', now(), now(), now(), $4, $4)`,
          [demoPlotId, issueTypeId, photoUrl, req.user.userId],
        );
        continue;
      }

      const assignee = issueType?.acknowledge_only ? teamLeadAssignee : tfoAssignee;
      const issueResult = await client.query(
        `insert into issues (demo_plot_id, issue_type_id, photo_url, raised_by, assigned_to, status, assigned_at)
         values ($1, $2, $3, $4, $5, $6, ${assignee ? 'now()' : 'null'})
         returning id`,
        [demoPlotId, issueTypeId, photoUrl, req.user.userId, assignee?.id || null, assignee ? 'assigned' : 'raised'],
      );
      if (assignee) {
        pendingNotifications.push({
          userId: assignee.id,
          issueId: issueResult.rows[0].id,
          type: 'issue_assigned',
          message: issueType?.acknowledge_only
            ? `${typeName} needs your acknowledgement`
            : `You've been assigned a new issue: ${typeName}`,
        });
      }
    }
    for (const goodThingId of goodThingIds) {
      const photo = fileFor(files, `goodThingPhoto_${goodThingId}`);
      const photoUrl = photo ? await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype) : null;
      await client.query(
        'insert into visit_good_things (visit_id, good_thing_id, photo_url) values ($1, $2, $3)',
        [visitId, goodThingId, photoUrl],
      );
    }
    for (const techniqueId of techniqueIds) {
      await client.query(
        'insert into visit_techniques (visit_id, technique_id) values ($1, $2)',
        [visitId, techniqueId],
      );
    }
    for (const diseaseId of diseaseIds) {
      const photo = fileFor(files, `diseasePhoto_${diseaseId}`);
      const photoUrl = await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype);
      await client.query(
        'insert into visit_diseases (visit_id, disease_id, photo_url) values ($1, $2, $3)',
        [visitId, diseaseId, photoUrl],
      );
    }
    if (diseaseOther?.trim()) {
      const photo = fileFor(files, 'diseasePhotoOther');
      const photoUrl = await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype);
      await client.query(
        'insert into visit_diseases (visit_id, disease_other, photo_url) values ($1, $2, $3)',
        [visitId, diseaseOther.trim(), photoUrl],
      );
    }
    for (const pestId of pestIds) {
      const photo = fileFor(files, `pestPhoto_${pestId}`);
      const photoUrl = await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype);
      await client.query(
        'insert into visit_pests (visit_id, pest_id, photo_url) values ($1, $2, $3)',
        [visitId, pestId, photoUrl],
      );
    }
    if (pestOther?.trim()) {
      const photo = fileFor(files, 'pestPhotoOther');
      const photoUrl = await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype);
      await client.query(
        'insert into visit_pests (visit_id, pest_other, photo_url) values ($1, $2, $3)',
        [visitId, pestOther.trim(), photoUrl],
      );
    }

    await client.query('commit');

    await createNotifications(pendingNotifications);

    res.status(201).json({ visit: { id: visitId, createdAt: visitResult.rows[0].created_at }, skippedIssues });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'One of the selected issues/good-things/techniques/disease/pest no longer exists' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
