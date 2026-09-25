import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadPhoto } from '../storage.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';
import { findFarmerByPhone } from '../db/farmers.js';
import { requireLocation } from '../middleware/requireLocation.js';
import { parseGps } from '../gps.js';

export const trainingsRouter = Router();

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

const TRAINING_TYPES = ['classroom', 'field_based', 'mixed'];
const MAT_USED_OPTIONS = ['ext_material_only', 'training_material_only', 'both', 'none'];
const GENDER_INTERACTIONS = ['both_interacted', 'only_male', 'only_female', 'no_interaction'];
const SEATING_OPTIONS = ['equal', 'discriminatory'];

export const SELECT_TRAININGS = `
  select tr.id, tr.farmer_id, tr.farmer_name, tr.farmer_phone, tr.training_type, tr.ext_material_used,
    tr.interaction_quality, tr.gender_interaction, tr.seating, tr.remarks, tr.photo_url, tr.created_at,
    tr.village_id, vi.name as village_name, b.name as block_name, di.name as district_name,
    s.name as state_name, co.name as country_name, u.name as created_by_name
  from trainings tr
  join villages vi on vi.id = tr.village_id
  join blocks b on b.id = vi.block_id
  join districts di on di.id = b.district_id
  join states s on s.id = di.state_id
  join countries co on co.id = s.country_id
  join users u on u.id = tr.created_by
`;

// Powers the count badge on the Home screen's Training card - how many
// trainings this user has personally logged, all-time. Same shape as
// visits.js's /visits/my-count.
trainingsRouter.get('/trainings/my-count', requireAuth, async (req, res) => {
  const result = await pool.query('select count(*)::int as count from trainings where created_by = $1', [req.user.userId]);
  res.json({ count: result.rows[0].count });
});

// Same visibility rule as demo plots and visits: Super Admin sees
// everything, everyone else is scoped to the villages their location
// assignments cover.
trainingsRouter.get('/trainings', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(`${SELECT_TRAININGS} order by tr.created_at desc limit 200`);
    return res.json({ trainings: result.rows });
  }
  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_TRAININGS} where tr.village_id = any($1) order by tr.created_at desc limit 200`,
    [villageIds],
  );
  res.json({ trainings: result.rows });
});

trainingsRouter.post('/trainings', requireAuth, requireLocation, handleFileUpload, async (req, res) => {
  const files = req.files || [];
  const {
    farmerName, phone, villageId, trainingType, extMaterialUsed,
    interactionQuality, genderInteraction, seating, remarks,
  } = req.body;

  if (!farmerName || !phone || !villageId || !trainingType || !extMaterialUsed || !interactionQuality || !genderInteraction || !seating) {
    return res.status(400).json({ error: 'farmerName, phone, villageId, trainingType, extMaterialUsed, interactionQuality, genderInteraction, and seating are all required' });
  }
  if (!TRAINING_TYPES.includes(trainingType)) {
    return res.status(400).json({ error: `trainingType must be one of: ${TRAINING_TYPES.join(', ')}` });
  }
  if (!MAT_USED_OPTIONS.includes(extMaterialUsed)) {
    return res.status(400).json({ error: `extMaterialUsed must be one of: ${MAT_USED_OPTIONS.join(', ')}` });
  }
  if (!GENDER_INTERACTIONS.includes(genderInteraction)) {
    return res.status(400).json({ error: `genderInteraction must be one of: ${GENDER_INTERACTIONS.join(', ')}` });
  }
  if (!SEATING_OPTIONS.includes(seating)) {
    return res.status(400).json({ error: `seating must be one of: ${SEATING_OPTIONS.join(', ')}` });
  }
  const quality = Number(interactionQuality);
  if (!Number.isInteger(quality) || quality < 1 || quality > 5) {
    return res.status(400).json({ error: 'interactionQuality must be an integer between 1 and 5' });
  }

  const gps = parseGps(req.body);
  if (gps.error) return res.status(400).json({ error: gps.error });

  const photo = fileFor(files, 'photo');
  if (!photo) return res.status(400).json({ error: 'A photo of the training is required' });

  // Phone number is the farmer's key identifier (PRD Section 5) - resolved
  // against the farmers master table (backend/src/db/farmers.js), same as
  // demoPlots.js's POST /demo-plots.
  let farmerId;
  const existingFarmer = await findFarmerByPhone(phone);
  if (existingFarmer) {
    if (existingFarmer.name.trim().toLowerCase() !== farmerName.trim().toLowerCase()) {
      return res.status(409).json({
        error: `This phone number is already registered to ${existingFarmer.name}.`,
        code: 'name_mismatch',
        existingFarmerName: existingFarmer.name,
      });
    }
    if (existingFarmer.village_id !== villageId) {
      return res.status(409).json({
        error: `${existingFarmer.name} is already registered in a different village. A farmer's plots must all be in the same village.`,
        code: 'village_mismatch',
        villageId: existingFarmer.village_id,
      });
    }
    farmerId = existingFarmer.id;
  } else {
    const created = await pool.query(
      'insert into farmers (name, phone, village_id, created_by) values ($1, $2, $3, $4) returning id',
      [farmerName, phone, villageId, req.user.userId],
    );
    farmerId = created.rows[0].id;
  }

  try {
    const photoUrl = await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype);
    const result = await pool.query(
      `insert into trainings (farmer_id, farmer_name, farmer_phone, village_id, training_type, ext_material_used,
         interaction_quality, gender_interaction, seating, remarks, photo_url, created_by, gps_lat, gps_lng, gps_accuracy)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       returning id, farmer_name, farmer_phone, created_at`,
      [farmerId, farmerName, phone, villageId, trainingType, extMaterialUsed, quality, genderInteraction, seating, remarks?.trim() || null, photoUrl, req.user.userId, gps.lat, gps.lng, gps.accuracy],
    );
    res.status(201).json({ training: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'No such village' });
    res.status(500).json({ error: err.message });
  }
});
