import { pool } from './pool.js';
import { generateUniqueUserCode } from './userCode.js';

const { rows } = await pool.query(`select id from users where user_code is null`);

for (const row of rows) {
  const code = await generateUniqueUserCode(pool);
  await pool.query(`update users set user_code = $1 where id = $2`, [code, row.id]);
  console.log(`Assigned ${code} to ${row.id}`);
}

console.log(`Backfilled ${rows.length} user(s).`);
await pool.end();
