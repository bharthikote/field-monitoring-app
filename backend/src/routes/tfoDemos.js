import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';

export const tfoDemosRouter = Router();
tfoDemosRouter.param('id', validateUuidParam);

const CYCLES = ['demo_1', 'demo_2', 'demo_3', 'demo_4', 'adoption_1', 'adoption_2', 'adoption_3', 'adoption_4'];
const SOIL_TYPES = ['sandy', 'sandy_loam', 'loamy', 'clay'];
const IRRIGATION_SYSTEMS = ['hand_watering', 'drip_irrigation', 'sprinkler', 'rainfed'];

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

// Not coverage-restricted - matches demo_plots (POST /demo-plots), where
// any authorized role can log a plot anywhere.
tfoDemosRouter.post('/tfo-demos', requireAuth, async (req, res) => {
  const { farmerId, villageId, gpsLat, gpsLng, cycle, ownArea, rentArea, soilPh, soilType, crops } = req.body;

  if (!farmerId || !villageId || gpsLat === undefined || gpsLng === undefined || gpsLat === '' || gpsLng === '') {
    return res.status(400).json({ error: 'farmerId, villageId, gpsLat, and gpsLng are all required' });
  }
  if (!CYCLES.includes(cycle)) return res.status(400).json({ error: `cycle must be one of: ${CYCLES.join(', ')}` });
  if (ownArea === undefined || ownArea === '' || Number(ownArea) < 0) return res.status(400).json({ error: 'own area is required' });
  if (rentArea === undefined || rentArea === '' || Number(rentArea) < 0) return res.status(400).json({ error: 'rent area is required' });
  const ph = Number(soilPh);
  if (soilPh === undefined || soilPh === '' || Number.isNaN(ph) || ph < 0 || ph > 14) {
    return res.status(400).json({ error: 'soil pH must be a number between 0 and 14' });
  }
  if (!SOIL_TYPES.includes(soilType)) return res.status(400).json({ error: `soilType must be one of: ${SOIL_TYPES.join(', ')}` });
  if (!Array.isArray(crops) || crops.length === 0) return res.status(400).json({ error: 'At least one crop is required' });

  for (let i = 0; i < crops.length; i++) {
    const cropError = validateCrop(crops[i], i);
    if (cropError) return res.status(400).json({ error: cropError });
  }

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
