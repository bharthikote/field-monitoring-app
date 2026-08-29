import { pool } from './pool.js';

// Every "master data" table (crops, varieties, and the 7 simple lists) can
// optionally be restricted to a set of countries via a `<table>_countries`
// join table. No rows there for an item = visible everywhere - the default,
// so nothing that already existed before this feature loses visibility.

// SQL fragment returning the array of country ids assigned to `alias.id`
// ('{}' when unrestricted/global).
export function countryIdsSubquery(alias, table) {
  return `coalesce((select array_agg(mc.country_id) from ${table}_countries mc where mc.item_id = ${alias}.id), '{}')`;
}

// SQL fragment: true if `alias.id` (a row in `table`) is visible to at
// least one of the countries in the uuid[] parameter at `$<paramIndex>` -
// either because it has no country restriction at all, or because one of
// its assigned countries is in that list.
export function scopeClause(alias, table, paramIndex) {
  const joinTable = `${table}_countries`;
  return `(
    not exists (select 1 from ${joinTable} mc where mc.item_id = ${alias}.id)
    or exists (select 1 from ${joinTable} mc where mc.item_id = ${alias}.id and mc.country_id = any($${paramIndex}))
  )`;
}

function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Only Super Admin can do this' });
  }
  next();
}

// Wires up GET/PUT /master/<path>/:id/countries for one master-data table.
// GET returns the item's currently assigned country ids (empty = global).
// PUT replaces the full set - Super Admin only, matching who can already
// create/rename/delete these items.
export function registerCountryAssignmentRoutes(router, requireAdmin, { path, table }) {
  const joinTable = `${table}_countries`;

  router.get(`/master/${path}/:id/countries`, requireAdmin, async (req, res) => {
    const result = await pool.query(`select country_id from ${joinTable} where item_id = $1`, [req.params.id]);
    res.json({ countryIds: result.rows.map((r) => r.country_id) });
  });

  router.put(`/master/${path}/:id/countries`, requireAdmin, requireSuperAdmin, async (req, res) => {
    const { countryIds } = req.body;
    if (!Array.isArray(countryIds)) return res.status(400).json({ error: 'countryIds must be an array' });

    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query(`delete from ${joinTable} where item_id = $1`, [req.params.id]);
      for (const countryId of countryIds) {
        await client.query(`insert into ${joinTable} (item_id, country_id) values ($1, $2)`, [req.params.id, countryId]);
      }
      await client.query('commit');
      res.json({ countryIds });
    } catch (err) {
      await client.query('rollback');
      if (err.code === '23503') return res.status(400).json({ error: 'Unknown country' });
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });
}
