import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds, requireVillageInCoverage } from '../db/locationHelpers.js';
import { uploadPhoto } from '../storage.js';
import { requireLocation } from '../middleware/requireLocation.js';
import { SELECT_DEMO_PLOTS } from './demoPlots.js';
import { SELECT_TRAININGS } from './trainings.js';
import { SELECT_FIELD_DAYS } from './fieldDays.js';
import { SELECT_TFO_DEMO_CROPS } from './tfoDemos.js';
import { SELECT_TFO_HOME_GARDEN_CROPS } from './tfoHomeGardens.js';

export const farmersRouter = Router();
farmersRouter.param('id', validateUuidParam);

const PHONE_LIKE = /^\d{6,}$/;
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FARMER_TYPES = ['key_farmer', 'core_farmer', 'farmer', 'community_trainer_farmer'];
const GENDERS = ['male', 'female', 'others'];
const EDUCATION_LEVELS = ['primary', 'secondary', 'higher', 'adult', 'no_school'];
const PHONE_TYPES = ['smartphone', 'cellphone', 'no_phone'];
const SOCIAL_MEDIA_PLATFORMS = ['facebook', 'instagram', 'snapchat', 'telegram', 'tiktok', 'twitter'];

function parseStringList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === 'string' && v.trim()) : [];
  } catch {
    return [];
  }
}

// Shared between create and edit - both accept the same optional detail
// fields with the same rules, just an insert vs. an update underneath.
// Returns an error message string, or null if everything checks out.
function validateFarmerDetailFields({ farmerType, gender, age, educationLevel, literacy, phoneType, socialMedia, email }) {
  if (farmerType && !FARMER_TYPES.includes(farmerType)) {
    return `farmerType must be one of: ${FARMER_TYPES.join(', ')}`;
  }
  if (gender && !GENDERS.includes(gender)) {
    return `gender must be one of: ${GENDERS.join(', ')}`;
  }
  if (age !== undefined && age !== '') {
    const ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum <= 14) {
      return 'age must be a whole number above 14';
    }
  }
  if (educationLevel && !EDUCATION_LEVELS.includes(educationLevel)) {
    return `educationLevel must be one of: ${EDUCATION_LEVELS.join(', ')}`;
  }
  if (literacy && !['yes', 'no'].includes(literacy)) {
    return "literacy must be 'yes' or 'no'";
  }
  if (phoneType && !PHONE_TYPES.includes(phoneType)) {
    return `phoneType must be one of: ${PHONE_TYPES.join(', ')}`;
  }
  for (const platform of socialMedia) {
    if (!SOCIAL_MEDIA_PLATFORMS.includes(platform)) {
      return `socialMedia entries must be one of: ${SOCIAL_MEDIA_PLATFORMS.join(', ')}`;
    }
  }
  if (email && !EMAIL_LIKE.test(email.trim())) {
    return 'That email address looks invalid';
  }
  return null;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function handleFileUpload(req, res, next) {
  upload.any()(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'The photo is too large (max 8MB)' });
    res.status(400).json({ error: err.message });
  });
}

// The detail fields (photo/type/gender/age/.../phoneType) are all optional
// here - only the richer TFO create-farmer form populates them, the
// existing simple higher-role form still just sends name/phone/villageId.
// birth_date is cast to text explicitly - left as a plain 'date' column,
// node-postgres's type parser converts it to a JS Date and re-serializes
// through a timezone, which can shift it to the wrong calendar day
// (confirmed: 1996-03-15 came back as 1996-03-14T18:30:00.000Z on this
// server). Casting to text in SQL returns the plain YYYY-MM-DD string with
// no timezone involved at all.
const SELECT_FARMERS = `
  select f.id, f.name, f.phone, f.created_at, f.status,
    f.photo_url, f.farmer_type, f.gender, f.age, f.birth_date::text as birth_date, f.address,
    f.education_level, f.literacy, f.phone_type, f.social_media, f.email,
    f.village_id, vi.name as village_name, b.name as block_name, di.name as district_name,
    s.name as state_name, co.name as country_name, co.id as country_id
  from farmers f
  join villages vi on vi.id = f.village_id
  join blocks b on b.id = vi.block_id
  join districts di on di.id = b.district_id
  join states s on s.id = di.state_id
  join countries co on co.id = s.country_id
`;

// Same visibility rule as demo plots/trainings: Super Admin sees everything,
// everyone else is scoped to the villages their location assignments cover.
farmersRouter.get('/farmers', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(`${SELECT_FARMERS} where f.status = 'active' order by f.created_at desc limit 200`);
    return res.json({ farmers: result.rows });
  }
  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_FARMERS} where f.status = 'active' and f.village_id = any($1) order by f.created_at desc limit 200`,
    [villageIds],
  );
  res.json({ farmers: result.rows });
});

farmersRouter.get('/farmers/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'q is required' });

  const params = [PHONE_LIKE.test(q) ? q : `%${q}%`];
  let whereClause = PHONE_LIKE.test(q)
    ? `f.phone = $1`
    : `(f.name ilike $1 or f.phone ilike $1 or vi.name ilike $1)`;
  whereClause = `f.status = 'active' and (${whereClause})`;

  if (req.user.role !== 'super_admin') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    params.push(villageIds);
    whereClause += ` and f.village_id = any($${params.length})`;
  }

  const result = await pool.query(
    `${SELECT_FARMERS} where ${whereClause} order by f.created_at desc limit 100`,
    params,
  );
  res.json({ farmers: result.rows });
});

// Powers the existing-farmer lookup on the Demo Plot/Training create forms.
// Deliberately unscoped by village coverage, matching creation itself
// (POST /demo-plots and POST /trainings aren't coverage-restricted either).
// `farmer` is present whenever the phone is registered, even with zero demo
// plots - `demoPlots` keeps its own shape for the "existing plots" banner.
farmersRouter.get('/farmers/by-phone', requireAuth, async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone is required' });
  const farmerResult = await pool.query(`${SELECT_FARMERS} where f.phone = $1 and f.status = 'active'`, [phone]);
  const farmer = farmerResult.rows[0] || null;
  if (!farmer) return res.json({ farmer: null, demoPlots: [] });

  const plotsResult = await pool.query(`${SELECT_DEMO_PLOTS} where dp.farmer_id = $1 order by dp.created_at`, [farmer.id]);
  res.json({ farmer, demoPlots: plotsResult.rows });
});

// Explicit registration - unlike the activity forms' silent find-or-create,
// this fails if the phone is already registered rather than silently
// reusing it, since registering is a deliberate action here. Always
// multipart (the optional photo needs it) - the simple higher-role form
// just omits every field beyond name/phone/villageId.
farmersRouter.post('/farmers', requireAuth, requireLocation, handleFileUpload, async (req, res) => {
  if (req.user.role === 'data_enumerator') {
    return res.status(403).json({ error: 'Data Enumerators can view farmer profiles but not register new ones' });
  }
  const files = req.files || [];
  const {
    name, phone, villageId, farmerType, gender, age, birthDate,
    address, educationLevel, literacy, phoneType, email,
  } = req.body;
  const socialMedia = parseStringList(req.body.socialMedia);

  if (!name || !phone || !villageId) {
    return res.status(400).json({ error: 'name, phone, and villageId are all required' });
  }
  if (!(await requireVillageInCoverage(req, res, villageId))) return;
  const validationError = validateFarmerDetailFields({ farmerType, gender, age, educationLevel, literacy, phoneType, socialMedia, email });
  if (validationError) return res.status(400).json({ error: validationError });
  const ageNum = age !== undefined && age !== '' ? Number(age) : null;

  const photo = files.find((f) => f.fieldname === 'photo');

  try {
    const photoUrl = photo ? await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype) : null;
    const result = await pool.query(
      `insert into farmers (name, phone, village_id, created_by, photo_url, farmer_type, gender, age, birth_date, address, education_level, literacy, phone_type, social_media, email)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       returning id, name, phone, village_id, created_at`,
      [
        name, phone, villageId, req.user.userId, photoUrl, farmerType || null, gender || null, ageNum,
        birthDate || null, address?.trim() || null, educationLevel || null, literacy || null, phoneType || null,
        socialMedia.length > 0 ? socialMedia : null, email?.trim() || null,
      ],
    );
    res.status(201).json({ farmer: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      // Tell the client whose profile it is, so it can offer to open it
      // instead of just showing an error.
      const existing = await pool.query(`select id, name from farmers where phone = $1 and status = 'active'`, [phone]);
      return res.status(409).json({
        error: existing.rows[0]
          ? `${existing.rows[0].name} is already registered with this phone number.`
          : 'A farmer with this phone number is already registered',
        code: 'duplicate_phone',
        existingFarmerId: existing.rows[0]?.id,
        existingFarmerName: existing.rows[0]?.name,
      });
    }
    if (err.code === '23503') return res.status(400).json({ error: 'No such village' });
    res.status(500).json({ error: err.message });
  }
});

async function requireCoverage(req, res, villageId) {
  if (req.user.role === 'super_admin') return true;
  const villageIds = await getCoveredVillageIds(req.user.userId);
  if (!villageIds.includes(villageId)) {
    res.status(403).json({ error: "This farmer isn't in your assigned coverage" });
    return false;
  }
  return true;
}

farmersRouter.get('/farmers/:id', requireAuth, async (req, res) => {
  const result = await pool.query(`${SELECT_FARMERS} where f.id = $1`, [req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such farmer' });
  const farmer = result.rows[0];
  if (!(await requireCoverage(req, res, farmer.village_id))) return;
  res.json({ farmer });
});

// Edits an existing farmer - same fields/validation as registration, just
// an update instead of an insert. A new photo replaces the old one;
// omitting one keeps whatever was already there (coalesce below), so
// re-saving the form without touching the photo field doesn't clear it.
farmersRouter.patch('/farmers/:id', requireAuth, handleFileUpload, async (req, res) => {
  if (req.user.role === 'data_enumerator') {
    return res.status(403).json({ error: 'Data Enumerators can view farmer profiles but not edit them' });
  }
  const files = req.files || [];
  const existing = await pool.query('select village_id from farmers where id = $1', [req.params.id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such farmer' });
  if (!(await requireCoverage(req, res, existing.rows[0].village_id))) return;

  const {
    name, phone, villageId, farmerType, gender, age, birthDate,
    address, educationLevel, literacy, phoneType, email,
  } = req.body;
  const socialMedia = parseStringList(req.body.socialMedia);

  if (!name || !phone || !villageId) {
    return res.status(400).json({ error: 'name, phone, and villageId are all required' });
  }
  const validationError = validateFarmerDetailFields({ farmerType, gender, age, educationLevel, literacy, phoneType, socialMedia, email });
  if (validationError) return res.status(400).json({ error: validationError });
  const ageNum = age !== undefined && age !== '' ? Number(age) : null;

  const photo = files.find((f) => f.fieldname === 'photo');

  try {
    const photoUrl = photo ? await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype) : null;
    await pool.query(
      `update farmers set
         name = $1, phone = $2, village_id = $3, farmer_type = $4, gender = $5, age = $6,
         birth_date = $7, address = $8, education_level = $9, literacy = $10, phone_type = $11,
         social_media = $12, email = $13, photo_url = coalesce($14, photo_url)
       where id = $15`,
      [
        name, phone, villageId, farmerType || null, gender || null, ageNum, birthDate || null,
        address?.trim() || null, educationLevel || null, literacy || null, phoneType || null,
        socialMedia.length > 0 ? socialMedia : null, email?.trim() || null, photoUrl, req.params.id,
      ],
    );
    const full = await pool.query(`${SELECT_FARMERS} where f.id = $1`, [req.params.id]);
    res.json({ farmer: full.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A farmer with this phone number is already registered' });
    if (err.code === '23503') return res.status(400).json({ error: 'No such village' });
    res.status(500).json({ error: err.message });
  }
});

// Soft-delete: wrongly created profiles get hidden from every farmer list/
// search rather than actually removed, so activity history tied to the
// farmer_id FK on demo_plots/trainings/field_days stays intact.
farmersRouter.post('/farmers/:id/deactivate', requireAuth, async (req, res) => {
  if (req.user.role === 'data_enumerator') {
    return res.status(403).json({ error: 'Data Enumerators can view farmer profiles but not deactivate them' });
  }
  const existing = await pool.query('select village_id from farmers where id = $1', [req.params.id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such farmer' });
  if (!(await requireCoverage(req, res, existing.rows[0].village_id))) return;

  await pool.query("update farmers set status = 'deactivated' where id = $1", [req.params.id]);
  res.json({ ok: true });
});

// All activities (Demo/Adoption Plot, Training) logged for this farmer,
// merged and sorted by created_at desc - same "parallel queries + JS merge"
// style as visits.js's attachVisitExtras.
farmersRouter.get('/farmers/:id/activities', requireAuth, async (req, res) => {
  const farmerResult = await pool.query('select village_id from farmers where id = $1', [req.params.id]);
  if (farmerResult.rowCount === 0) return res.status(404).json({ error: 'No such farmer' });
  if (!(await requireCoverage(req, res, farmerResult.rows[0].village_id))) return;

  const [plotsResult, trainingsResult, fieldDaysResult, tfoDemoCropsResult, tfoHomeGardenCropsResult] = await Promise.all([
    // Plots linked to a TFO demo are the same demo shown again below via
    // tfoDemoCropsResult (with its richer detail) - leave them out here.
    pool.query(`${SELECT_DEMO_PLOTS} where dp.farmer_id = $1 and dp.tfo_demo_id is null order by dp.created_at desc`, [req.params.id]),
    pool.query(`${SELECT_TRAININGS} where tr.farmer_id = $1 order by tr.created_at desc`, [req.params.id]),
    pool.query(`${SELECT_FIELD_DAYS} where fd.farmer_id = $1 order by fd.created_at desc`, [req.params.id]),
    pool.query(`${SELECT_TFO_DEMO_CROPS} where td.farmer_id = $1 order by tdc.created_at desc`, [req.params.id]),
    pool.query(`${SELECT_TFO_HOME_GARDEN_CROPS} where thg.farmer_id = $1 order by thc.created_at desc`, [req.params.id]),
  ]);

  const activities = [
    ...plotsResult.rows.map((row) => ({ activityType: row.plot_type, ...row })),
    ...trainingsResult.rows.map((row) => ({ activityType: 'training', ...row })),
    ...fieldDaysResult.rows.map((row) => ({ activityType: 'fieldday', ...row })),
    // Each crop within a TFO demo is its own row here, folded into the same
    // 'demo' bucket the higher-role demo_plots entries use - the mobile
    // Demo tab discriminates the two by the presence of demo_status, which
    // only demo_plots rows carry.
    ...tfoDemoCropsResult.rows.map((row) => ({ activityType: 'demo', ...row })),
    ...tfoHomeGardenCropsResult.rows.map((row) => ({ activityType: 'homegarden', ...row })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ activities });
});
