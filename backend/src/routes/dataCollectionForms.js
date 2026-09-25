import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';
import { uploadPhoto } from '../storage.js';
import { requireLocation } from '../middleware/requireLocation.js';
import { parseGps } from '../gps.js';

export const dataCollectionFormsRouter = Router();
dataCollectionFormsRouter.param('id', validateUuidParam);
dataCollectionFormsRouter.param('fieldId', validateUuidParam);

const FIELD_TYPES = ['text', 'number', 'textarea', 'date', 'phone', 'select', 'multiselect', 'photo'];
const OPTION_TYPES = ['select', 'multiselect'];

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

function parseOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
}

// Builder pages need the form's fields alongside it (edit view, fill view) -
// every read of a single form fetches both in one round trip.
async function loadFormWithFields(formId) {
  const formResult = await pool.query('select id, title, description, created_by, created_at from data_collection_forms where id = $1', [formId]);
  if (formResult.rowCount === 0) return null;
  const fieldsResult = await pool.query(
    'select id, field_type, label, required, options from data_collection_form_fields where form_id = $1 order by created_at asc',
    [formId],
  );
  return { form: formResult.rows[0], fields: fieldsResult.rows };
}

// Super Admin always has access (author of every form); anyone else only
// has access to a form they've been individually assigned - assignment
// isn't restricted to any one role, any user can be handed a form to fill.
async function hasFormAccess(req, formId) {
  if (req.user.role === 'super_admin') return true;
  const result = await pool.query(
    'select 1 from data_collection_form_assignments where form_id = $1 and user_id = $2',
    [formId, req.user.userId],
  );
  return result.rowCount > 0;
}

// --- Super Admin: building and managing forms ---

dataCollectionFormsRouter.post('/data-collection-forms', requireAuth, requireSuperAdmin, async (req, res) => {
  const { title, description } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  const result = await pool.query(
    `insert into data_collection_forms (title, description, created_by)
     values ($1, $2, $3) returning id, title, description, created_at`,
    [title.trim(), description?.trim() || null, req.user.userId],
  );
  res.status(201).json({ form: result.rows[0] });
});

// List view for the admin forms page - field/assignment/submission counts
// so Super Admin can see at a glance which forms are actually in use.
dataCollectionFormsRouter.get('/data-collection-forms', requireAuth, requireSuperAdmin, async (_req, res) => {
  const result = await pool.query(`
    select f.id, f.title, f.description, f.created_at,
      (select count(*) from data_collection_form_fields ff where ff.form_id = f.id) as field_count,
      (select count(*) from data_collection_form_assignments fa where fa.form_id = f.id) as assignment_count,
      (select count(*) from data_collection_submissions fs where fs.form_id = f.id) as submission_count
    from data_collection_forms f
    order by f.created_at desc
  `);
  res.json({ forms: result.rows });
});

// Whichever forms have been individually assigned to the current user -
// what the mobile Data Collection tab lists, for any role (not just Data
// Enumerator). Empty for everyone until Super Admin assigns them something.
// Sorted by title, not creation date, since there's no "latest first" logic
// that matters to someone just picking which form to fill.
dataCollectionFormsRouter.get('/my-data-collection-forms', requireAuth, async (req, res) => {
  const result = await pool.query(`
    select f.id, f.title, f.description,
      (select count(*) from data_collection_form_fields ff where ff.form_id = f.id) as field_count
    from data_collection_forms f
    join data_collection_form_assignments fa on fa.form_id = f.id
    where fa.user_id = $1
    order by f.title asc
  `, [req.user.userId]);
  res.json({ forms: result.rows });
});

// Shared by the admin edit page and the mobile fill screen - same payload
// shape either way, gated by hasFormAccess instead of role alone.
dataCollectionFormsRouter.get('/data-collection-forms/:id', requireAuth, async (req, res) => {
  if (!(await hasFormAccess(req, req.params.id))) {
    return res.status(403).json({ error: "You don't have access to this form" });
  }
  const data = await loadFormWithFields(req.params.id);
  if (!data) return res.status(404).json({ error: 'No such form' });
  res.json(data);
});

dataCollectionFormsRouter.patch('/data-collection-forms/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const { title, description } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  const result = await pool.query(
    `update data_collection_forms set title = $1, description = $2 where id = $3
     returning id, title, description, created_at`,
    [title.trim(), description?.trim() || null, req.params.id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such form' });
  res.json({ form: result.rows[0] });
});

dataCollectionFormsRouter.delete('/data-collection-forms/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  const submissions = await pool.query('select 1 from data_collection_submissions where form_id = $1 limit 1', [req.params.id]);
  if (submissions.rowCount > 0) {
    return res.status(409).json({ error: 'This form already has submitted data and can\'t be deleted.' });
  }
  const result = await pool.query('delete from data_collection_forms where id = $1', [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such form' });
  res.status(204).end();
});

dataCollectionFormsRouter.post('/data-collection-forms/:id/fields', requireAuth, requireSuperAdmin, async (req, res) => {
  const { fieldType, label, required, options } = req.body;
  if (!FIELD_TYPES.includes(fieldType)) return res.status(400).json({ error: `fieldType must be one of: ${FIELD_TYPES.join(', ')}` });
  if (!label || !label.trim()) return res.status(400).json({ error: 'label is required' });
  const cleanOptions = parseOptions(options);
  if (OPTION_TYPES.includes(fieldType) && cleanOptions.length === 0) {
    return res.status(400).json({ error: `${fieldType} fields need at least one option` });
  }

  const formResult = await pool.query('select id from data_collection_forms where id = $1', [req.params.id]);
  if (formResult.rowCount === 0) return res.status(404).json({ error: 'No such form' });

  const result = await pool.query(
    `insert into data_collection_form_fields (form_id, field_type, label, required, options)
     values ($1, $2, $3, $4, $5) returning id, field_type, label, required, options`,
    [req.params.id, fieldType, label.trim(), !!required, OPTION_TYPES.includes(fieldType) ? cleanOptions : null],
  );
  res.status(201).json({ field: result.rows[0] });
});

dataCollectionFormsRouter.patch('/data-collection-forms/:id/fields/:fieldId', requireAuth, requireSuperAdmin, async (req, res) => {
  const { fieldType, label, required, options } = req.body;
  if (!FIELD_TYPES.includes(fieldType)) return res.status(400).json({ error: `fieldType must be one of: ${FIELD_TYPES.join(', ')}` });
  if (!label || !label.trim()) return res.status(400).json({ error: 'label is required' });
  const cleanOptions = parseOptions(options);
  if (OPTION_TYPES.includes(fieldType) && cleanOptions.length === 0) {
    return res.status(400).json({ error: `${fieldType} fields need at least one option` });
  }

  const result = await pool.query(
    `update data_collection_form_fields set field_type = $1, label = $2, required = $3, options = $4
     where id = $5 and form_id = $6
     returning id, field_type, label, required, options`,
    [fieldType, label.trim(), !!required, OPTION_TYPES.includes(fieldType) ? cleanOptions : null, req.params.fieldId, req.params.id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such field' });
  res.json({ field: result.rows[0] });
});

dataCollectionFormsRouter.delete('/data-collection-forms/:id/fields/:fieldId', requireAuth, requireSuperAdmin, async (req, res) => {
  const result = await pool.query(
    'delete from data_collection_form_fields where id = $1 and form_id = $2',
    [req.params.fieldId, req.params.id],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such field' });
  res.status(204).end();
});

// Replaces the full assignment set for a form in one call - simpler than
// incremental add/remove for a checklist-style UI that submits its whole
// selection at once.
dataCollectionFormsRouter.put('/data-collection-forms/:id/assignments', requireAuth, requireSuperAdmin, async (req, res) => {
  const { userIds } = req.body;
  if (!Array.isArray(userIds)) return res.status(400).json({ error: 'userIds must be an array' });

  const formResult = await pool.query('select id from data_collection_forms where id = $1', [req.params.id]);
  if (formResult.rowCount === 0) return res.status(404).json({ error: 'No such form' });

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from data_collection_form_assignments where form_id = $1', [req.params.id]);
    for (const userId of userIds) {
      await client.query(
        `insert into data_collection_form_assignments (form_id, user_id, assigned_by) values ($1, $2, $3)`,
        [req.params.id, userId, req.user.userId],
      );
    }
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    return res.status(400).json({ error: err.code === '23503' ? 'One of those users no longer exists' : err.message });
  } finally {
    client.release();
  }

  const assigned = await pool.query('select user_id from data_collection_form_assignments where form_id = $1', [req.params.id]);
  res.json({ userIds: assigned.rows.map((r) => r.user_id) });
});

dataCollectionFormsRouter.get('/data-collection-forms/:id/assignments', requireAuth, requireSuperAdmin, async (req, res) => {
  const result = await pool.query('select user_id from data_collection_form_assignments where form_id = $1', [req.params.id]);
  res.json({ userIds: result.rows.map((r) => r.user_id) });
});

// Raw collected data for Super Admin to review - each submission's values
// resolved against the field labels at read time (not stored denormalized),
// so a later field label edit doesn't leave old submissions showing a stale
// name.
dataCollectionFormsRouter.get('/data-collection-forms/:id/submissions', requireAuth, requireSuperAdmin, async (req, res) => {
  const data = await loadFormWithFields(req.params.id);
  if (!data) return res.status(404).json({ error: 'No such form' });

  const result = await pool.query(`
    select s.id, s.values, s.created_at,
      f.name as farmer_name, f.phone as farmer_phone, vi.name as village_name,
      u.name as submitted_by_name
    from data_collection_submissions s
    join farmers f on f.id = s.farmer_id
    join villages vi on vi.id = s.village_id
    join users u on u.id = s.submitted_by
    where s.form_id = $1
    order by s.created_at desc
  `, [req.params.id]);

  res.json({ fields: data.fields, submissions: result.rows });
});

// --- Data Enumerator: filling out an assigned form for a farmer ---

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function handleFileUpload(req, res, next) {
  upload.any()(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'A photo is too large (max 8MB)' });
    res.status(400).json({ error: err.message });
  });
}

dataCollectionFormsRouter.post('/data-collection-forms/:id/submissions', requireAuth, requireLocation, handleFileUpload, async (req, res) => {
  if (req.user.role === 'super_admin') {
    return res.status(403).json({ error: "Super Admin doesn't submit data collection forms" });
  }
  if (!(await hasFormAccess(req, req.params.id))) {
    return res.status(403).json({ error: "You don't have access to this form" });
  }

  const { farmerId } = req.body;
  if (!farmerId) return res.status(400).json({ error: 'farmerId is required' });
  const gps = parseGps(req.body);
  if (gps.error) return res.status(400).json({ error: gps.error });

  const farmerResult = await pool.query('select village_id from farmers where id = $1 and status = \'active\'', [farmerId]);
  if (farmerResult.rowCount === 0) return res.status(404).json({ error: 'No such farmer' });
  const villageId = farmerResult.rows[0].village_id;

  const villageIds = await getCoveredVillageIds(req.user.userId);
  if (!villageIds.includes(villageId)) {
    return res.status(403).json({ error: "This farmer isn't in your assigned coverage" });
  }

  const data = await loadFormWithFields(req.params.id);
  if (!data) return res.status(404).json({ error: 'No such form' });

  const files = req.files || [];
  const values = {};
  for (const field of data.fields) {
    if (field.field_type === 'photo') {
      const file = files.find((f) => f.fieldname === `photo_${field.id}`);
      if (field.required && !file) return res.status(400).json({ error: `${field.label} is required` });
      if (file) {
        values[field.id] = await uploadPhoto(file.buffer, file.originalname, file.mimetype);
      }
      continue;
    }

    const raw = req.body[`field_${field.id}`];
    if (field.field_type === 'multiselect') {
      let parsed = [];
      try {
        parsed = JSON.parse(raw || '[]');
      } catch {
        return res.status(400).json({ error: `${field.label} has an invalid value` });
      }
      parsed = Array.isArray(parsed) ? parsed.filter((v) => field.options.includes(v)) : [];
      if (field.required && parsed.length === 0) return res.status(400).json({ error: `${field.label} is required` });
      if (parsed.length > 0) values[field.id] = parsed;
      continue;
    }

    const trimmed = (raw || '').trim();
    if (field.required && !trimmed) return res.status(400).json({ error: `${field.label} is required` });
    if (field.field_type === 'select' && trimmed && !field.options.includes(trimmed)) {
      return res.status(400).json({ error: `${field.label} has an invalid value` });
    }
    if (trimmed) values[field.id] = trimmed;
  }

  const result = await pool.query(
    `insert into data_collection_submissions (form_id, farmer_id, village_id, submitted_by, values, gps_lat, gps_lng, gps_accuracy)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id, created_at`,
    [req.params.id, farmerId, villageId, req.user.userId, JSON.stringify(values), gps.lat, gps.lng, gps.accuracy],
  );
  res.status(201).json({ submission: result.rows[0] });
});
