import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadPhoto } from '../storage.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';
import { findFarmerByPhone } from '../db/farmers.js';
import { requireLocation } from '../middleware/requireLocation.js';

export const fieldDaysRouter = Router();

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

const FIELDDAY_TYPES = ['practical', 'theory', 'both'];
const ROI_DISCUSSION_OPTIONS = ['both', 'roi_only', 'biz_only', 'not_discussed'];
const DATE_LIKE = /^\d{4}-\d{2}-\d{2}$/;

export const SELECT_FIELD_DAYS = `
  select fd.id, fd.farmer_id, fd.farmer_name, fd.farmer_phone, fd.fieldday_type,
    fd.interaction_quality, fd.roi_discussion, fd.sales_team_attended, fd.sales_person_name,
    fd.expected_harvest_date, fd.remarks, fd.photo_url, fd.created_at,
    fd.village_id, vi.name as village_name, b.name as block_name, di.name as district_name,
    s.name as state_name, co.name as country_name, u.name as created_by_name
  from field_days fd
  join villages vi on vi.id = fd.village_id
  join blocks b on b.id = vi.block_id
  join districts di on di.id = b.district_id
  join states s on s.id = di.state_id
  join countries co on co.id = s.country_id
  join users u on u.id = fd.created_by
`;

// Powers the count badge on the Home screen's Field Day card - how many
// field days this user has personally logged, all-time. Same shape as
// trainings.js's /trainings/my-count.
fieldDaysRouter.get('/field-days/my-count', requireAuth, async (req, res) => {
  const result = await pool.query('select count(*)::int as count from field_days where created_by = $1', [req.user.userId]);
  res.json({ count: result.rows[0].count });
});

// Same visibility rule as demo plots/trainings: Super Admin sees
// everything, everyone else is scoped to the villages their location
// assignments cover.
fieldDaysRouter.get('/field-days', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(`${SELECT_FIELD_DAYS} order by fd.created_at desc limit 200`);
    return res.json({ fieldDays: result.rows });
  }
  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_FIELD_DAYS} where fd.village_id = any($1) order by fd.created_at desc limit 200`,
    [villageIds],
  );
  res.json({ fieldDays: result.rows });
});

fieldDaysRouter.post('/field-days', requireAuth, requireLocation, handleFileUpload, async (req, res) => {
  const files = req.files || [];
  const {
    farmerName, phone, villageId, fielddayType, interactionQuality, roiDiscussion,
    salesTeamAttended, salesPersonName, expectedHarvestDate, remarks,
  } = req.body;

  if (!farmerName || !phone || !villageId || !fielddayType || !interactionQuality || !roiDiscussion || !salesTeamAttended || !expectedHarvestDate) {
    return res.status(400).json({ error: 'farmerName, phone, villageId, fielddayType, interactionQuality, roiDiscussion, salesTeamAttended, and expectedHarvestDate are all required' });
  }
  if (!FIELDDAY_TYPES.includes(fielddayType)) {
    return res.status(400).json({ error: `fielddayType must be one of: ${FIELDDAY_TYPES.join(', ')}` });
  }
  if (!ROI_DISCUSSION_OPTIONS.includes(roiDiscussion)) {
    return res.status(400).json({ error: `roiDiscussion must be one of: ${ROI_DISCUSSION_OPTIONS.join(', ')}` });
  }
  if (!['yes', 'no'].includes(salesTeamAttended)) {
    return res.status(400).json({ error: "salesTeamAttended must be 'yes' or 'no'" });
  }
  const attended = salesTeamAttended === 'yes';
  if (attended && !salesPersonName?.trim()) {
    return res.status(400).json({ error: 'salesPersonName is required when the sales team attended' });
  }
  const quality = Number(interactionQuality);
  if (!Number.isInteger(quality) || quality < 1 || quality > 5) {
    return res.status(400).json({ error: 'interactionQuality must be an integer between 1 and 5' });
  }
  if (!DATE_LIKE.test(expectedHarvestDate)) {
    return res.status(400).json({ error: 'expectedHarvestDate must be a valid date (YYYY-MM-DD)' });
  }

  const photo = fileFor(files, 'photo');
  if (!photo) return res.status(400).json({ error: 'A photo of the field day is required' });

  // Phone number is the farmer's key identifier (PRD Section 5) - resolved
  // against the farmers master table (backend/src/db/farmers.js), same as
  // demoPlots.js's POST /demo-plots and trainings.js's POST /trainings.
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
      `insert into field_days (farmer_id, farmer_name, farmer_phone, village_id, fieldday_type,
         interaction_quality, roi_discussion, sales_team_attended, sales_person_name,
         expected_harvest_date, remarks, photo_url, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning id, farmer_name, farmer_phone, created_at`,
      [
        farmerId, farmerName, phone, villageId, fielddayType, quality, roiDiscussion, attended,
        attended ? salesPersonName.trim() : null, expectedHarvestDate, remarks?.trim() || null, photoUrl, req.user.userId,
      ],
    );
    res.status(201).json({ fieldDay: result.rows[0] });
  } catch (err) {
    if (err.code === '23503') return res.status(400).json({ error: 'No such village' });
    res.status(500).json({ error: err.message });
  }
});
