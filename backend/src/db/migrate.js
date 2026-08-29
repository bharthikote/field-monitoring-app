import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', '..', 'migrations');

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

for (const file of files) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  console.log(`Applying ${file}...`);
  await pool.query(sql);
}

console.log('Migrations complete.');
await pool.end();
