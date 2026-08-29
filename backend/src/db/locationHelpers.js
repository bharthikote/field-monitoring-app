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
