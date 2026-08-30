import { Router } from 'express';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { pool } from '../db/pool.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { validateUuidParam } from '../middleware/validateUuidParam.js';
import {
  countryIdForState,
  countryIdForDistrict,
  countryIdForBlock,
  countryIdForVillage,
} from '../db/locationHelpers.js';

export const locationsRouter = Router();
locationsRouter.param('id', validateUuidParam);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// multer's own errors (e.g. file too large) call next(err) rather than
// responding - wrap it so a bad upload still gets a JSON error instead of
// falling through to Express's default HTML error page.
function handleFileUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File is too large (max 5MB)' });
    res.status(400).json({ error: err.message });
  });
}

// --- Read endpoints: any logged-in, approved user can browse the hierarchy
// (every field role needs this to pick a Village, not just Admin/Super Admin) ---

locationsRouter.get('/locations/countries', requireAuth, async (_req, res) => {
  const result = await pool.query('select id, name from countries order by name');
  res.json({ countries: result.rows });
});

locationsRouter.get('/locations/states', requireAuth, async (req, res) => {
  const { country_id } = req.query;
  if (!country_id) return res.status(400).json({ error: 'country_id is required' });
  const result = await pool.query('select id, name from states where country_id = $1 order by name', [country_id]);
  res.json({ states: result.rows });
});

locationsRouter.get('/locations/districts', requireAuth, async (req, res) => {
  const { state_id } = req.query;
  if (!state_id) return res.status(400).json({ error: 'state_id is required' });
  const result = await pool.query('select id, name from districts where state_id = $1 order by name', [state_id]);
  res.json({ districts: result.rows });
});

locationsRouter.get('/locations/blocks', requireAuth, async (req, res) => {
  const { district_id } = req.query;
  if (!district_id) return res.status(400).json({ error: 'district_id is required' });
  const result = await pool.query('select id, name from blocks where district_id = $1 order by name', [district_id]);
  res.json({ blocks: result.rows });
});

locationsRouter.get('/locations/villages', requireAuth, async (req, res) => {
  const { block_id } = req.query;
  if (!block_id) return res.status(400).json({ error: 'block_id is required' });
  const result = await pool.query('select id, name from villages where block_id = $1 order by name', [block_id]);
  res.json({ villages: result.rows });
});

// Search villages by name directly, anywhere in the hierarchy - lets most
// roles skip the five-level Country > State > District > Block > Village
// cascade and just search-and-pick a village, with the full path returned
// alongside so the picker can show it back as a confirmation. Not scoped to
// the user's own coverage: demo plot creation itself isn't village-scoped
// either (PRD Section 5 - any authorized role can create a plot anywhere).
locationsRouter.get('/locations/villages/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ villages: [] });
  const result = await pool.query(
    `select v.id, v.name, b.name as block_name, d.name as district_name, s.name as state_name, c.name as country_name
     from villages v
     join blocks b on b.id = v.block_id
     join districts d on d.id = b.district_id
     join states s on s.id = d.state_id
     join countries c on c.id = s.country_id
     where v.name ilike $1
     order by v.name
     limit 50`,
    [`%${q.trim()}%`],
  );
  res.json({ villages: result.rows });
});

// Search villages, blocks, AND districts by name in one go - used for
// Institution/Agro Dealer profiles, where the actual place (a KVK,
// government office, dealer shop) is often a block or district
// headquarters rather than a village. State/country are deliberately
// excluded - too broad to be "a place" someone visits.
locationsRouter.get('/locations/search', requireAuth, async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) return res.json({ locations: [] });
  const like = `%${q.trim()}%`;
  const [villages, blocks, districts] = await Promise.all([
    pool.query(
      `select v.id, v.name, 'village' as level,
         b.name as block_name, d.name as district_name, s.name as state_name, c.name as country_name
       from villages v
       join blocks b on b.id = v.block_id
       join districts d on d.id = b.district_id
       join states s on s.id = d.state_id
       join countries c on c.id = s.country_id
       where v.name ilike $1 order by v.name limit 20`,
      [like],
    ),
    pool.query(
      `select b.id, b.name, 'block' as level,
         null as block_name, d.name as district_name, s.name as state_name, c.name as country_name
       from blocks b
       join districts d on d.id = b.district_id
       join states s on s.id = d.state_id
       join countries c on c.id = s.country_id
       where b.name ilike $1 order by b.name limit 20`,
      [like],
    ),
    pool.query(
      `select d.id, d.name, 'district' as level,
         null as block_name, null as district_name, s.name as state_name, c.name as country_name
       from districts d
       join states s on s.id = d.state_id
       join countries c on c.id = s.country_id
       where d.name ilike $1 order by d.name limit 20`,
      [like],
    ),
  ]);
  const locations = [...villages.rows, ...blocks.rows, ...districts.rows].slice(0, 50);
  res.json({ locations });
});

// --- Authorization helpers ---

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

function requireOwnCountry(actualCountryId, req, res) {
  if (req.user.role === 'super_admin') return true;
  if (!req.user.countryIds.includes(actualCountryId)) {
    res.status(403).json({ error: "You can only manage locations within your own assigned country" });
    return false;
  }
  return true;
}

// --- Create ---

locationsRouter.post('/locations/countries', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query('insert into countries (name) values ($1) returning id, name', [name]);
    res.status(201).json({ country: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That country already exists' });
    res.status(500).json({ error: err.message });
  }
});

locationsRouter.post('/locations/states', requireAdmin, requireSuperAdmin, async (req, res) => {
  const { country_id, name } = req.body;
  if (!country_id || !name) return res.status(400).json({ error: 'country_id and name are required' });
  try {
    const result = await pool.query(
      'insert into states (country_id, name) values ($1, $2) returning id, name',
      [country_id, name],
    );
    res.status(201).json({ state: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That state already exists in this country' });
    res.status(500).json({ error: err.message });
  }
});

locationsRouter.post('/locations/districts', requireAdmin, async (req, res) => {
  const { state_id, name } = req.body;
  if (!state_id || !name) return res.status(400).json({ error: 'state_id and name are required' });

  const countryId = await countryIdForState(state_id);
  if (!countryId) return res.status(404).json({ error: 'No such state' });
  if (!requireOwnCountry(countryId, req, res)) return;

  try {
    const result = await pool.query(
      'insert into districts (state_id, name) values ($1, $2) returning id, name',
      [state_id, name],
    );
    res.status(201).json({ district: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That district already exists in this state' });
    res.status(500).json({ error: err.message });
  }
});

locationsRouter.post('/locations/blocks', requireAdmin, async (req, res) => {
  const { district_id, name } = req.body;
  if (!district_id || !name) return res.status(400).json({ error: 'district_id and name are required' });

  const countryId = await countryIdForDistrict(district_id);
  if (!countryId) return res.status(404).json({ error: 'No such district' });
  if (!requireOwnCountry(countryId, req, res)) return;

  try {
    const result = await pool.query(
      'insert into blocks (district_id, name) values ($1, $2) returning id, name',
      [district_id, name],
    );
    res.status(201).json({ block: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That block already exists in this district' });
    res.status(500).json({ error: err.message });
  }
});

locationsRouter.post('/locations/villages', requireAdmin, async (req, res) => {
  const { block_id, name } = req.body;
  if (!block_id || !name) return res.status(400).json({ error: 'block_id and name are required' });

  const countryId = await countryIdForBlock(block_id);
  if (!countryId) return res.status(404).json({ error: 'No such block' });
  if (!requireOwnCountry(countryId, req, res)) return;

  try {
    const result = await pool.query(
      'insert into villages (block_id, name) values ($1, $2) returning id, name',
      [block_id, name],
    );
    res.status(201).json({ village: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'That village already exists in this block' });
    res.status(500).json({ error: err.message });
  }
});

// --- Rename ---

const RENAME_TABLES = {
  countries: { table: 'countries', singular: 'country', superAdminOnly: true, resolveCountry: async (id) => id },
  states: { table: 'states', singular: 'state', superAdminOnly: true, resolveCountry: countryIdForState },
  districts: { table: 'districts', singular: 'district', superAdminOnly: false, resolveCountry: countryIdForDistrict },
  blocks: { table: 'blocks', singular: 'block', superAdminOnly: false, resolveCountry: countryIdForBlock },
  villages: { table: 'villages', singular: 'village', superAdminOnly: false, resolveCountry: countryIdForVillage },
};

for (const [path, config] of Object.entries(RENAME_TABLES)) {
  locationsRouter.patch(`/locations/${path}/:id`, requireAdmin, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    if (config.superAdminOnly && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admin can do this' });
    }

    const countryId = await config.resolveCountry(req.params.id);
    if (!countryId) return res.status(404).json({ error: 'No such location' });
    if (!requireOwnCountry(countryId, req, res)) return;

    try {
      const result = await pool.query(
        `update ${config.table} set name = $2 where id = $1 returning id, name`,
        [req.params.id, name],
      );
      if (result.rowCount === 0) return res.status(404).json({ error: 'No such location' });
      res.json({ [config.singular]: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'That name already exists at this level' });
      res.status(500).json({ error: err.message });
    }
  });

  locationsRouter.delete(`/locations/${path}/:id`, requireAdmin, async (req, res) => {
    if (config.superAdminOnly && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admin can do this' });
    }

    const countryId = await config.resolveCountry(req.params.id);
    if (!countryId) return res.status(404).json({ error: 'No such location' });
    if (!requireOwnCountry(countryId, req, res)) return;

    try {
      const result = await pool.query(`delete from ${config.table} where id = $1`, [req.params.id]);
      if (result.rowCount === 0) return res.status(404).json({ error: 'No such location' });
      res.status(204).end();
    } catch (err) {
      if (err.code === '23503') {
        return res.status(409).json({ error: 'Delete everything under this location first (or unassign users from it)' });
      }
      res.status(500).json({ error: err.message });
    }
  });
}

// --- Bulk upload (District/Block/Village), Super Admin only per PRD Section 7 ---

const BULK_TEMPLATE_HEADERS = ['Country', 'State', 'District', 'Block', 'Village'];
const BULK_MAX_ROWS = 5000;

locationsRouter.get('/locations/villages/bulk-template', requireAdmin, requireSuperAdmin, async (_req, res) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Villages');
  sheet.columns = BULK_TEMPLATE_HEADERS.map((header) => ({ header, key: header, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRow(['India', 'Karnataka', 'Mysuru', 'Example Block', 'Example Village']);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="village-upload-template.xlsx"');
  await workbook.xlsx.write(res);
  res.end();
});

// One row = one Village at its full Country > State > District > Block path.
// Country and State must already exist (managed manually, per PRD - bulk
// upload only applies to District/Block/Village); District and Block are
// created along the way if they don't exist yet at that path. Only an exact
// duplicate Village is skipped - everything else either succeeds or is
// skipped with a reason, never rejecting the whole file.
locationsRouter.post(
  '/locations/villages/bulk-upload',
  requireAdmin,
  requireSuperAdmin,
  handleFileUpload,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(req.file.buffer);
    } catch {
      return res.status(400).json({ error: 'Could not read that file - make sure it is a valid .xlsx file' });
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) return res.status(400).json({ error: 'The uploaded file has no sheets' });
    if (sheet.rowCount - 1 > BULK_MAX_ROWS) {
      return res.status(400).json({ error: `Too many rows - please split into files of ${BULK_MAX_ROWS} or fewer` });
    }

    const results = [];
    let created = 0;
    let skipped = 0;

    const cell = (row, col) => String(row.getCell(col).value ?? '').trim();

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const countryName = cell(row, 1);
      const stateName = cell(row, 2);
      const districtName = cell(row, 3);
      const blockName = cell(row, 4);
      const villageName = cell(row, 5);

      if (!countryName && !stateName && !districtName && !blockName && !villageName) continue;

      if (!countryName || !stateName || !districtName || !blockName || !villageName) {
        results.push({ row: rowNumber, status: 'skipped', reason: 'Country, State, District, Block, and Village are all required' });
        skipped++;
        continue;
      }

      try {
        const countryResult = await pool.query('select id from countries where lower(name) = lower($1)', [countryName]);
        if (countryResult.rowCount === 0) {
          results.push({ row: rowNumber, status: 'skipped', reason: `Country "${countryName}" does not exist` });
          skipped++;
          continue;
        }
        const countryId = countryResult.rows[0].id;

        const stateResult = await pool.query(
          'select id from states where country_id = $1 and lower(name) = lower($2)',
          [countryId, stateName],
        );
        if (stateResult.rowCount === 0) {
          results.push({ row: rowNumber, status: 'skipped', reason: `State "${stateName}" does not exist under "${countryName}"` });
          skipped++;
          continue;
        }
        const stateId = stateResult.rows[0].id;

        let districtResult = await pool.query(
          'select id from districts where state_id = $1 and lower(name) = lower($2)',
          [stateId, districtName],
        );
        const districtId = districtResult.rowCount > 0
          ? districtResult.rows[0].id
          : (await pool.query('insert into districts (state_id, name) values ($1, $2) returning id', [stateId, districtName])).rows[0].id;

        let blockResult = await pool.query(
          'select id from blocks where district_id = $1 and lower(name) = lower($2)',
          [districtId, blockName],
        );
        const blockId = blockResult.rowCount > 0
          ? blockResult.rows[0].id
          : (await pool.query('insert into blocks (district_id, name) values ($1, $2) returning id', [districtId, blockName])).rows[0].id;

        const villageResult = await pool.query(
          'select id from villages where block_id = $1 and lower(name) = lower($2)',
          [blockId, villageName],
        );
        if (villageResult.rowCount > 0) {
          results.push({ row: rowNumber, status: 'skipped', reason: 'Village already exists at this location' });
          skipped++;
          continue;
        }

        await pool.query('insert into villages (block_id, name) values ($1, $2)', [blockId, villageName]);
        results.push({ row: rowNumber, status: 'created', reason: null });
        created++;
      } catch (err) {
        results.push({ row: rowNumber, status: 'skipped', reason: err.message });
        skipped++;
      }
    }

    res.json({ created, skipped, results });
  },
);
