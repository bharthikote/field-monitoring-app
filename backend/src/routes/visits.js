import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadPhoto } from '../storage.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';

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
    u.name as visited_by_name,
    d.name as disease_name, v.disease_other, v.disease_photo_url,
    p.name as pest_name, v.pest_other, v.pest_photo_url
  from visits v
  join users u on u.id = v.visited_by
  left join diseases d on d.id = v.disease_id
  left join pests p on p.id = v.pest_id
`;

async function attachIssuesAndGoodThings(visits) {
  if (!visits.length) return visits;
  const ids = visits.map((v) => v.id);
  const [issuesResult, goodThingsResult, techniquesResult] = await Promise.all([
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
  ]);
  const issuesByVisit = new Map();
  for (const row of issuesResult.rows) {
    if (!issuesByVisit.has(row.visit_id)) issuesByVisit.set(row.visit_id, []);
    issuesByVisit.get(row.visit_id).push({ name: row.name, photoUrl: row.photo_url });
  }
  const goodThingsByVisit = new Map();
  for (const row of goodThingsResult.rows) {
    if (!goodThingsByVisit.has(row.visit_id)) goodThingsByVisit.set(row.visit_id, []);
    goodThingsByVisit.get(row.visit_id).push({ name: row.name, photoUrl: row.photo_url });
  }
  const techniquesByVisit = new Map();
  for (const row of techniquesResult.rows) {
    if (!techniquesByVisit.has(row.visit_id)) techniquesByVisit.set(row.visit_id, []);
    techniquesByVisit.get(row.visit_id).push({ name: row.name });
  }
  return visits.map((v) => ({
    ...v,
    issues: issuesByVisit.get(v.id) || [],
    goodThings: goodThingsByVisit.get(v.id) || [],
    techniques: techniquesByVisit.get(v.id) || [],
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
  const visits = await attachIssuesAndGoodThings(result.rows);
  res.json({ visits });
});

visitsRouter.post('/visits', requireAuth, handleFileUpload, async (req, res) => {
  const files = req.files || [];
  const { demoPlotId, actionPlan, comments, diseaseId, diseaseOther, pestId, pestOther } = req.body;
  const issueTypeIds = parseIdList(req.body.issueTypeIds);
  const goodThingIds = parseIdList(req.body.goodThingIds);
  const techniqueIds = parseIdList(req.body.techniqueIds);

  if (!demoPlotId || !actionPlan?.trim() || !comments?.trim()) {
    return res.status(400).json({ error: 'demoPlotId, actionPlan, and comments are all required' });
  }
  if (![demoPlotId, diseaseId, pestId, ...issueTypeIds, ...goodThingIds, ...techniqueIds].every(isValidId)) {
    return res.status(400).json({ error: 'One of the submitted ids is invalid' });
  }

  const plotResult = await pool.query('select id from demo_plots where id = $1', [demoPlotId]);
  if (plotResult.rowCount === 0) return res.status(400).json({ error: 'No such demo plot' });

  const overallPhoto = fileFor(files, 'overallPhoto');
  if (!overallPhoto) return res.status(400).json({ error: 'A photo of the visit is required' });

  const diseasePhoto = fileFor(files, 'diseasePhoto');
  if ((diseaseId || diseaseOther?.trim()) && !diseasePhoto) {
    return res.status(400).json({ error: 'A disease photo is required when a disease is identified' });
  }
  const pestPhoto = fileFor(files, 'pestPhoto');
  if ((pestId || pestOther?.trim()) && !pestPhoto) {
    return res.status(400).json({ error: 'A pest photo is required when a pest is identified' });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');

    const overallPhotoUrl = await uploadPhoto(overallPhoto.buffer, overallPhoto.originalname, overallPhoto.mimetype);
    const diseasePhotoUrl = diseasePhoto
      ? await uploadPhoto(diseasePhoto.buffer, diseasePhoto.originalname, diseasePhoto.mimetype)
      : null;
    const pestPhotoUrl = pestPhoto
      ? await uploadPhoto(pestPhoto.buffer, pestPhoto.originalname, pestPhoto.mimetype)
      : null;

    const visitResult = await client.query(
      `insert into visits (demo_plot_id, visited_by, action_plan, comments, overall_photo_url,
         disease_id, disease_other, disease_photo_url, pest_id, pest_other, pest_photo_url)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       returning id, created_at`,
      [
        demoPlotId, req.user.userId, actionPlan.trim(), comments.trim(), overallPhotoUrl,
        diseaseId || null, diseaseOther?.trim() || null, diseasePhotoUrl,
        pestId || null, pestOther?.trim() || null, pestPhotoUrl,
      ],
    );
    const visitId = visitResult.rows[0].id;

    for (const issueTypeId of issueTypeIds) {
      const photo = fileFor(files, `issuePhoto_${issueTypeId}`);
      const photoUrl = photo ? await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype) : null;
      await client.query(
        'insert into visit_issues (visit_id, issue_type_id, photo_url) values ($1, $2, $3)',
        [visitId, issueTypeId, photoUrl],
      );
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

    await client.query('commit');
    res.status(201).json({ visit: { id: visitId, createdAt: visitResult.rows[0].created_at } });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'One of the selected issues/good-things/techniques/disease/pest no longer exists' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
