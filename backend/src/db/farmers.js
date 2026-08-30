import { pool } from './pool.js';

export async function findFarmerByPhone(phone) {
  const result = await pool.query('select id, name, phone, village_id from farmers where phone = $1', [phone]);
  return result.rows[0] || null;
}
