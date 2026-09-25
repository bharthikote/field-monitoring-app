import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadPhoto } from '../storage.js';
import { requireLocation } from '../middleware/requireLocation.js';
import { parseGps } from '../gps.js';

export const agroDealerVisitsRouter = Router();

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

// Powers the count badge on the Home screen's Agro Dealer Visit card.
agroDealerVisitsRouter.get('/agro-dealer-visits/my-count', requireAuth, async (req, res) => {
  const result = await pool.query('select count(*)::int as count from agro_dealer_visits where created_by = $1', [req.user.userId]);
  res.json({ count: result.rows[0].count });
});

agroDealerVisitsRouter.post('/agro-dealer-visits', requireAuth, requireLocation, handleFileUpload, async (req, res) => {
  const files = req.files || [];
  const { dealerId, observations } = req.body;
  const purposes = parseStringList(req.body.purposes);

  if (!dealerId) return res.status(400).json({ error: 'dealerId is required' });

  const dealer = await pool.query('select id from agro_dealers where id = $1', [dealerId]);
  if (dealer.rowCount === 0) return res.status(400).json({ error: 'No such agro dealer' });

  const gps = parseGps(req.body);
  if (gps.error) return res.status(400).json({ error: gps.error });

  const photo = fileFor(files, 'photo');
  if (!photo) return res.status(400).json({ error: 'A photo of the visit is required' });

  const client = await pool.connect();
  try {
    await client.query('begin');
    const photoUrl = await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype);
    const visitResult = await client.query(
      `insert into agro_dealer_visits (dealer_id, observations, photo_url, created_by, gps_lat, gps_lng, gps_accuracy)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, created_at`,
      [dealerId, observations?.trim() || null, photoUrl, req.user.userId, gps.lat, gps.lng, gps.accuracy],
    );
    const visitId = visitResult.rows[0].id;
    for (const purpose of purposes) {
      await client.query(
        'insert into agro_dealer_visit_purposes (agro_dealer_visit_id, purpose) values ($1, $2) on conflict do nothing',
        [visitId, purpose],
      );
    }
    await client.query('commit');
    res.status(201).json({ agroDealerVisit: { id: visitId, createdAt: visitResult.rows[0].created_at } });
  } catch (err) {
    await client.query('rollback');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
