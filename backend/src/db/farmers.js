import { pool } from './pool.js';

// Active profiles only - a phone number can belong to a deactivated (wrongly
// created) profile and a new active one at the same time (the unique index
// only covers active rows), and a plot must never attach to the dead one.
export async function findFarmerByPhone(phone) {
  const result = await pool.query(
    `select id, name, phone, village_id from farmers where phone = $1 and status = 'active'`,
    [phone],
  );
  return result.rows[0] || null;
}
