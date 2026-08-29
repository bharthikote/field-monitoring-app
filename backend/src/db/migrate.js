import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', '..', 'migrations');

// Tracks which files have already run, so re-running this script only
// applies new ones - without this, every migration replayed from scratch
// on every run, which broke the moment a later file (012) widened a
// constraint an earlier file (002) used to narrow.
await pool.query(`
  create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )
`);

const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
const appliedResult = await pool.query('select filename from schema_migrations');
const applied = new Set(appliedResult.rows.map((r) => r.filename));

for (const file of files) {
  if (applied.has(file)) {
    console.log(`Skipping ${file} (already applied)`);
    continue;
  }
  const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
  console.log(`Applying ${file}...`);
  await pool.query(sql);
  await pool.query('insert into schema_migrations (filename) values ($1)', [file]);
}

console.log('Migrations complete.');
await pool.end();
