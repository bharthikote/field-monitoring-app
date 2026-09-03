import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';

export const tfoHomeGardensRouter = Router();
tfoHomeGardensRouter.param('id', validateUuidParam);

const CYCLES = [
  'demo_1', 'homegarden_1', 'homegarden_2', 'homegarden_3',
  'adoption_1', 'adoption_2', 'adoption_3', 'adoption_4',
];
const LAND_TYPES = ['own', 'lease_rented'];
// Same option set as tfoDemos.js's irrigation/soil-type enums - kept as a
// separate local copy (matching this codebase's existing convention of
// each route file owning its own small constants) rather than a shared
// backend module, since only the mobile UI was asked to reuse these.
const IRRIGATION_SYSTEMS = ['hand_watering', 'drip_irrigation', 'sprinkler', 'rainfed'];
const FIELD_CONDITIONS = ['sandy', 'sandy_loam', 'loamy', 'clay'];

// One crop entry within a Home Garden submission. Simpler than a Demo's -
// no per-crop irrigation/season/counts, just seedlings and the sowing ->
// transplant -> harvest date sequence (same real-world ordering rule as
// tfoDemos.js).
function validateCrop(crop, index) {
  const { cropId, varietyId, noOfSeedlings, sowingDate, transplantDate, harvestDate } = crop;
  const label = `Crop ${index + 1}`;

  if (!cropId || !varietyId) return `${label}: crop and variety are required`;
  if (noOfSeedlings === undefined || noOfSeedlings === '' || !Number.isInteger(Number(noOfSeedlings)) || Number(noOfSeedlings) < 0) {
    return `${label}: number of seedlings is required`;
  }
  if (!sowingDate || !transplantDate || !harvestDate) {
    return `${label}: sowing, transplanting, and harvesting dates are all required`;
  }
  if (!(sowingDate <= transplantDate && transplantDate <= harvestDate)) {
    return `${label}: sowing date must be on or before the transplanting date, which must be on or before the harvesting date`;
  }
  return null;
}

// One row per Home Garden (not per crop) - powers the Home Gardens list
// screen, same shape as tfoDemos.js's SELECT_TFO_DEMOS.
const SELECT_TFO_HOME_GARDENS = `
  select thg.id, thg.farmer_id, f.name as farmer_name, f.phone as farmer_phone,
    thg.village_id, vi.name as village_name, thg.cycle, thg.created_at,
    coalesce((
      select string_agg(c.name, ', ' order by c.name)
      from tfo_home_garden_crops thc join crops c on c.id = thc.crop_id
      where thc.home_garden_id = thg.id
    ), '') as crop_names
  from tfo_home_gardens thg
  join farmers f on f.id = thg.farmer_id
  join villages vi on vi.id = thg.village_id
`;

// Same visibility rule as demo_plots/tfo_demos: Super Admin sees
// everything, everyone else is scoped to their covered villages.
tfoHomeGardensRouter.get('/tfo-home-gardens', requireAuth, async (req, res) => {
  if (req.user.role === 'super_admin') {
    const result = await pool.query(`${SELECT_TFO_HOME_GARDENS} order by thg.created_at desc limit 200`);
    return res.json({ homeGardens: result.rows });
  }
  const villageIds = await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `${SELECT_TFO_HOME_GARDENS} where thg.village_id = any($1) order by thg.created_at desc limit 200`,
    [villageIds],
  );
  res.json({ homeGardens: result.rows });
});

// Not coverage-restricted, matching tfo_demos (POST /tfo-demos) - any
// authorized role can log one anywhere.
tfoHomeGardensRouter.post('/tfo-home-gardens', requireAuth, async (req, res) => {
  const { farmerId, villageId, gpsLat, gpsLng, cycle, area, landType, compost, irrigationSystem, fieldCondition, siteId, crops } = req.body;

  if (!farmerId || !villageId || gpsLat === undefined || gpsLng === undefined || gpsLat === '' || gpsLng === '') {
    return res.status(400).json({ error: 'farmerId, villageId, gpsLat, and gpsLng are all required' });
  }
  if (!CYCLES.includes(cycle)) return res.status(400).json({ error: `cycle must be one of: ${CYCLES.join(', ')}` });
  if (area === undefined || area === '' || Number(area) < 0) return res.status(400).json({ error: 'area is required' });
  if (!LAND_TYPES.includes(landType)) return res.status(400).json({ error: `landType must be one of: ${LAND_TYPES.join(', ')}` });
  if (typeof compost !== 'boolean') return res.status(400).json({ error: 'compost must be true or false' });
  if (!IRRIGATION_SYSTEMS.includes(irrigationSystem)) return res.status(400).json({ error: `irrigationSystem must be one of: ${IRRIGATION_SYSTEMS.join(', ')}` });
  if (!FIELD_CONDITIONS.includes(fieldCondition)) return res.status(400).json({ error: `fieldCondition must be one of: ${FIELD_CONDITIONS.join(', ')}` });
  if (!siteId || !siteId.trim()) return res.status(400).json({ error: 'siteId is required' });
  if (!Array.isArray(crops) || crops.length === 0) return res.status(400).json({ error: 'At least one crop is required' });

  for (let i = 0; i < crops.length; i++) {
    const cropError = validateCrop(crops[i], i);
    if (cropError) return res.status(400).json({ error: cropError });
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    const hgResult = await client.query(
      `insert into tfo_home_gardens (farmer_id, village_id, created_by, gps_lat, gps_lng, cycle, area, land_type, compost, irrigation_system, field_condition, site_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       returning id, created_at`,
      [farmerId, villageId, req.user.userId, gpsLat, gpsLng, cycle, area, landType, compost, irrigationSystem, fieldCondition, siteId.trim()],
    );
    const homeGardenId = hgResult.rows[0].id;

    for (const crop of crops) {
      await client.query(
        `insert into tfo_home_garden_crops
           (home_garden_id, crop_id, variety_id, no_of_seedlings, sowing_date, transplant_date, harvest_date, container_number, plant_number)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          homeGardenId, crop.cropId, crop.varietyId, crop.noOfSeedlings,
          crop.sowingDate, crop.transplantDate, crop.harvestDate,
          crop.containerNumber?.trim() || null, crop.plantNumber?.trim() || null,
        ],
      );
    }
    await client.query('commit');
    res.status(201).json({ homeGarden: { id: homeGardenId, created_at: hgResult.rows[0].created_at } });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23503') return res.status(400).json({ error: 'No such farmer, village, crop, or variety' });
    if (err.code === '23514') return res.status(400).json({ error: 'One of the values failed a validation rule (check date order and area)' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// One row per crop entry, not per Home Garden - powers the TFO farmer
// detail screen's Home Garden tab, same flattening tfoDemos.js's
// SELECT_TFO_DEMO_CROPS does for the Demo tab.
export const SELECT_TFO_HOME_GARDEN_CROPS = `
  select thc.id, thc.home_garden_id, thc.created_at,
    c.name as crop_name, v.name as variety_name,
    thg.cycle, thg.farmer_id,
    thc.sowing_date::text as sowing_date, thc.transplant_date::text as transplant_date,
    thc.harvest_date::text as harvest_date,
    thc.no_of_seedlings, thc.container_number, thc.plant_number
  from tfo_home_garden_crops thc
  join tfo_home_gardens thg on thg.id = thc.home_garden_id
  join crops c on c.id = thc.crop_id
  join varieties v on v.id = thc.variety_id
`;
