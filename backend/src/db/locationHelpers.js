import { pool } from './pool.js';

export async function countryIdForState(stateId) {
  const r = await pool.query('select country_id from states where id = $1', [stateId]);
  return r.rows[0]?.country_id ?? null;
}

export async function countryIdForDistrict(districtId) {
  const r = await pool.query(
    `select s.country_id from districts d join states s on s.id = d.state_id where d.id = $1`,
    [districtId],
  );
  return r.rows[0]?.country_id ?? null;
}

export async function countryIdForBlock(blockId) {
  const r = await pool.query(
    `select s.country_id from blocks b
     join districts d on d.id = b.district_id
     join states s on s.id = d.state_id
     where b.id = $1`,
    [blockId],
  );
  return r.rows[0]?.country_id ?? null;
}

export async function countryIdForVillage(villageId) {
  const r = await pool.query(
    `select s.country_id from villages v
     join blocks b on b.id = v.block_id
     join districts d on d.id = b.district_id
     join states s on s.id = d.state_id
     where v.id = $1`,
    [villageId],
  );
  return r.rows[0]?.country_id ?? null;
}

// Resolves the country a location node (at any level) belongs to.
// For level = 'country', the id itself is already the country id.
export async function resolveCountryId(level, id) {
  if (level === 'country') {
    const r = await pool.query('select id from countries where id = $1', [id]);
    return r.rows[0]?.id ?? null;
  }
  if (level === 'state') return countryIdForState(id);
  if (level === 'district') return countryIdForDistrict(id);
  if (level === 'block') return countryIdForBlock(id);
  return countryIdForVillage(id);
}

// Resolves the full display path (Country -> ... -> whatever level) for a
// location node at any level. Returns null if the id doesn't exist.
export async function resolveLocationPath(level, id) {
  const queries = {
    country: `select name as country_name, null::text as state_name, null::text as district_name,
                 null::text as block_name, null::text as village_name
               from countries where id = $1`,
    state: `select c.name as country_name, s.name as state_name, null::text as district_name,
              null::text as block_name, null::text as village_name
            from states s join countries c on c.id = s.country_id where s.id = $1`,
    district: `select c.name as country_name, s.name as state_name, d.name as district_name,
                 null::text as block_name, null::text as village_name
               from districts d
               join states s on s.id = d.state_id
               join countries c on c.id = s.country_id
               where d.id = $1`,
    block: `select c.name as country_name, s.name as state_name, d.name as district_name,
              b.name as block_name, null::text as village_name
            from blocks b
            join districts d on d.id = b.district_id
            join states s on s.id = d.state_id
            join countries c on c.id = s.country_id
            where b.id = $1`,
    village: `select c.name as country_name, s.name as state_name, d.name as district_name,
                b.name as block_name, v.name as village_name
              from villages v
              join blocks b on b.id = v.block_id
              join districts d on d.id = b.district_id
              join states s on s.id = d.state_id
              join countries c on c.id = s.country_id
              where v.id = $1`,
  };
  const r = await pool.query(queries[level], [id]);
  return r.rows[0] ?? null;
}

// All village ids that fall under a location node at any level (a village
// resolves to just itself).
export async function resolveVillageIds(level, id) {
  const queries = {
    village: `select id from villages where id = $1`,
    block: `select id from villages where block_id = $1`,
    district: `select v.id from villages v join blocks b on b.id = v.block_id where b.district_id = $1`,
    state: `select v.id from villages v
              join blocks b on b.id = v.block_id
              join districts d on d.id = b.district_id
              where d.state_id = $1`,
    country: `select v.id from villages v
                join blocks b on b.id = v.block_id
                join districts d on d.id = b.district_id
                join states s on s.id = d.state_id
                where s.country_id = $1`,
  };
  const r = await pool.query(queries[level], [id]);
  return r.rows.map((row) => row.id);
}

// A user's effective village coverage: union of everything under every
// 'include' assignment, minus everything under every 'exclude' assignment
// (an exclude nested inside a broader include carves those villages back
// out). No assignments at all means no coverage - not everything.
export async function getCoveredVillageIds(userId) {
  const result = await pool.query('select level, location_id, mode from user_locations where user_id = $1', [userId]);
  const included = new Set();
  const excluded = new Set();
  for (const row of result.rows) {
    const villageIds = await resolveVillageIds(row.level, row.location_id);
    const target = row.mode === 'exclude' ? excluded : included;
    for (const id of villageIds) target.add(id);
  }
  for (const id of excluded) included.delete(id);
  return [...included];
}
