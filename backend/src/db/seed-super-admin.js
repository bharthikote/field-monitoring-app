import bcrypt from 'bcryptjs';
import { pool } from './pool.js';

const name = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];

if (!name || !email || !password) {
  console.error('Usage: node src/db/seed-super-admin.js "<name>" "<email>" "<password>"');
  process.exit(1);
}

const passwordHash = await bcrypt.hash(password, 10);

const result = await pool.query(
  `insert into users (name, email, password_hash, role, status)
   values ($1, $2, $3, 'super_admin', 'approved')
   on conflict (email) do update set password_hash = excluded.password_hash
   returning id, name, email, role, status`,
  [name, email, passwordHash],
);

console.log('Seeded Super Admin:', result.rows[0]);
await pool.end();
