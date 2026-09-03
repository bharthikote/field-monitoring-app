import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';

export const tfoDemosRouter = Router();
tfoDemosRouter.param('id', validateUuidParam);

const CYCLES = ['demo_1', 'demo_2', 'demo_3', 'demo_4', 'adoption_1', 'adoption_2', 'adoption_3', 'adoption_4'];
const SOIL_TYPES = ['sandy', 'sandy_loam', 'loamy', 'clay'];
const IRRIGATION_SYSTEMS = ['hand_watering', 'drip_irrigation', 'sprinkler', 'rainfed'];
const STATUSES = ['ongoing', 'completed', 'terminated'];

// One row per demo (not per crop) - powers the Demos list screen. Crop
// names are aggregated into a single display string since the list is a
// summary view, not the detail (see SELECT_TFO_DEMO_DETAIL below for that).
const SELECT_TFO_DEMOS = `
  select td.id, td.farmer_id, f.name as farmer_name, f.phone as farmer_phone,
    td.village_id, vi.name as village_name, td.cycle, td.status, td.created_at,
    coalesce((
      select string_agg(c.name, ', ' order by c.name)
      from tfo_demo_crops tdc join crops c on c.id = tdc.crop_id
      where tdc.demo_id = td.id
    ), '') as crop_names
  from tfo_demos td
  join farmers f on f.id = td.farmer_id
  join villages vi on vi.id = td.village_id
`;

// Same visibility rule as demo_plots: Super Admin sees everything, everyone
// else is scoped to the villages their location assignments cover.
tfoDemosRouter.get('/tfo-demos', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(`${SELECT_TFO_DEMOS} order by td.created_at desc limit 200`);
    return res.json({ demos: result.rows });
  }
  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_TFO_DEMOS} where td.village_id = any($1) order by td.created_at desc limit 200`,
    [villageIds],
  );
  res.json({ demos: result.rows });
});

// Full single-demo detail, for the monitoring page and the Edit form's
// prefill - farmer/village carry the same breadcrumb shape LocationPicker's
// lockedVillage prop already expects elsewhere in the app.
const SELECT_TFO_DEMO_DETAIL = `
  select td.id, td.farmer_id, f.name as farmer_name, f.phone as farmer_phone,
    td.village_id, vi.name as village_name, b.name as block_name, di.name as district_name,
    s.name as state_name, co.name as country_name,
    td.gps_lat, td.gps_lng, td.cycle, td.status,
    td.own_area, td.rent_area, td.soil_ph, td.soil_type, td.created_at
  from tfo_demos td
  join farmers f on f.id = td.farmer_id
  join villages vi on vi.id = td.village_id
  join blocks b on b.id = vi.block_id
  join districts di on di.id = b.district_id
  join states s on s.id = di.state_id
  join countries co on co.id = s.country_id
`;

const SELECT_TFO_DEMO_DETAIL_CROPS = `
  select tdc.id, tdc.crop_id, c.name as crop_name, tdc.variety_id, v.name as variety_name,
    tdc.season_id, se.name as season_name, tdc.crop_area, tdc.no_of_seeding,
    tdc.sowing_date::text as sowing_date, tdc.transplant_date::text as transplant_date,
    tdc.est_harvest_date::text as est_harvest_date, tdc.irrigation_system,
    tdc.no_transplanted, tdc.no_harvested
  from tfo_demo_crops tdc
  join crops c on c.id = tdc.crop_id
  join varieties v on v.id = tdc.variety_id
  join seasons se on se.id = tdc.season_id
  where tdc.demo_id = $1
  order by tdc.created_at asc
`;

async function requireCoverage(req, res, villageId) {
  if (req.user.role === 'super_admin') return true;
  const villageIds = await getCoveredVillageIds(req.user.userId);
  if (!villageIds.includes(villageId)) {
    res.status(403).json({ error: "This demo isn't in your assigned coverage" });
    return false;
  }
  return true;
}

tfoDemosRouter.get('/tfo-demos/:id', requireAuth, async (req, res) => {
  const demoResult = await pool.query(`${SELECT_TFO_DEMO_DETAIL} where td.id = $1`, [req.params.id]);
  if (demoResult.rowCount === 0) return res.status(404).json({ error: 'No such demo' });
  const demo = demoResult.rows[0];
  if (!(await requireCoverage(req, res, demo.village_id))) return;

  const cropsResult = await pool.query(SELECT_TFO_DEMO_DETAIL_CROPS, [req.params.id]);
  res.json({ demo, crops: cropsResult.rows });
});

// One crop entry within a demo submission. Sowing -> transplant -> harvest
// is a fixed real-world sequence, and each stage's surviving count can only
// shrink from the one before it (plants lost along the way to disease/bad
// weather, never gained) - mirrors the same checks enforced at the DB level
// (migration 029) so a bad submission gets a clear message instead of a
// raw constraint-violation error.
function validateCrop(crop, index) {
  const {
    cropId, varietyId, seasonId, cropArea, noOfSeeding,
    sowingDate, transplantDate, estHarvestDate, irrigationSystem, noTransplanted, noHarvested,
  } = crop;
  const label = `Crop ${index + 1}`;

  if (!cropId || !varietyId || !seasonId) return `${label}: crop, variety, and season are all required`;
  if (cropArea === undefined || cropArea === '' || Number(cropArea) < 0) return `${label}: crop area is required`;
  if (noOfSeeding === undefined || noOfSeeding === '' || !Number.isInteger(Number(noOfSeeding)) || Number(noOfSeeding) < 0) {
    return `${label}: number of seeding is required`;
  }
  if (!sowingDate || !transplantDate || !estHarvestDate) {
    return `${label}: sowing, transplant, and estimated harvest dates are all required`;
  }
  if (!(sowingDate <= transplantDate && transplantDate <= estHarvestDate)) {
    return `${label}: sowing date must be on or before the transplant date, which must be on or before the estimated harvest date`;
  }
  if (!IRRIGATION_SYSTEMS.includes(irrigationSystem)) {
    return `${label}: irrigation system must be one of: ${IRRIGATION_SYSTEMS.join(', ')}`;
  }

  const seeding = Number(noOfSeeding);
  const hasTransplanted = noTransplanted !== undefined && noTransplanted !== '' && noTransplanted !== null;
  const hasHarvested = noHarvested !== undefined && noHarvested !== '' && noHarvested !== null;

  if (hasTransplanted) {
    const transplanted = Number(noTransplanted);
    if (!Number.isInteger(transplanted) || transplanted < 0) return `${label}: number transplanted must be a whole number`;
    if (transplanted > seeding) return `${label}: number transplanted can't be more than the number of seeding`;
    if (hasHarvested) {
      const harvested = Number(noHarvested);
      if (!Number.isInteger(harvested) || harvested < 0) return `${label}: number harvested must be a whole number`;
      if (harvested > transplanted) return `${label}: number harvested can't be more than the number transplanted`;
    }
  } else if (hasHarvested) {
    return `${label}: number harvested needs a number transplanted first`;
  }
  return null;
}

// Shared by create and edit - both accept the same demo-level fields with
// the same rules, just an insert vs. an update underneath.
function validateDemoFields({ farmerId, villageId, gpsLat, gpsLng, cycle, ownArea, rentArea, soilPh, soilType, crops }) {
  if (!farmerId || !villageId || gpsLat === undefined || gpsLng === undefined || gpsLat === '' || gpsLng === '') {
    return 'farmerId, villageId, gpsLat, and gpsLng are all required';
  }
  if (!CYCLES.includes(cycle)) return `cycle must be one of: ${CYCLES.join(', ')}`;
  if (ownArea === undefined || ownArea === '' || Number(ownArea) < 0) return 'own area is required';
  if (rentArea === undefined || rentArea === '' || Number(rentArea) < 0) return 'rent area is required';
  const ph = Number(soilPh);
  if (soilPh === undefined || soilPh === '' || Number.isNaN(ph) || ph < 0 || ph > 14) {
    return 'soil pH must be a number between 0 and 14';
  }
  if (!SOIL_TYPES.includes(soilType)) return `soilType must be one of: ${SOIL_TYPES.join(', ')}`;
  if (!Array.isArray(crops) || crops.length === 0) return 'At least one crop is required';

  for (let i = 0; i < crops.length; i++) {
    const cropError = validateCrop(crops[i], i);
    if (cropError) return cropError;
  }
  return null;
}

// Not coverage-restricted - matches demo_plots (POST /demo-plots), where
// any authorized role can log a plot anywhere.
tfoDemosRouter.post('/tfo-demos', requireAuth, async (req, res) => {
  const validationError = validateDemoFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const { farmerId, villageId, gpsLat, gpsLng, cycle, ownArea, rentArea, soilPh, soilType, crops } = req.body;

  const client = await pool.connect();
  try {
    await client.query('begin');
    const demoResult = await client.query(
      `insert into tfo_demos (farmer_id, village_id, created_by, gps_lat, gps_lng, cycle, own_area, rent_area, soil_ph, soil_type)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning id, created_at`,
      [farmerId, villageId, req.user.userId, gpsLat, gpsLng, cycle, ownArea, rentArea, soilPh, soilType],
    );
    const demoId = demoResult.rows[0].id;
    await insertCrops(client, demoId, crops);
    await client.query('commit');
    res.status(201).json({ demo: { id: demoId, created_at: demoResult.rows[0].created_at } });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'No such farmer, village, crop, variety, or season' });
    if (err.code === '23514') return res.status(400).json({ error: 'One of the values failed a validation rule (check date order, soil pH range, and seeding/transplanted/harvested counts)' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

async function insertCrops(client, demoId, crops) {
  for (const crop of crops) {
    await client.query(
      `insert into tfo_demo_crops
         (demo_id, crop_id, variety_id, season_id, crop_area, no_of_seeding, sowing_date, transplant_date, est_harvest_date, irrigation_system, no_transplanted, no_harvested)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        demoId, crop.cropId, crop.varietyId, crop.seasonId, crop.cropArea, crop.noOfSeeding,
        crop.sowingDate, crop.transplantDate, crop.estHarvestDate, crop.irrigationSystem,
        crop.noTransplanted || null, crop.noHarvested || null,
      ],
    );
  }
}

// Editing is only allowed while a demo is 'ongoing' - once Completed or
// Terminated, a normal user can't change its content (only Super Admin can
// revert the status back to 'ongoing' via POST /tfo-demos/:id/status,
// which then reopens editing through this same route).
tfoDemosRouter.patch('/tfo-demos/:id', requireAuth, async (req, res) => {
  const existing = await pool.query('select village_id, status from tfo_demos where id = $1', [req.params.id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such demo' });
  if (!(await requireCoverage(req, res, existing.rows[0].village_id))) return;
  if (existing.rows[0].status !== 'ongoing') {
    return res.status(403).json({ error: 'This demo is not Ongoing and can\'t be edited. Ask a Super Admin to reopen it first.' });
  }

  const validationError = validateDemoFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const { farmerId, villageId, gpsLat, gpsLng, cycle, ownArea, rentArea, soilPh, soilType, crops } = req.body;

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update tfo_demos set farmer_id = $1, village_id = $2, gps_lat = $3, gps_lng = $4, cycle = $5,
         own_area = $6, rent_area = $7, soil_ph = $8, soil_type = $9
       where id = $10`,
      [farmerId, villageId, gpsLat, gpsLng, cycle, ownArea, rentArea, soilPh, soilType, req.params.id],
    );
    // Crops are replaced wholesale rather than diffed - the form always
    // submits its complete current list, and a demo's crops have no
    // identity worth preserving across an edit (no other table references
    // a tfo_demo_crops row by id).
    await client.query('delete from tfo_demo_crops where demo_id = $1', [req.params.id]);
    await insertCrops(client, req.params.id, crops);
    await client.query('commit');
    res.json({ ok: true });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'No such farmer, village, crop, variety, or season' });
    if (err.code === '23514') return res.status(400).json({ error: 'One of the values failed a validation rule (check date order, soil pH range, and seeding/transplanted/harvested counts)' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Status transitions: a normal user may only move an Ongoing demo forward
// to Completed or Terminated. Any other transition (reopening a Completed/
// Terminated demo back to Ongoing, or otherwise correcting a status)
// requires Super Admin - the data-quality override described in the
// monitoring page spec.
tfoDemosRouter.post('/tfo-demos/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });

  const existing = await pool.query('select village_id, status from tfo_demos where id = $1', [req.params.id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such demo' });
  if (!(await requireCoverage(req, res, existing.rows[0].village_id))) return;

  const currentStatus = existing.rows[0].status;
  const isForwardFromOngoing = currentStatus === 'ongoing' && (status === 'completed' || status === 'terminated');
  if (!isForwardFromOngoing && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can change the status of a Completed or Terminated demo' });
  }

  const result = await pool.query('update tfo_demos set status = $1 where id = $2 returning id, status', [status, req.params.id]);
  res.json({ demo: result.rows[0] });
});

// One row per crop entry, not per demo - powers the TFO farmer detail
// screen's Demo tab, where each crop within a multi-crop demo shows as its
// own activity card (same flattening the existing tab already expects).
export const SELECT_TFO_DEMO_CROPS = `
  select tdc.id, tdc.demo_id, tdc.created_at,
    c.name as crop_name, v.name as variety_name, se.name as season_name,
    td.cycle, td.farmer_id,
    tdc.sowing_date::text as sowing_date, tdc.transplant_date::text as transplant_date,
    tdc.est_harvest_date::text as est_harvest_date,
    tdc.no_of_seeding, tdc.no_transplanted, tdc.no_harvested, tdc.irrigation_system
  from tfo_demo_crops tdc
  join tfo_demos td on td.id = tdc.demo_id
  join crops c on c.id = tdc.crop_id
  join varieties v on v.id = tdc.variety_id
  join seasons se on se.id = tdc.season_id
`;
