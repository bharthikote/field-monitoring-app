import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import { getCoveredVillageIds, requireVillageInCoverage } from '../db/locationHelpers.js';
import { requireLocation } from '../middleware/requireLocation.js';

export const tfoDemosRouter = Router();
tfoDemosRouter.param('id', validateUuidParam);
tfoDemosRouter.param('itemId', validateUuidParam);
tfoDemosRouter.param('transactionId', validateUuidParam);

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

// Every crop in a TFO demo also exists as a demo_plots row, so higher
// officials can visit it and raise issues on it like on any other plot (see
// migration 048). One plot per (demo, crop, variety), created or refreshed
// here in the same transaction as the demo itself. Crops dropped by an edit
// lose their plot if it has no visits/issues, otherwise it's kept but marked
// terminated - never deleted out from under existing history.
async function syncDemoPlots(client, demoId) {
  const demoResult = await client.query(
    `select td.id, td.farmer_id, td.village_id, td.cycle, td.status, td.created_by, td.gps_lat, td.gps_lng,
       f.name as farmer_name, f.phone as farmer_phone
     from tfo_demos td join farmers f on f.id = td.farmer_id where td.id = $1`,
    [demoId],
  );
  const demo = demoResult.rows[0];
  const plotType = demo.cycle.startsWith('adoption') ? 'adoption' : 'demo';
  const cropsResult = await client.query(
    'select distinct crop_id, variety_id from tfo_demo_crops where demo_id = $1',
    [demoId],
  );

  for (const crop of cropsResult.rows) {
    await client.query(
      `insert into demo_plots
         (farmer_id, farmer_name, farmer_phone, crop_id, variety_id, village_id, demo_status, plot_type, cycle, created_by, tfo_demo_id, gps_lat, gps_lng)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       on conflict (tfo_demo_id, crop_id, variety_id) where tfo_demo_id is not null
       do update set farmer_id = excluded.farmer_id, farmer_name = excluded.farmer_name,
         farmer_phone = excluded.farmer_phone, village_id = excluded.village_id,
         demo_status = excluded.demo_status, plot_type = excluded.plot_type,
         cycle = excluded.cycle, gps_lat = excluded.gps_lat, gps_lng = excluded.gps_lng, updated_at = now()`,
      [
        demo.farmer_id, demo.farmer_name, demo.farmer_phone, crop.crop_id, crop.variety_id,
        demo.village_id, demo.status, plotType, demo.cycle, demo.created_by, demoId, demo.gps_lat, demo.gps_lng,
      ],
    );
  }

  const noLongerInDemo = `dp.tfo_demo_id = $1 and not exists (
    select 1 from tfo_demo_crops c where c.demo_id = $1 and c.crop_id = dp.crop_id and c.variety_id = dp.variety_id
  )`;
  await client.query(
    `delete from demo_plots dp where ${noLongerInDemo}
       and not exists (select 1 from visits v where v.demo_plot_id = dp.id)
       and not exists (select 1 from issues i where i.demo_plot_id = dp.id)`,
    [demoId],
  );
  await client.query(
    `update demo_plots dp set demo_status = 'terminated', updated_at = now() where ${noLongerInDemo}`,
    [demoId],
  );
}

// TFOs are limited to villages they cover, same as every other role - a
// demo they couldn't see afterwards is never useful.
tfoDemosRouter.post('/tfo-demos', requireAuth, requireLocation, async (req, res) => {
  const validationError = validateDemoFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const { farmerId, villageId, gpsLat, gpsLng, cycle, ownArea, rentArea, soilPh, soilType, crops } = req.body;
  if (!(await requireVillageInCoverage(req, res, villageId))) return;

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
    await syncDemoPlots(client, demoId);
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
  if (!(await requireVillageInCoverage(req, res, villageId))) return;

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
    await syncDemoPlots(client, req.params.id);
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
  await pool.query('update demo_plots set demo_status = $1, updated_at = now() where tfo_demo_id = $2', [status, req.params.id]);
  res.json({ demo: result.rows[0] });
});

// Everything the mobile Business Plan -> Expected Cost tab needs, in a
// single round trip: every active Activity/Item configured for the demo's
// own country (same activity_item_countries scoping the web admin already
// enforces), each carrying its configured units and this demo's already-
// saved cost entry if one exists. Deliberately NOT built by reusing the
// Super-Admin-only GET /activities + GET /activities/:id endpoints - those
// are unscoped by country and would mean one request per activity; this is
// one query, grouped into the nested shape in JS.
const SELECT_EXPECTED_COST_ITEMS = `
  select a.id as activity_id, a.name as activity_name,
    ai.id as item_id, ai.name as item_name,
    coalesce((
      select json_agg(json_build_object('id', u.id, 'name', u.name) order by u.name)
      from activity_item_units aiu join units u on u.id = aiu.unit_id where aiu.item_id = ai.id
    ), '[]') as units,
    dec.quantity, dec.unit_id as saved_unit_id, dec.farmer_price, dec.loan_price
  from activities a
  join activity_items ai on ai.activity_id = a.id and ai.status = 'active'
  join activity_item_countries aic on aic.item_id = ai.id and aic.country_id = $2
  left join tfo_demo_expected_costs dec on dec.demo_id = $1 and dec.item_id = ai.id
  where a.status = 'active'
  order by a.name asc, ai.name asc
`;

tfoDemosRouter.get('/tfo-demos/:id/expected-cost', requireAuth, async (req, res) => {
  const demoResult = await pool.query(
    `select td.village_id, td.status, co.id as country_id, co.currency_code
     from tfo_demos td
     join villages vi on vi.id = td.village_id join blocks b on b.id = vi.block_id
     join districts di on di.id = b.district_id join states s on s.id = di.state_id
     join countries co on co.id = s.country_id
     where td.id = $1`,
    [req.params.id],
  );
  if (demoResult.rowCount === 0) return res.status(404).json({ error: 'No such demo' });
  const demo = demoResult.rows[0];
  if (!(await requireCoverage(req, res, demo.village_id))) return;

  const rows = (await pool.query(SELECT_EXPECTED_COST_ITEMS, [req.params.id, demo.country_id])).rows;
  const activitiesById = new Map();
  for (const row of rows) {
    if (!activitiesById.has(row.activity_id)) {
      activitiesById.set(row.activity_id, { id: row.activity_id, name: row.activity_name, items: [] });
    }
    activitiesById.get(row.activity_id).items.push({
      id: row.item_id,
      name: row.item_name,
      units: row.units,
      savedCost: row.quantity === null ? null : {
        quantity: row.quantity, unitId: row.saved_unit_id, farmerPrice: row.farmer_price, loanPrice: row.loan_price,
      },
    });
  }

  res.json({
    currency: demo.currency_code,
    isOngoing: demo.status === 'ongoing',
    activities: [...activitiesById.values()].filter((a) => a.items.length > 0),
  });
});

// Upserts one item's cost entry (create if new, update in place if this
// Activity + Item was already saved for this demo) - the "consolidate
// duplicate item" rule from the spec, enforced here via ON CONFLICT rather
// than trusting the client to only ever POST once per item.
tfoDemosRouter.post('/tfo-demos/:id/expected-cost', requireAuth, async (req, res) => {
  const demoResult = await pool.query(
    `select td.village_id, td.status, co.id as country_id from tfo_demos td
     join villages vi on vi.id = td.village_id join blocks b on b.id = vi.block_id
     join districts di on di.id = b.district_id join states s on s.id = di.state_id
     join countries co on co.id = s.country_id
     where td.id = $1`,
    [req.params.id],
  );
  if (demoResult.rowCount === 0) return res.status(404).json({ error: 'No such demo' });
  const demo = demoResult.rows[0];
  if (!(await requireCoverage(req, res, demo.village_id))) return;
  if (demo.status !== 'ongoing') {
    return res.status(403).json({ error: 'This demo is not Ongoing and can\'t be edited. Ask a Super Admin to reopen it first.' });
  }

  const { itemId, quantity, unitId, farmerPrice, loanPrice } = req.body;
  if (!itemId || !unitId) return res.status(400).json({ error: 'itemId and unitId are required' });
  const qty = Number(quantity);
  const farmer = Number(farmerPrice ?? 0);
  const loan = Number(loanPrice ?? 0);
  if (quantity === undefined || quantity === '' || Number.isNaN(qty) || qty < 0) return res.status(400).json({ error: 'Expected Quantity must be a number that is 0 or more' });
  if (Number.isNaN(farmer) || farmer < 0) return res.status(400).json({ error: 'Farmer Expected Price must be a number that is 0 or more' });
  if (Number.isNaN(loan) || loan < 0) return res.status(400).json({ error: 'Loan Expected Price must be a number that is 0 or more' });

  const itemResult = await pool.query(
    `select ai.id, ai.activity_id, a.status as activity_status,
       exists(select 1 from activity_item_countries aic where aic.item_id = ai.id and aic.country_id = $2) as in_country,
       exists(select 1 from activity_item_units aiu where aiu.item_id = ai.id and aiu.unit_id = $3) as valid_unit
     from activity_items ai join activities a on a.id = ai.activity_id
     where ai.id = $1 and ai.status = 'active'`,
    [itemId, demo.country_id, unitId],
  );
  if (itemResult.rowCount === 0 || itemResult.rows[0].activity_status !== 'active' || !itemResult.rows[0].in_country) {
    return res.status(400).json({ error: 'This item is not configured for this demo\'s country' });
  }
  if (!itemResult.rows[0].valid_unit) {
    return res.status(400).json({ error: 'This unit is not configured for this item' });
  }

  const result = await pool.query(
    `insert into tfo_demo_expected_costs (demo_id, activity_id, item_id, quantity, unit_id, farmer_price, loan_price, updated_at)
     values ($1, $2, $3, $4, $5, $6, $7, now())
     on conflict (demo_id, item_id) do update set
       quantity = excluded.quantity, unit_id = excluded.unit_id,
       farmer_price = excluded.farmer_price, loan_price = excluded.loan_price, updated_at = now()
     returning id`,
    [req.params.id, itemResult.rows[0].activity_id, itemId, qty, unitId, farmer, loan],
  );
  res.status(200).json({ id: result.rows[0].id });
});

tfoDemosRouter.delete('/tfo-demos/:id/expected-cost/:itemId', requireAuth, async (req, res) => {
  const demoResult = await pool.query('select village_id, status from tfo_demos where id = $1', [req.params.id]);
  if (demoResult.rowCount === 0) return res.status(404).json({ error: 'No such demo' });
  if (!(await requireCoverage(req, res, demoResult.rows[0].village_id))) return;
  if (demoResult.rows[0].status !== 'ongoing') {
    return res.status(403).json({ error: 'This demo is not Ongoing and can\'t be edited. Ask a Super Admin to reopen it first.' });
  }
  await pool.query('delete from tfo_demo_expected_costs where demo_id = $1 and item_id = $2', [req.params.id, req.params.itemId]);
  res.status(204).end();
});

// Mirrors the Expected Cost endpoints above exactly (same country-scoping,
// same single-round-trip query shape, same ongoing-only edit lock, same
// upsert-on-(demo_id, item_id) consolidation rule) but sourced from the
// separate activity_returns/activity_return_items tables instead - Cost
// and Return are different master configurations, not the same one reused.
const SELECT_EXPECTED_RETURN_ITEMS = `
  select ar.id as activity_id, ar.name as activity_name,
    ari.id as item_id, ari.name as item_name,
    coalesce((
      select json_agg(json_build_object('id', u.id, 'name', u.name) order by u.name)
      from activity_return_item_units ariu join units u on u.id = ariu.unit_id where ariu.item_id = ari.id
    ), '[]') as units,
    der.quantity, der.unit_id as saved_unit_id, der.unit_price
  from activity_returns ar
  join activity_return_items ari on ari.activity_return_id = ar.id and ari.status = 'active'
  join activity_return_item_countries aric on aric.item_id = ari.id and aric.country_id = $2
  left join tfo_demo_expected_returns der on der.demo_id = $1 and der.item_id = ari.id
  where ar.status = 'active'
  order by ar.name asc, ari.name asc
`;

tfoDemosRouter.get('/tfo-demos/:id/expected-return', requireAuth, async (req, res) => {
  const demoResult = await pool.query(
    `select td.village_id, td.status, co.id as country_id, co.currency_code
     from tfo_demos td
     join villages vi on vi.id = td.village_id join blocks b on b.id = vi.block_id
     join districts di on di.id = b.district_id join states s on s.id = di.state_id
     join countries co on co.id = s.country_id
     where td.id = $1`,
    [req.params.id],
  );
  if (demoResult.rowCount === 0) return res.status(404).json({ error: 'No such demo' });
  const demo = demoResult.rows[0];
  if (!(await requireCoverage(req, res, demo.village_id))) return;

  const rows = (await pool.query(SELECT_EXPECTED_RETURN_ITEMS, [req.params.id, demo.country_id])).rows;
  const activitiesById = new Map();
  for (const row of rows) {
    if (!activitiesById.has(row.activity_id)) {
      activitiesById.set(row.activity_id, { id: row.activity_id, name: row.activity_name, items: [] });
    }
    activitiesById.get(row.activity_id).items.push({
      id: row.item_id,
      name: row.item_name,
      units: row.units,
      savedReturn: row.quantity === null ? null : {
        quantity: row.quantity, unitId: row.saved_unit_id, unitPrice: row.unit_price,
      },
    });
  }

  res.json({
    currency: demo.currency_code,
    isOngoing: demo.status === 'ongoing',
    activities: [...activitiesById.values()].filter((a) => a.items.length > 0),
  });
});

tfoDemosRouter.post('/tfo-demos/:id/expected-return', requireAuth, async (req, res) => {
  const demoResult = await pool.query(
    `select td.village_id, td.status, co.id as country_id from tfo_demos td
     join villages vi on vi.id = td.village_id join blocks b on b.id = vi.block_id
     join districts di on di.id = b.district_id join states s on s.id = di.state_id
     join countries co on co.id = s.country_id
     where td.id = $1`,
    [req.params.id],
  );
  if (demoResult.rowCount === 0) return res.status(404).json({ error: 'No such demo' });
  const demo = demoResult.rows[0];
  if (!(await requireCoverage(req, res, demo.village_id))) return;
  if (demo.status !== 'ongoing') {
    return res.status(403).json({ error: 'This demo is not Ongoing and can\'t be edited. Ask a Super Admin to reopen it first.' });
  }

  const { itemId, quantity, unitId, unitPrice } = req.body;
  if (!itemId || !unitId) return res.status(400).json({ error: 'itemId and unitId are required' });
  const qty = Number(quantity);
  const price = Number(unitPrice ?? 0);
  if (quantity === undefined || quantity === '' || Number.isNaN(qty) || qty < 0) return res.status(400).json({ error: 'Expected Quantity must be a number that is 0 or more' });
  if (Number.isNaN(price) || price < 0) return res.status(400).json({ error: 'Expected Unit Price must be a number that is 0 or more' });

  const itemResult = await pool.query(
    `select ari.id, ari.activity_return_id, ar.status as activity_status,
       exists(select 1 from activity_return_item_countries aric where aric.item_id = ari.id and aric.country_id = $2) as in_country,
       exists(select 1 from activity_return_item_units ariu where ariu.item_id = ari.id and ariu.unit_id = $3) as valid_unit
     from activity_return_items ari join activity_returns ar on ar.id = ari.activity_return_id
     where ari.id = $1 and ari.status = 'active'`,
    [itemId, demo.country_id, unitId],
  );
  if (itemResult.rowCount === 0 || itemResult.rows[0].activity_status !== 'active' || !itemResult.rows[0].in_country) {
    return res.status(400).json({ error: 'This item is not configured for this demo\'s country' });
  }
  if (!itemResult.rows[0].valid_unit) {
    return res.status(400).json({ error: 'This unit is not configured for this item' });
  }

  const result = await pool.query(
    `insert into tfo_demo_expected_returns (demo_id, activity_return_id, item_id, quantity, unit_id, unit_price, updated_at)
     values ($1, $2, $3, $4, $5, $6, now())
     on conflict (demo_id, item_id) do update set
       quantity = excluded.quantity, unit_id = excluded.unit_id, unit_price = excluded.unit_price, updated_at = now()
     returning id`,
    [req.params.id, itemResult.rows[0].activity_return_id, itemId, qty, unitId, price],
  );
  res.status(200).json({ id: result.rows[0].id });
});

tfoDemosRouter.delete('/tfo-demos/:id/expected-return/:itemId', requireAuth, async (req, res) => {
  const demoResult = await pool.query('select village_id, status from tfo_demos where id = $1', [req.params.id]);
  if (demoResult.rowCount === 0) return res.status(404).json({ error: 'No such demo' });
  if (!(await requireCoverage(req, res, demoResult.rows[0].village_id))) return;
  if (demoResult.rows[0].status !== 'ongoing') {
    return res.status(403).json({ error: 'This demo is not Ongoing and can\'t be edited. Ask a Super Admin to reopen it first.' });
  }
  await pool.query('delete from tfo_demo_expected_returns where demo_id = $1 and item_id = $2', [req.params.id, req.params.itemId]);
  res.status(204).end();
});

// Shared demo lookup for the Actual Cost/Return endpoints below - same
// village_id (coverage) + status (ongoing-only edit lock) + country_id
// (item scoping) trio the Expected endpoints already fetch.
async function loadDemoForActuals(req, res) {
  const demoResult = await pool.query(
    `select td.village_id, td.status, co.id as country_id, co.currency_code
     from tfo_demos td
     join villages vi on vi.id = td.village_id join blocks b on b.id = vi.block_id
     join districts di on di.id = b.district_id join states s on s.id = di.state_id
     join countries co on co.id = s.country_id
     where td.id = $1`,
    [req.params.id],
  );
  if (demoResult.rowCount === 0) {
    res.status(404).json({ error: 'No such demo' });
    return null;
  }
  const demo = demoResult.rows[0];
  if (!(await requireCoverage(req, res, demo.village_id))) return null;
  return demo;
}

function requireOngoing(demo, res) {
  if (demo.status !== 'ongoing') {
    res.status(403).json({ error: 'This demo is not Ongoing and can\'t be edited. Ask a Super Admin to reopen it first.' });
    return false;
  }
  return true;
}

// Actual Cost - a transaction ledger, not a single value per item: every
// activity_date the farmer records is its own independent row (unlike
// Expected Cost's upsert-one-row-per-item). Item skeleton is the exact
// same Activity/Item/Unit configuration Expected Cost already uses - one
// query, every active item scoped to the demo's country, each carrying
// its full transaction list (not N+1 - json_agg per item, same pattern
// as Expected Cost's per-item unit list).
const SELECT_ACTUAL_COST_ITEMS = `
  select a.id as activity_id, a.name as activity_name,
    ai.id as item_id, ai.name as item_name,
    coalesce((
      select json_agg(json_build_object('id', u.id, 'name', u.name) order by u.name)
      from activity_item_units aiu join units u on u.id = aiu.unit_id where aiu.item_id = ai.id
    ), '[]') as units,
    coalesce((
      select json_agg(json_build_object(
        'id', tac.id, 'activityDate', tac.activity_date::text, 'quantity', tac.quantity,
        'unitId', tac.unit_id, 'unitName', tu.name, 'actualPrice', tac.actual_price
      ) order by tac.activity_date desc, tac.created_at desc)
      from tfo_demo_actual_costs tac join units tu on tu.id = tac.unit_id
      where tac.demo_id = $1 and tac.item_id = ai.id
    ), '[]') as transactions
  from activities a
  join activity_items ai on ai.activity_id = a.id and ai.status = 'active'
  join activity_item_countries aic on aic.item_id = ai.id and aic.country_id = $2
  where a.status = 'active'
  order by a.name asc, ai.name asc
`;

tfoDemosRouter.get('/tfo-demos/:id/actual-cost', requireAuth, async (req, res) => {
  const demo = await loadDemoForActuals(req, res);
  if (!demo) return;
  const rows = (await pool.query(SELECT_ACTUAL_COST_ITEMS, [req.params.id, demo.country_id])).rows;
  const activitiesById = new Map();
  for (const row of rows) {
    if (!activitiesById.has(row.activity_id)) {
      activitiesById.set(row.activity_id, { id: row.activity_id, name: row.activity_name, items: [] });
    }
    activitiesById.get(row.activity_id).items.push({ id: row.item_id, name: row.item_name, units: row.units, transactions: row.transactions });
  }
  res.json({
    currency: demo.currency_code,
    isOngoing: demo.status === 'ongoing',
    activities: [...activitiesById.values()].filter((a) => a.items.length > 0),
  });
});

async function validateActualCostItem(itemId, countryId, unitId) {
  const r = await pool.query(
    `select ai.id, ai.activity_id, a.status as activity_status,
       exists(select 1 from activity_item_countries aic where aic.item_id = ai.id and aic.country_id = $2) as in_country,
       exists(select 1 from activity_item_units aiu where aiu.item_id = ai.id and aiu.unit_id = $3) as valid_unit
     from activity_items ai join activities a on a.id = ai.activity_id
     where ai.id = $1 and ai.status = 'active'`,
    [itemId, countryId, unitId],
  );
  if (r.rowCount === 0 || r.rows[0].activity_status !== 'active' || !r.rows[0].in_country) return { error: 'This item is not configured for this demo\'s country' };
  if (!r.rows[0].valid_unit) return { error: 'This unit is not configured for this item' };
  return { activityId: r.rows[0].activity_id };
}

function validateTransactionFields({ itemId, activityDate, quantity, unitId, price }) {
  if (!itemId || !unitId) return 'itemId and unitId are required';
  if (!activityDate) return 'Activity Date is required';
  const qty = Number(quantity);
  if (quantity === undefined || quantity === '' || Number.isNaN(qty) || qty < 0) return 'Quantity must be a number that is 0 or more';
  const p = Number(price);
  if (Number.isNaN(p) || p < 0) return 'Price must be a number that is 0 or more';
  return null;
}

// Always inserts a new row - re-recording the same item on a different
// (or even the same) date is a separate transaction, never an upsert.
tfoDemosRouter.post('/tfo-demos/:id/actual-cost', requireAuth, async (req, res) => {
  const demo = await loadDemoForActuals(req, res);
  if (!demo) return;
  if (!requireOngoing(demo, res)) return;

  const { itemId, activityDate, quantity, unitId, actualPrice } = req.body;
  const validationError = validateTransactionFields({ itemId, activityDate, quantity, unitId, price: actualPrice });
  if (validationError) return res.status(400).json({ error: validationError });

  const itemCheck = await validateActualCostItem(itemId, demo.country_id, unitId);
  if (itemCheck.error) return res.status(400).json({ error: itemCheck.error });

  const result = await pool.query(
    `insert into tfo_demo_actual_costs (demo_id, activity_id, item_id, activity_date, quantity, unit_id, actual_price)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [req.params.id, itemCheck.activityId, itemId, activityDate, Number(quantity), unitId, Number(actualPrice ?? 0)],
  );
  res.status(201).json({ id: result.rows[0].id });
});

// Edits exactly the one transaction named by :transactionId - never
// touches any other row for the same item, matching the "edit only that
// transaction" requirement.
tfoDemosRouter.patch('/tfo-demos/:id/actual-cost/:transactionId', requireAuth, async (req, res) => {
  const demo = await loadDemoForActuals(req, res);
  if (!demo) return;
  if (!requireOngoing(demo, res)) return;

  const existing = await pool.query('select item_id from tfo_demo_actual_costs where id = $1 and demo_id = $2', [req.params.transactionId, req.params.id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such transaction' });

  const { activityDate, quantity, unitId, actualPrice } = req.body;
  const validationError = validateTransactionFields({ itemId: existing.rows[0].item_id, activityDate, quantity, unitId, price: actualPrice });
  if (validationError) return res.status(400).json({ error: validationError });

  const itemCheck = await validateActualCostItem(existing.rows[0].item_id, demo.country_id, unitId);
  if (itemCheck.error) return res.status(400).json({ error: itemCheck.error });

  await pool.query(
    `update tfo_demo_actual_costs set activity_date = $1, quantity = $2, unit_id = $3, actual_price = $4, updated_at = now() where id = $5`,
    [activityDate, Number(quantity), unitId, Number(actualPrice ?? 0), req.params.transactionId],
  );
  res.json({ ok: true });
});

tfoDemosRouter.delete('/tfo-demos/:id/actual-cost/:transactionId', requireAuth, async (req, res) => {
  const demo = await loadDemoForActuals(req, res);
  if (!demo) return;
  if (!requireOngoing(demo, res)) return;
  await pool.query('delete from tfo_demo_actual_costs where id = $1 and demo_id = $2', [req.params.transactionId, req.params.id]);
  res.status(204).end();
});

// Actual Return - mirrors Actual Cost exactly, sourced from the separate
// activity_returns/activity_return_items tables (same relationship
// Expected Return already has to Expected Cost).
const SELECT_ACTUAL_RETURN_ITEMS = `
  select ar.id as activity_id, ar.name as activity_name,
    ari.id as item_id, ari.name as item_name,
    coalesce((
      select json_agg(json_build_object('id', u.id, 'name', u.name) order by u.name)
      from activity_return_item_units ariu join units u on u.id = ariu.unit_id where ariu.item_id = ari.id
    ), '[]') as units,
    coalesce((
      select json_agg(json_build_object(
        'id', tar.id, 'activityDate', tar.activity_date::text, 'quantity', tar.quantity,
        'unitId', tar.unit_id, 'unitName', tu.name, 'unitPrice', tar.unit_price
      ) order by tar.activity_date desc, tar.created_at desc)
      from tfo_demo_actual_returns tar join units tu on tu.id = tar.unit_id
      where tar.demo_id = $1 and tar.item_id = ari.id
    ), '[]') as transactions
  from activity_returns ar
  join activity_return_items ari on ari.activity_return_id = ar.id and ari.status = 'active'
  join activity_return_item_countries aric on aric.item_id = ari.id and aric.country_id = $2
  where ar.status = 'active'
  order by ar.name asc, ari.name asc
`;

tfoDemosRouter.get('/tfo-demos/:id/actual-return', requireAuth, async (req, res) => {
  const demo = await loadDemoForActuals(req, res);
  if (!demo) return;
  const rows = (await pool.query(SELECT_ACTUAL_RETURN_ITEMS, [req.params.id, demo.country_id])).rows;
  const activitiesById = new Map();
  for (const row of rows) {
    if (!activitiesById.has(row.activity_id)) {
      activitiesById.set(row.activity_id, { id: row.activity_id, name: row.activity_name, items: [] });
    }
    activitiesById.get(row.activity_id).items.push({ id: row.item_id, name: row.item_name, units: row.units, transactions: row.transactions });
  }
  res.json({
    currency: demo.currency_code,
    isOngoing: demo.status === 'ongoing',
    activities: [...activitiesById.values()].filter((a) => a.items.length > 0),
  });
});

async function validateActualReturnItem(itemId, countryId, unitId) {
  const r = await pool.query(
    `select ari.id, ari.activity_return_id, ar.status as activity_status,
       exists(select 1 from activity_return_item_countries aric where aric.item_id = ari.id and aric.country_id = $2) as in_country,
       exists(select 1 from activity_return_item_units ariu where ariu.item_id = ari.id and ariu.unit_id = $3) as valid_unit
     from activity_return_items ari join activity_returns ar on ar.id = ari.activity_return_id
     where ari.id = $1 and ari.status = 'active'`,
    [itemId, countryId, unitId],
  );
  if (r.rowCount === 0 || r.rows[0].activity_status !== 'active' || !r.rows[0].in_country) return { error: 'This item is not configured for this demo\'s country' };
  if (!r.rows[0].valid_unit) return { error: 'This unit is not configured for this item' };
  return { activityReturnId: r.rows[0].activity_return_id };
}

tfoDemosRouter.post('/tfo-demos/:id/actual-return', requireAuth, async (req, res) => {
  const demo = await loadDemoForActuals(req, res);
  if (!demo) return;
  if (!requireOngoing(demo, res)) return;

  const { itemId, activityDate, quantity, unitId, unitPrice } = req.body;
  const validationError = validateTransactionFields({ itemId, activityDate, quantity, unitId, price: unitPrice });
  if (validationError) return res.status(400).json({ error: validationError });

  const itemCheck = await validateActualReturnItem(itemId, demo.country_id, unitId);
  if (itemCheck.error) return res.status(400).json({ error: itemCheck.error });

  const result = await pool.query(
    `insert into tfo_demo_actual_returns (demo_id, activity_return_id, item_id, activity_date, quantity, unit_id, unit_price)
     values ($1, $2, $3, $4, $5, $6, $7) returning id`,
    [req.params.id, itemCheck.activityReturnId, itemId, activityDate, Number(quantity), unitId, Number(unitPrice ?? 0)],
  );
  res.status(201).json({ id: result.rows[0].id });
});

tfoDemosRouter.patch('/tfo-demos/:id/actual-return/:transactionId', requireAuth, async (req, res) => {
  const demo = await loadDemoForActuals(req, res);
  if (!demo) return;
  if (!requireOngoing(demo, res)) return;

  const existing = await pool.query('select item_id from tfo_demo_actual_returns where id = $1 and demo_id = $2', [req.params.transactionId, req.params.id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such transaction' });

  const { activityDate, quantity, unitId, unitPrice } = req.body;
  const validationError = validateTransactionFields({ itemId: existing.rows[0].item_id, activityDate, quantity, unitId, price: unitPrice });
  if (validationError) return res.status(400).json({ error: validationError });

  const itemCheck = await validateActualReturnItem(existing.rows[0].item_id, demo.country_id, unitId);
  if (itemCheck.error) return res.status(400).json({ error: itemCheck.error });

  await pool.query(
    `update tfo_demo_actual_returns set activity_date = $1, quantity = $2, unit_id = $3, unit_price = $4, updated_at = now() where id = $5`,
    [activityDate, Number(quantity), unitId, Number(unitPrice ?? 0), req.params.transactionId],
  );
  res.json({ ok: true });
});

tfoDemosRouter.delete('/tfo-demos/:id/actual-return/:transactionId', requireAuth, async (req, res) => {
  const demo = await loadDemoForActuals(req, res);
  if (!demo) return;
  if (!requireOngoing(demo, res)) return;
  await pool.query('delete from tfo_demo_actual_returns where id = $1 and demo_id = $2', [req.params.transactionId, req.params.id]);
  res.status(204).end();
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
