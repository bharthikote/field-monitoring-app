import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';

// Country Settings - Super Admin only. Extends the existing countries
// table (created back in migration 005 for the plain Location Hierarchy)
// with currency/phone/unit/season/terminology configuration, rather than
// building a second country master. The bare-bones name-only Country
// CRUD in locations.js (used by the Location Hierarchy tree's inline
// "+ Add Country") is untouched - this is a separate, richer surface for
// the same underlying rows.
export const countriesRouter = Router();
countriesRouter.param('id', validateUuidParam);

const UNIT_CATEGORIES = ['area', 'weight', 'liquid', 'time', 'distance'];

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

function locationTerminologySummary(c) {
  return [c.state_label, c.district_label, c.block_label, c.village_label].join(', ');
}

// Seasons moved out of the generic SIMPLE_LISTS mechanism (simpleMasterLists.js)
// once they became country-owned rows with start/end months - editing them
// through the old flat "just a name" Master Lists page no longer made sense
// once Country Settings became the real place to manage them. This is the
// mobile-facing read: a demo's own country's seasons, plus the legacy
// global rows (country_id is null - the pre-country-settings defaults) as
// a fallback for any country that hasn't had its seasons configured yet.
countriesRouter.get('/master/seasons', requireAuth, async (req, res) => {
  const { countryId } = req.query;
  if (!countryId) {
    const result = await pool.query('select id, name, start_month, end_month from seasons order by name');
    return res.json({ items: result.rows });
  }
  // A legacy global row is only offered if the country hasn't already
  // configured its own season of that same name - otherwise a configured
  // country would show two confusingly-identical-looking "Summer" entries.
  const result = await pool.query(
    `select distinct on (name) id, name, start_month, end_month from seasons
     where country_id = $1 or country_id is null
     order by name, country_id is null`,
    [countryId],
  );
  res.json({ items: result.rows.sort((a, b) => a.name.localeCompare(b.name)) });
});

countriesRouter.get('/countries', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { q } = req.query;
  const params = [];
  let where = '';
  if (q && q.trim()) {
    params.push(`%${q.trim()}%`);
    where = `where name ilike $${params.length}`;
  }
  const result = await pool.query(
    `select id, name, iso_code, phone_code, currency_name, currency_code, phone_code as telephone_code,
            state_label, district_label, block_label, village_label, status
     from countries ${where} order by name`,
    params,
  );
  res.json({
    countries: result.rows.map((c) => ({ ...c, location_terminology: locationTerminologySummary(c) })),
  });
});

async function loadCountryDetail(id) {
  const countryResult = await pool.query('select * from countries where id = $1', [id]);
  if (countryResult.rowCount === 0) return null;
  const country = countryResult.rows[0];

  const unitsResult = await pool.query(
    `select u.id, u.name, u.category from country_units cu
     join units u on u.id = cu.unit_id where cu.country_id = $1 order by u.name`,
    [id],
  );
  const units = { area: [], weight: [], liquid: [], time: [], distance: [] };
  for (const u of unitsResult.rows) {
    if (units[u.category]) units[u.category].push({ id: u.id, name: u.name });
  }

  const seasonsResult = await pool.query(
    'select id, name, start_month, end_month from seasons where country_id = $1 order by name',
    [id],
  );

  // states/projects both have a real FK to countries (no cascade), so
  // either one existing is what actually blocks a hard DELETE below. users
  // has no direct country column any more (migration 009 moved user-to-
  // location assignment to the many-to-many user_locations table), so
  // this counts users explicitly assigned at the country level as a
  // purely informational number - not a delete-blocking constraint.
  const usage = await pool.query(
    `select
       (select count(*) from states where country_id = $1) as states_count,
       (select count(*) from projects where country_id = $1) as projects_count,
       (select count(distinct user_id) from user_locations where level = 'country' and location_id = $1) as users_count`,
    [id],
  );

  return {
    country: { ...country, location_terminology: locationTerminologySummary(country) },
    units,
    seasons: seasonsResult.rows,
    usage: usage.rows[0],
  };
}

countriesRouter.get('/countries/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const detail = await loadCountryDetail(req.params.id);
  if (!detail) return res.status(404).json({ error: 'No such country' });
  res.json(detail);
});

// ISO 3166-1 alpha-2/alpha-3, a leading-'+' international calling code,
// and a standard 3-letter ISO 4217 currency code - checked here for a
// clear error message rather than leaving it to silently-wrong free text.
function validateCountryFields(body) {
  const { name, isoCode, phoneCode, currencyName, currencyCode, stateLabel, districtLabel, blockLabel, villageLabel, units, seasons } = body;
  if (!name || !name.trim()) return 'Country Name is required';
  if (!isoCode || !/^[A-Za-z]{2,3}$/.test(isoCode.trim())) return 'ISO Country Code must be 2-3 letters (e.g. IN, GH)';
  if (!phoneCode || !/^\+\d{1,4}$/.test(phoneCode.trim())) return 'Telephone Calling Code must look like +91';
  if (!currencyName || !currencyName.trim()) return 'Lead Currency / Currency Name is required';
  if (!currencyCode || !/^[A-Za-z]{3}$/.test(currencyCode.trim())) return 'Currency Code must be 3 letters (e.g. INR)';
  if (!stateLabel || !stateLabel.trim()) return 'State Local Name is required';
  if (!districtLabel || !districtLabel.trim()) return 'District Local Name is required';
  if (!blockLabel || !blockLabel.trim()) return 'Block Local Name is required';
  if (!villageLabel || !villageLabel.trim()) return 'Village Local Name is required';

  if (units) {
    for (const category of Object.keys(units)) {
      if (!UNIT_CATEGORIES.includes(category)) return `Unknown unit category: ${category}`;
      if (!Array.isArray(units[category])) return `${category} units must be a list`;
    }
  }
  if (seasons) {
    if (!Array.isArray(seasons)) return 'seasons must be a list';
    const seenNames = new Set();
    for (let i = 0; i < seasons.length; i++) {
      const s = seasons[i];
      if (!s.name || !s.name.trim()) return `Season ${i + 1}: name is required`;
      const key = s.name.trim().toLowerCase();
      if (seenNames.has(key)) return `Season "${s.name.trim()}" is listed more than once`;
      seenNames.add(key);
      const start = Number(s.startMonth);
      const end = Number(s.endMonth);
      if (!Number.isInteger(start) || start < 1 || start > 12) return `Season "${s.name.trim()}": Start Month is required`;
      if (!Number.isInteger(end) || end < 1 || end > 12) return `Season "${s.name.trim()}": End Month is required`;
    }
  }
  return null;
}

async function replaceUnitsAndSeasons(client, countryId, units, seasons) {
  if (units) {
    await client.query('delete from country_units where country_id = $1', [countryId]);
    const unitIds = UNIT_CATEGORIES.flatMap((category) => units[category] || []);
    for (const unitId of unitIds) {
      await client.query('insert into country_units (country_id, unit_id) values ($1, $2)', [countryId, unitId]);
    }
  }
  if (seasons) {
    await client.query('delete from seasons where country_id = $1', [countryId]);
    for (const s of seasons) {
      await client.query(
        'insert into seasons (name, country_id, start_month, end_month) values ($1, $2, $3, $4)',
        [s.name.trim(), countryId, Number(s.startMonth), Number(s.endMonth)],
      );
    }
  }
}

countriesRouter.post('/countries', requireAdmin, requireSuperAdmin, async (req, res) => {
  const validationError = validateCountryFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const {
    name, isoCode, phoneCode, currencyName, currencyCode,
    stateLabel, districtLabel, blockLabel, villageLabel, units, seasons,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await client.query(
      `insert into countries (name, iso_code, phone_code, currency_name, currency_code, state_label, district_label, block_label, village_label)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning id`,
      [
        name.trim(), isoCode.trim().toUpperCase(), phoneCode.trim(), currencyName.trim(), currencyCode.trim().toUpperCase(),
        stateLabel.trim(), districtLabel.trim(), blockLabel.trim(), villageLabel.trim(),
      ],
    );
    const countryId = result.rows[0].id;
    await replaceUnitsAndSeasons(client, countryId, units, seasons);
    await client.query('commit');
    res.status(201).json(await loadCountryDetail(countryId));
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23505') return res.status(409).json({ error: 'A country with that name already exists' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

countriesRouter.patch('/countries/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  const existing = await pool.query('select id from countries where id = $1', [req.params.id]);
  if (existing.rowCount === 0) return res.status(404).json({ error: 'No such country' });

  const validationError = validateCountryFields(req.body);
  if (validationError) return res.status(400).json({ error: validationError });
  const {
    name, isoCode, phoneCode, currencyName, currencyCode,
    stateLabel, districtLabel, blockLabel, villageLabel, units, seasons,
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `update countries set name = $1, iso_code = $2, phone_code = $3, currency_name = $4, currency_code = $5,
         state_label = $6, district_label = $7, block_label = $8, village_label = $9
       where id = $10`,
      [
        name.trim(), isoCode.trim().toUpperCase(), phoneCode.trim(), currencyName.trim(), currencyCode.trim().toUpperCase(),
        stateLabel.trim(), districtLabel.trim(), blockLabel.trim(), villageLabel.trim(), req.params.id,
      ],
    );
    await replaceUnitsAndSeasons(client, req.params.id, units, seasons);
    await client.query('commit');
    res.json(await loadCountryDetail(req.params.id));
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23505') return res.status(409).json({ error: 'A country with that name already exists' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Deactivate/reactivate - the "existing Active/Inactive mechanism" per the
// spec, for hiding a country from pickers without losing its historical
// data (a country already in use by states/projects/users can't be hard-
// deleted, since that would orphan real records - see DELETE below).
countriesRouter.post('/countries/:id/status', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { status } = req.body;
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ error: "status must be 'active' or 'inactive'" });
  const result = await pool.query('update countries set status = $1 where id = $2 returning id', [status, req.params.id]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'No such country' });
  res.json(await loadCountryDetail(req.params.id));
});

// Historical cost/return/transaction amounts already saved are never
// touched by editing or deactivating a country - only future configuration
// (currency/unit choices going forward) is affected, per the spec's data-
// integrity requirement. Hard delete is only possible when nothing
// references the country yet (states/projects/users - anything else, e.g.
// activity_item_countries, is a soft "eligible in" link that cascades
// harmlessly on delete).
countriesRouter.delete('/countries/:id', requireAdmin, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query('delete from countries where id = $1', [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'No such country' });
    res.status(204).end();
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'This country is already in use (states, projects, or users reference it) and cannot be deleted - deactivate it instead',
      });
    }
    res.status(500).json({ error: err.message });
  }
});
