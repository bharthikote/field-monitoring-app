import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getCoveredVillageIds } from '../db/locationHelpers.js';
import { countryIdsSubquery, scopeClause } from '../db/masterDataScope.js';
import { SELECT_FARMERS } from './farmers.js';
import { SELECT_DEMO_PLOTS } from './demoPlots.js';

export const syncRouter = Router();

// The lists the offline Log Visit form needs, keyed by the name the phone
// stores them under.
const VISIT_LISTS = [
  { key: 'issueTypes', table: 'issue_types', extra: ', acknowledge_only' },
  { key: 'goodThings', table: 'good_things_observed', extra: '' },
  { key: 'diseases', table: 'diseases', extra: '' },
  { key: 'pests', table: 'pests', extra: '' },
  { key: 'techniques', table: 'techniques', extra: '' },
];

// Same country rule as GET /master/*: Super Admin sees every item; everyone
// else sees items with no country restriction or one assigned to a country
// they cover.
function masterQuery(user, sql, table, alias) {
  if (user.role === 'super_admin') return pool.query(sql.replace('%SCOPE%', 'true'));
  return pool.query(sql.replace('%SCOPE%', scopeClause(alias, table, 1)), [user.countryIds]);
}

// One download with everything the offline phone app needs for the user's
// covered villages: the villages themselves, active farmers, demo and adoption
// plots, the master lists for the visit form, and the open issues on those
// plots (so the form can say "already open" without a connection).
//
// It uses exactly the coverage rules the online endpoints use
// (getCoveredVillageIds covers Super Admin and Leadership too), so the phone
// never holds a record the user couldn't open online.
syncRouter.get('/sync/bundle', requireAuth, async (req, res) => {
  const user = req.user;
  const villageIds = await getCoveredVillageIds(user.userId);

  const [villages, farmers, plots, crops, varieties, ...lists] = await Promise.all([
    pool.query(
      `select vi.id, vi.name, b.name as block_name, di.name as district_name, s.name as state_name,
         co.name as country_name, co.id as country_id
       from villages vi
       join blocks b on b.id = vi.block_id
       join districts di on di.id = b.district_id
       join states s on s.id = di.state_id
       join countries co on co.id = s.country_id
       where vi.id = any($1)
       order by vi.name`,
      [villageIds],
    ),
    pool.query(`${SELECT_FARMERS} where f.status = 'active' and f.village_id = any($1) order by f.name`, [villageIds]),
    pool.query(`${SELECT_DEMO_PLOTS} where dp.village_id = any($1) order by dp.created_at desc`, [villageIds]),
    masterQuery(user, `select c.id, c.name from crops c where %SCOPE% order by c.name`, 'crops', 'c'),
    user.role === 'super_admin'
      ? pool.query('select v.id, v.crop_id, v.name from varieties v order by v.name')
      : pool.query(
        `select v.id, v.crop_id, v.name from varieties v join crops c on c.id = v.crop_id
         where ${scopeClause('c', 'crops', 1)} and ${scopeClause('v', 'varieties', 1)}
         order by v.name`,
        [user.countryIds],
      ),
    ...VISIT_LISTS.map((list) => masterQuery(
      user,
      `select t.id, t.name${list.extra}, ${countryIdsSubquery('t', list.table)} as country_ids
       from ${list.table} t where %SCOPE% order by t.name`,
      list.table,
      't',
    )),
  ]);

  const plotIds = plots.rows.map((p) => p.id);
  const openIssues = await pool.query(
    `select i.demo_plot_id, i.issue_type_id, it.name as issue_type_name, i.status, au.name as holder_name
     from issues i
     join issue_types it on it.id = i.issue_type_id
     left join users au on au.id = i.assigned_to
     where i.demo_plot_id = any($1) and i.status not in ('closed', 'dismissed')`,
    [plotIds],
  );

  const master = { crops: crops.rows, varieties: varieties.rows };
  VISIT_LISTS.forEach((list, i) => { master[list.key] = lists[i].rows; });

  res.json({
    serverTime: new Date().toISOString(),
    villages: villages.rows,
    farmers: farmers.rows,
    demoPlots: plots.rows,
    openIssues: openIssues.rows,
    master,
  });
});
