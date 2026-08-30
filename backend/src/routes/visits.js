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

visitsRouter.post('/visits', requireAuth, handleFileUpload, async (req, res) => {
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

  const plotResult = await pool.query('select id from demo_plots where id = $1', [demoPlotId]);
  if (plotResult.rowCount === 0) return res.status(400).json({ error: 'No such demo plot' });

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

  const client = await pool.connect();
  try {
    await client.query('begin');

    const overallPhotoUrl = await uploadPhoto(overallPhoto.buffer, overallPhoto.originalname, overallPhoto.mimetype);

    const visitResult = await client.query(
      `insert into visits (demo_plot_id, visited_by, action_plan, comments, overall_photo_url)
       values ($1, $2, $3, $4, $5)
       returning id, created_at`,
      [demoPlotId, req.user.userId, actionPlan.trim(), comments.trim(), overallPhotoUrl],
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
    res.status(201).json({ visit: { id: visitId, createdAt: visitResult.rows[0].created_at } });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'One of the selected issues/good-things/techniques/disease/pest no longer exists' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
