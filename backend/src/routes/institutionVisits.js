import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadPhoto } from '../storage.js';
import { requireLocation } from '../middleware/requireLocation.js';
import { parseGps } from '../gps.js';

export const institutionVisitsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function handleFileUpload(req, res, next) {
  upload.any()(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'The photo is too large (max 8MB)' });
    res.status(400).json({ error: err.message });
  });
}

function fileFor(files, fieldname) {
  return files.find((f) => f.fieldname === fieldname);
}

function parseStringList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim()) : [];
  } catch {
    return [];
  }
}

// Powers the count badge on the Home screen's Institutional Visit card.
institutionVisitsRouter.get('/institution-visits/my-count', requireAuth, async (req, res) => {
  const result = await pool.query('select count(*)::int as count from institution_visits where created_by = $1', [req.user.userId]);
  res.json({ count: result.rows[0].count });
});

institutionVisitsRouter.post('/institution-visits', requireAuth, requireLocation, handleFileUpload, async (req, res) => {
  const files = req.files || [];
  const { institutionId, observations } = req.body;
  const purposes = parseStringList(req.body.purposes);

  if (!institutionId) return res.status(400).json({ error: 'institutionId is required' });

  const institution = await pool.query('select id from institutions where id = $1', [institutionId]);
  if (institution.rowCount === 0) return res.status(400).json({ error: 'No such institution' });

  const gps = parseGps(req.body);
  if (gps.error) return res.status(400).json({ error: gps.error });

  const photo = fileFor(files, 'photo');
  if (!photo) return res.status(400).json({ error: 'A photo of the visit is required' });

  const client = await pool.connect();
  try {
    await client.query('begin');
    const photoUrl = await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype);
    const visitResult = await client.query(
      `insert into institution_visits (institution_id, observations, photo_url, created_by, gps_lat, gps_lng, gps_accuracy)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, created_at`,
      [institutionId, observations?.trim() || null, photoUrl, req.user.userId, gps.lat, gps.lng, gps.accuracy],
    );
    const visitId = visitResult.rows[0].id;
    for (const purpose of purposes) {
      await client.query(
        'insert into institution_visit_purposes (institution_visit_id, purpose) values ($1, $2) on conflict do nothing',
        [visitId, purpose],
      );
    }
    await client.query('commit');
    res.status(201).json({ institutionVisit: { id: visitId, createdAt: visitResult.rows[0].created_at } });
  } catch (err) {
    await client.query('rollback');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
