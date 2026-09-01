import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';
import { uploadPhoto } from '../storage.js';
import { SELECT_DEMO_PLOTS } from './demoPlots.js';
import { SELECT_TRAININGS } from './trainings.js';
import { SELECT_FIELD_DAYS } from './fieldDays.js';

export const farmersRouter = Router();
farmersRouter.param('id', validateUuidParam);

const PHONE_LIKE = /^\d{6,}$/;
const FARMER_TYPES = ['key_farmer', 'core_farmer', 'farmer', 'community_trainer_farmer'];
const GENDERS = ['male', 'female', 'others'];
const EDUCATION_LEVELS = ['primary', 'secondary', 'higher', 'adult', 'no_school'];
const PHONE_TYPES = ['smartphone', 'cellphone', 'no_phone'];

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
  select f.id, f.name, f.phone, f.created_at,
    f.photo_url, f.farmer_type, f.gender, f.age, f.birth_date::text as birth_date, f.address,
    f.education_level, f.literacy, f.phone_type,
    f.village_id, vi.name as village_name, b.name as block_name, di.name as district_name,
    s.name as state_name, co.name as country_name
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
    const result = await pool.query(`${SELECT_FARMERS} order by f.created_at desc limit 200`);
    return res.json({ farmers: result.rows });
  }
  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_FARMERS} where f.village_id = any($1) order by f.created_at desc limit 200`,
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
  const farmerResult = await pool.query(`${SELECT_FARMERS} where f.phone = $1`, [phone]);
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
farmersRouter.post('/farmers', requireAuth, handleFileUpload, async (req, res) => {
  const files = req.files || [];
  const {
    name, phone, villageId, farmerType, gender, age, birthDate,
    address, educationLevel, literacy, phoneType,
  } = req.body;

  if (!name || !phone || !villageId) {
    return res.status(400).json({ error: 'name, phone, and villageId are all required' });
  }
  if (farmerType && !FARMER_TYPES.includes(farmerType)) {
    return res.status(400).json({ error: `farmerType must be one of: ${FARMER_TYPES.join(', ')}` });
  }
  if (gender && !GENDERS.includes(gender)) {
    return res.status(400).json({ error: `gender must be one of: ${GENDERS.join(', ')}` });
  }
  let ageNum = null;
  if (age !== undefined && age !== '') {
    ageNum = Number(age);
    if (!Number.isInteger(ageNum) || ageNum <= 14) {
      return res.status(400).json({ error: 'age must be a whole number above 14' });
    }
  }
  if (educationLevel && !EDUCATION_LEVELS.includes(educationLevel)) {
    return res.status(400).json({ error: `educationLevel must be one of: ${EDUCATION_LEVELS.join(', ')}` });
  }
  if (literacy && !['yes', 'no'].includes(literacy)) {
    return res.status(400).json({ error: "literacy must be 'yes' or 'no'" });
  }
  if (phoneType && !PHONE_TYPES.includes(phoneType)) {
    return res.status(400).json({ error: `phoneType must be one of: ${PHONE_TYPES.join(', ')}` });
  }

  const photo = files.find((f) => f.fieldname === 'photo');

  try {
    const photoUrl = photo ? await uploadPhoto(photo.buffer, photo.originalname, photo.mimetype) : null;
    const result = await pool.query(
      `insert into farmers (name, phone, village_id, created_by, photo_url, farmer_type, gender, age, birth_date, address, education_level, literacy, phone_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       returning id, name, phone, village_id, created_at`,
      [
        name, phone, villageId, req.user.userId, photoUrl, farmerType || null, gender || null, ageNum,
        birthDate || null, address?.trim() || null, educationLevel || null, literacy || null, phoneType || null,
      ],
    );
    res.status(201).json({ farmer: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A farmer with this phone number is already registered' });
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

// All activities (Demo/Adoption Plot, Training) logged for this farmer,
// merged and sorted by created_at desc - same "parallel queries + JS merge"
// style as visits.js's attachVisitExtras.
farmersRouter.get('/farmers/:id/activities', requireAuth, async (req, res) => {
  const farmerResult = await pool.query('select village_id from farmers where id = $1', [req.params.id]);
  if (farmerResult.rowCount === 0) return res.status(404).json({ error: 'No such farmer' });
  if (!(await requireCoverage(req, res, farmerResult.rows[0].village_id))) return;

  const [plotsResult, trainingsResult, fieldDaysResult] = await Promise.all([
    pool.query(`${SELECT_DEMO_PLOTS} where dp.farmer_id = $1 order by dp.created_at desc`, [req.params.id]),
    pool.query(`${SELECT_TRAININGS} where tr.farmer_id = $1 order by tr.created_at desc`, [req.params.id]),
    pool.query(`${SELECT_FIELD_DAYS} where fd.farmer_id = $1 order by fd.created_at desc`, [req.params.id]),
  ]);

  const activities = [
    ...plotsResult.rows.map((row) => ({ activityType: row.plot_type, ...row })),
    ...trainingsResult.rows.map((row) => ({ activityType: 'training', ...row })),
    ...fieldDaysResult.rows.map((row) => ({ activityType: 'fieldday', ...row })),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  res.json({ activities });
});
