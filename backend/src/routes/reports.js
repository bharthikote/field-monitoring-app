import { Router } from 'express';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { getCoveredVillageIds, isLocationCovered } from '../db/locationHelpers.js';
import { SIMPLE_LISTS } from './simpleMasterLists.js';

export const reportsRouter = Router();

export const SELECT_DEMO_PLOTS = `
  select dp.id, dp.farmer_name, dp.farmer_phone, dp.demo_status, dp.created_at, dp.updated_at,
    c.name as crop_name, v.name as variety_name, vi.name as village_name
  from demo_plots dp
  join crops c on c.id = dp.crop_id
  join varieties v on v.id = dp.variety_id
  join villages vi on vi.id = dp.village_id
`;

// Same visibility rule as everywhere else demo plot data is read: Super
// Admin sees everything, everyone else is scoped to the villages their
// location assignments cover.
async function villageScopeClause(req, params) {
  // Leadership sees every country too (PRD Section 2: "All countries" /
  // "View/reporting access only"), same unscoped reach as Super Admin.
  if (req.user.role === 'super_admin' || req.user.role === 'leadership') return '';
  const villageIds = await getCoveredVillageIds(req.user.userId);
  params.push(villageIds);
  return ` where dp.village_id = any($${params.length})`;
}

reportsRouter.get('/reports/demos', requireAuth, async (req, res) => {
  const params = [];
  const whereClause = await villageScopeClause(req, params);
  const result = await pool.query(`${SELECT_DEMO_PLOTS} ${whereClause} order by dp.created_at desc`, params);
  res.json({ demoPlots: result.rows });
});

// Sources the real farmers master table directly (not derived from demo
// plots) - a farmer registered via Training/Field Day/the TFO detailed
// form with zero demo plots still needs to show up here. `villages` stays
// a single value now (a farmer has exactly one canonical village), kept as
// a column name for report-farmers.html's existing render/CSV code.
reportsRouter.get('/reports/farmers', requireAuth, async (req, res) => {
  const params = [];
  let whereClause = '';
  if (req.user.role !== 'super_admin' && req.user.role !== 'leadership') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    params.push(villageIds);
    whereClause = ` where f.village_id = any($${params.length})`;
  }
  const result = await pool.query(
    `select f.name as farmer_name, f.phone as farmer_phone, vi.name as villages,
       (select count(*)::int from demo_plots dp where dp.farmer_id = f.id)
         + (select count(*)::int from trainings tr where tr.farmer_id = f.id)
         + (select count(*)::int from field_days fd where fd.farmer_id = f.id) as activity_count,
       f.created_at as first_created_at
     from farmers f
     join villages vi on vi.id = f.village_id
     ${whereClause}
     order by f.name`,
    params,
  );
  res.json({ farmers: result.rows });
});

// Crops and varieties live in their own tables (variety belongs to a crop);
// everything else is a flat name-only list. Combine them into one menu of
// exportable lists so the Reports page doesn't need to know the difference.
export const REPORT_MASTER_LISTS = [
  { key: 'crops', label: 'Crops' },
  { key: 'varieties', label: 'Varieties' },
  ...SIMPLE_LISTS.map((l) => ({ key: l.path, label: l.label })),
];

// Plots with a captured GPS location, for the map report. Same coverage
// rule as everywhere else (Super Admin/Leadership unscoped, everyone else
// limited to their covered villages). Plots created before GPS capture
// existed have no location and simply can't be placed on the map -
// `totalInScope` (all plots, with or without GPS) lets the page say how
// many are missing rather than just showing a possibly-empty map.
reportsRouter.get('/reports/map-points', requireAuth, async (req, res) => {
  const scopeParams = [];
  let scopeClause = '';
  if (req.user.role !== 'super_admin' && req.user.role !== 'leadership') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    scopeParams.push(villageIds);
    scopeClause = ` and dp.village_id = any($${scopeParams.length})`;
  }

  const totalResult = await pool.query(
    `select count(*)::int as count from demo_plots dp where true${scopeClause}`,
    scopeParams,
  );

  const result = await pool.query(
    `select dp.id, dp.farmer_name, dp.farmer_phone, dp.plot_type, dp.demo_status, dp.cycle, dp.created_at,
       dp.gps_lat, dp.gps_lng,
       c.name as crop_name, v.name as variety_name,
       vi.name as village_name, b.name as block_name, di.name as district_name, s.name as state_name, co.name as country_name,
       lv.created_at as last_visit_at
     from demo_plots dp
     join crops c on c.id = dp.crop_id
     join varieties v on v.id = dp.variety_id
     join villages vi on vi.id = dp.village_id
     join blocks b on b.id = vi.block_id
     join districts di on di.id = b.district_id
     join states s on s.id = di.state_id
     join countries co on co.id = s.country_id
     left join lateral (
       select created_at from visits where demo_plot_id = dp.id order by created_at desc limit 1
     ) lv on true
     where dp.gps_lat is not null and dp.gps_lng is not null${scopeClause}
     order by dp.created_at desc`,
    scopeParams,
  );
  res.json({ plots: result.rows, totalInScope: totalResult.rows[0].count });
});

// Every logged activity that carries its own GPS fix, combined into one
// typed stream for the map: a plot visit, a training, a field day, an
// institution visit, an agro dealer visit, or a data collection submission.
// Each is scoped by its own village (a visit's through its plot, an
// institution/dealer visit's through the institution/dealer) using the same
// $1 covered-village-ids array reused across every branch of the union, so
// Super Admin/Leadership (no array, no filter) still see everything.
// Capped and newest-first so the map stays responsive as data grows - this
// is a live snapshot, not a full history export.
reportsRouter.get('/reports/map-activities', requireAuth, async (req, res) => {
  const globalScope = req.user.role === 'super_admin' || req.user.role === 'leadership';
  const villageIds = globalScope ? null : await getCoveredVillageIds(req.user.userId);
  const villageFilter = (alias) => (villageIds ? ` and ${alias}.village_id = any($1)` : '');

  // Visits/trainings/field days/data collection all resolve to a village
  // directly (or one join away), so their coverage check is a plain SQL
  // filter, same as everywhere else in this file.
  const directResult = await pool.query(
    `select 'visit' as type, v.id, v.gps_lat, v.gps_lng, v.created_at, dp.farmer_name as title, u.name as by_name,
         v.overall_photo_url as photo_url
       from visits v join demo_plots dp on dp.id = v.demo_plot_id join users u on u.id = v.visited_by
       where v.gps_lat is not null${villageFilter('dp')}
     union all
     select 'training', t.id, t.gps_lat, t.gps_lng, t.created_at, t.farmer_name, u.name, t.photo_url
       from trainings t join users u on u.id = t.created_by
       where t.gps_lat is not null${villageFilter('t')}
     union all
     select 'field_day', fd.id, fd.gps_lat, fd.gps_lng, fd.created_at, fd.farmer_name, u.name, fd.photo_url
       from field_days fd join users u on u.id = fd.created_by
       where fd.gps_lat is not null${villageFilter('fd')}
     union all
     select 'data_collection', s.id, s.gps_lat, s.gps_lng, s.created_at, f.name as title, u.name as by_name,
         null::text as photo_url
       from data_collection_submissions s join farmers f on f.id = s.farmer_id join users u on u.id = s.submitted_by
       where s.gps_lat is not null${villageFilter('s')}
     order by created_at desc
     limit 1000`,
    villageIds ? [villageIds] : [],
  );

  // Institutions/agro dealers sit at a village, block, or district, not a
  // fixed village_id (see migration 021) - their coverage can't be a plain
  // SQL join, so resolve it the same way institutions.js does.
  const [instResult, dealerResult] = await Promise.all([
    pool.query(
      `select iv.id, iv.gps_lat, iv.gps_lng, iv.created_at, i.name as title, u.name as by_name, iv.photo_url,
         i.location_level, i.location_id
       from institution_visits iv join institutions i on i.id = iv.institution_id join users u on u.id = iv.created_by
       where iv.gps_lat is not null order by iv.created_at desc limit 1000`,
    ),
    pool.query(
      `select adv.id, adv.gps_lat, adv.gps_lng, adv.created_at, ad.name as title, u.name as by_name, adv.photo_url,
         ad.location_level, ad.location_id
       from agro_dealer_visits adv join agro_dealers ad on ad.id = adv.dealer_id join users u on u.id = adv.created_by
       where adv.gps_lat is not null order by adv.created_at desc limit 1000`,
    ),
  ]);

  const filterByCoverage = async (rows) => {
    if (!villageIds) return rows;
    const covered = await Promise.all(rows.map((r) => isLocationCovered(r.location_level, r.location_id, villageIds)));
    return rows.filter((_, i) => covered[i]);
  };

  const institutionVisits = (await filterByCoverage(instResult.rows)).map(
    ({ location_level, location_id, ...r }) => ({ type: 'institution_visit', ...r }),
  );
  const dealerVisits = (await filterByCoverage(dealerResult.rows)).map(
    ({ location_level, location_id, ...r }) => ({ type: 'agro_dealer_visit', ...r }),
  );

  const activities = [...directResult.rows, ...institutionVisits, ...dealerVisits]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 1000);
  res.json({ activities });
});

// Issues plotted at their plot's location (an issue has no GPS of its own -
// it's a fact about the plot). Same village scoping as everywhere else.
// Grouping into open/resolved is left to the caller (the raw status is
// returned) since that's a display choice, not a data one.
reportsRouter.get('/reports/map-issues', requireAuth, async (req, res) => {
  const params = [];
  let scope = '';
  if (req.user.role !== 'super_admin' && req.user.role !== 'leadership') {
    const villageIds = await getCoveredVillageIds(req.user.userId);
    params.push(villageIds);
    scope = ` and dp.village_id = any($${params.length})`;
  }
  const result = await pool.query(
    `select i.id, i.status, i.photo_url, i.created_at, it.name as issue_type_name,
       dp.farmer_name, dp.gps_lat, dp.gps_lng
     from issues i
     join demo_plots dp on dp.id = i.demo_plot_id
     join issue_types it on it.id = i.issue_type_id
     where dp.gps_lat is not null and dp.gps_lng is not null${scope}
     order by i.created_at desc
     limit 1000`,
    params,
  );
  res.json({ issues: result.rows });
});

// Headline numbers for the Home map's KPI strip - scoped the same way as
// everything else here (village coverage, global for Super Admin/
// Leadership), so what a user sees here always matches what they're
// actually allowed to see everywhere else in the app. Deliberately a fixed
// set of named numbers, not a general reporting endpoint.
reportsRouter.get('/reports/analytics-summary', requireAuth, async (req, res) => {
  const globalScope = req.user.role === 'super_admin' || req.user.role === 'leadership';
  const villageIds = globalScope ? null : await getCoveredVillageIds(req.user.userId);
  const villageFilter = (alias) => (villageIds ? ` and ${alias}.village_id = any($1)` : '');
  const params = villageIds ? [villageIds] : [];

  const [
    issuesRaisedTotal, issuesResolvedTotal, issuesOpenTotal, issuesClosedTotal,
    issuesDisputed, issuesPendingVerification, avgResolutionDays,
    issuesResolvedLast30Days, issuesRaisedThisYear,
    teamLeadVisits, visitsThisMonth, plotStatus, farmerCount,
  ] = await Promise.all([
    pool.query(`select count(*)::int as c from issues i join demo_plots dp on dp.id = i.demo_plot_id where true${villageFilter('dp')}`, params),
    pool.query(`select count(*)::int as c from issues i join demo_plots dp on dp.id = i.demo_plot_id where i.resolved_at is not null${villageFilter('dp')}`, params),
    pool.query(
      `select count(*)::int as c from issues i join demo_plots dp on dp.id = i.demo_plot_id
       where i.status in ('raised','assigned','in_progress','pending_verification','disputed')${villageFilter('dp')}`,
      params,
    ),
    pool.query(`select count(*)::int as c from issues i join demo_plots dp on dp.id = i.demo_plot_id where i.status = 'closed'${villageFilter('dp')}`, params),
    pool.query(`select count(*)::int as c from issues i join demo_plots dp on dp.id = i.demo_plot_id where i.status = 'disputed'${villageFilter('dp')}`, params),
    pool.query(`select count(*)::int as c from issues i join demo_plots dp on dp.id = i.demo_plot_id where i.status = 'pending_verification'${villageFilter('dp')}`, params),
    pool.query(
      `select round(avg(extract(epoch from (i.resolved_at - i.created_at)) / 86400)::numeric, 1) as d
       from issues i join demo_plots dp on dp.id = i.demo_plot_id where i.resolved_at is not null${villageFilter('dp')}`,
      params,
    ),
    pool.query(
      `select count(*)::int as c from issues i join demo_plots dp on dp.id = i.demo_plot_id
       where i.status = 'closed' and i.closed_at >= now() - interval '30 days'${villageFilter('dp')}`,
      params,
    ),
    pool.query(
      `select count(*)::int as c from issues i join demo_plots dp on dp.id = i.demo_plot_id
       where i.created_at >= date_trunc('year', now())${villageFilter('dp')}`,
      params,
    ),
    pool.query(
      `select count(*)::int as c from visits v join demo_plots dp on dp.id = v.demo_plot_id
       join users u on u.id = v.visited_by where u.role = 'team_lead'${villageFilter('dp')}`,
      params,
    ),
    pool.query(
      `select count(*)::int as c from visits v join demo_plots dp on dp.id = v.demo_plot_id
       where v.created_at >= date_trunc('month', now())${villageFilter('dp')}`,
      params,
    ),
    pool.query(
      `select demo_status, count(*)::int as c from demo_plots dp where true${villageFilter('dp')} group by demo_status`,
      params,
    ),
    pool.query(`select count(*)::int as c from farmers f where true${villageFilter('f')}`, params),
  ]);

  // "Field monitoring activities done by higher officials" - every logged
  // activity whose actor isn't a TFO (a TFO doing their own fieldwork isn't
  // "oversight"; a Supervisor/Team Lead/Country Manager/Admin/Leadership/
  // Super Admin visiting is). Institutions/agro dealers sit at a village,
  // block, or district (migration 021), not a plain village_id, so those
  // two are coverage-checked the same way map-activities does it.
  const higherRoleFilter = "u.role <> 'tfo'";
  const [directHigherActivity, instRows, dealerRows] = await Promise.all([
    pool.query(
      `select
         (select count(*)::int from visits v join demo_plots dp on dp.id = v.demo_plot_id join users u on u.id = v.visited_by where ${higherRoleFilter}${villageFilter('dp')})
         + (select count(*)::int from trainings t join users u on u.id = t.created_by where ${higherRoleFilter}${villageFilter('t')})
         + (select count(*)::int from field_days fd join users u on u.id = fd.created_by where ${higherRoleFilter}${villageFilter('fd')})
         + (select count(*)::int from data_collection_submissions s join users u on u.id = s.submitted_by where ${higherRoleFilter}${villageFilter('s')})
         as c`,
      params,
    ),
    pool.query(
      `select iv.id, i.location_level, i.location_id
       from institution_visits iv join institutions i on i.id = iv.institution_id join users u on u.id = iv.created_by
       where ${higherRoleFilter}`,
    ),
    pool.query(
      `select adv.id, ad.location_level, ad.location_id
       from agro_dealer_visits adv join agro_dealers ad on ad.id = adv.dealer_id join users u on u.id = adv.created_by
       where ${higherRoleFilter}`,
    ),
  ]);
  let higherActivityTotal = directHigherActivity.rows[0].c;
  if (villageIds) {
    const instCovered = await Promise.all(instRows.rows.map((r) => isLocationCovered(r.location_level, r.location_id, villageIds)));
    const dealerCovered = await Promise.all(dealerRows.rows.map((r) => isLocationCovered(r.location_level, r.location_id, villageIds)));
    higherActivityTotal += instCovered.filter(Boolean).length + dealerCovered.filter(Boolean).length;
  } else {
    higherActivityTotal += instRows.rowCount + dealerRows.rowCount;
  }

  const statusCounts = Object.fromEntries(plotStatus.rows.map((r) => [r.demo_status, r.c]));
  const raisedCount = issuesRaisedTotal.rows[0].c;
  const closedCount = issuesClosedTotal.rows[0].c;
  res.json({
    issuesRaisedTotal: raisedCount,
    issuesResolvedTotal: issuesResolvedTotal.rows[0].c,
    issuesOpenTotal: issuesOpenTotal.rows[0].c,
    issuesClosedTotal: closedCount,
    issuesClosedPercent: raisedCount > 0 ? Math.round((closedCount / raisedCount) * 100) : 0,
    issuesDisputed: issuesDisputed.rows[0].c,
    issuesPendingVerification: issuesPendingVerification.rows[0].c,
    avgResolutionDays: avgResolutionDays.rows[0].d !== null ? Number(avgResolutionDays.rows[0].d) : null,
    issuesResolvedLast30Days: issuesResolvedLast30Days.rows[0].c,
    issuesRaisedThisYear: issuesRaisedThisYear.rows[0].c,
    higherOfficialActivities: higherActivityTotal,
    teamLeadVisits: teamLeadVisits.rows[0].c,
    visitsThisMonth: visitsThisMonth.rows[0].c,
    ongoingPlots: statusCounts.ongoing || 0,
    completedPlots: statusCounts.completed || 0,
    totalFarmers: farmerCount.rows[0].c,
  });
});

// --- Role dashboards ---
// One endpoint, four shapes: what a person needs from a landing page depends
// on their job, not on which tables exist. Everything is scoped by coverage
// the same way as the rest of this file (global for Super Admin/Leadership).

const DASHBOARD_VIEW_BY_ROLE = {
  super_admin: 'global', leadership: 'global',
  country_manager: 'country', admin: 'country',
  team_lead: 'team', supervisor: 'team',
  tfo: 'tfo',
};
// A plot with no visit in this long counts as overdue - there is no visit
// schedule in the system yet, so this is a stand-in for one.
const OVERDUE_DAYS = 30;
const OPEN_ISSUE_STATUSES_SQL = "('raised','assigned','in_progress','pending_verification','disputed')";

const VILLAGE_COUNTRY_CTE = `
  with vc as (
    select v.id as village_id, co.name as country
    from villages v join blocks b on b.id = v.block_id join districts d on d.id = b.district_id
    join states s on s.id = d.state_id join countries co on co.id = s.country_id
  )`;

function monthlyTrendSql(innerSelect) {
  return `select to_char(m, 'YYYY-MM') as month, count(x.id)::int as c
    from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
    left join (${innerSelect}) x on date_trunc('month', x.created_at) = m
    group by m order by m`;
}

async function countryBreakdown() {
  const [plots, farmers, visits, issues] = await Promise.all([
    pool.query(`${VILLAGE_COUNTRY_CTE} select vc.country, count(*)::int as c from demo_plots dp join vc on vc.village_id = dp.village_id group by vc.country`),
    pool.query(`${VILLAGE_COUNTRY_CTE} select vc.country, count(*)::int as c from farmers f join vc on vc.village_id = f.village_id group by vc.country`),
    pool.query(`${VILLAGE_COUNTRY_CTE} select vc.country, count(*)::int as c from visits v join demo_plots dp on dp.id = v.demo_plot_id join vc on vc.village_id = dp.village_id group by vc.country`),
    pool.query(
      `${VILLAGE_COUNTRY_CTE}
       select vc.country,
         count(*) filter (where i.status in ${OPEN_ISSUE_STATUSES_SQL})::int as open,
         count(*) filter (where i.status = 'closed')::int as closed,
         count(*)::int as raised
       from issues i join demo_plots dp on dp.id = i.demo_plot_id join vc on vc.village_id = dp.village_id group by vc.country`,
    ),
  ]);
  const byCountry = new Map();
  const row = (name) => {
    if (!byCountry.has(name)) byCountry.set(name, { country: name, plots: 0, farmers: 0, visits: 0, openIssues: 0, closedIssues: 0, raised: 0 });
    return byCountry.get(name);
  };
  plots.rows.forEach((r) => { row(r.country).plots = r.c; });
  farmers.rows.forEach((r) => { row(r.country).farmers = r.c; });
  visits.rows.forEach((r) => { row(r.country).visits = r.c; });
  issues.rows.forEach((r) => { const c = row(r.country); c.openIssues = r.open; c.closedIssues = r.closed; c.raised = r.raised; });
  return [...byCountry.values()]
    .map((c) => ({ ...c, closePercent: c.raised > 0 ? Math.round((c.closedIssues / c.raised) * 100) : null }))
    .sort((a, b) => b.plots - a.plots || a.country.localeCompare(b.country));
}

// Every approved TFO whose coverage overlaps the viewer's, with the numbers
// a manager checks them on. A TFO's overdue-plot count only looks at the
// part of their coverage the viewer also covers, so a Team Lead isn't
// judged on villages that aren't theirs.
async function tfoStatsFor(viewerVillageIds) {
  const tfos = (await pool.query(`select id, name, user_code from users where role = 'tfo' and status = 'approved' order by name`)).rows;
  const covered = await Promise.all(tfos.map((t) => getCoveredVillageIds(t.id)));
  const mine = new Set(viewerVillageIds);
  const inScope = tfos
    .map((t, i) => ({ ...t, villages: covered[i].filter((v) => mine.has(v)) }))
    .filter((t) => t.villages.length > 0);
  if (inScope.length === 0) return [];
  const ids = inScope.map((t) => t.id);

  const [visitStats, resolvedStats, openStats, overdueCounts] = await Promise.all([
    pool.query(
      `select visited_by, count(*)::int as total,
         count(*) filter (where created_at >= now() - interval '30 days')::int as last30, max(created_at) as last_at
       from visits where visited_by = any($1) group by visited_by`,
      [ids],
    ),
    pool.query(
      `select resolved_by, count(*)::int as c,
         round(avg(extract(epoch from (resolved_at - created_at)) / 86400)::numeric, 1) as d
       from issues where resolved_by = any($1) and resolved_at is not null group by resolved_by`,
      [ids],
    ),
    pool.query(
      `select assigned_to, count(*)::int as c from issues
       where assigned_to = any($1) and status in ('assigned','in_progress') group by assigned_to`,
      [ids],
    ),
    Promise.all(inScope.map((t) => pool.query(
      `select count(*)::int as c from demo_plots dp
       where dp.village_id = any($1) and dp.demo_status = 'ongoing'
         and dp.created_at < now() - interval '${OVERDUE_DAYS} days'
         and not exists (select 1 from visits v where v.demo_plot_id = dp.id and v.created_at >= now() - interval '${OVERDUE_DAYS} days')`,
      [t.villages],
    ))),
  ]);
  const by = (rows, key) => new Map(rows.map((r) => [r[key], r]));
  const visitsBy = by(visitStats.rows, 'visited_by');
  const resolvedBy = by(resolvedStats.rows, 'resolved_by');
  const openBy = by(openStats.rows, 'assigned_to');

  return inScope.map((t, i) => ({
    id: t.id, name: t.name, userCode: t.user_code,
    visitsLast30: visitsBy.get(t.id)?.last30 ?? 0,
    visitsTotal: visitsBy.get(t.id)?.total ?? 0,
    lastVisitAt: visitsBy.get(t.id)?.last_at ?? null,
    issuesResolved: resolvedBy.get(t.id)?.c ?? 0,
    avgResolutionDays: resolvedBy.get(t.id)?.d != null ? Number(resolvedBy.get(t.id).d) : null,
    openAssigned: openBy.get(t.id)?.c ?? 0,
    overduePlots: overdueCounts[i].rows[0].c,
  }));
}

// Consecutive days, ending today or yesterday, on which this person logged
// at least one visit - "yesterday" still counts so the streak doesn't read
// zero every morning before their first visit of the day.
function visitStreakDays(dateStrings) {
  const days = new Set(dateStrings);
  const fmt = (d) => d.toISOString().slice(0, 10);
  const cursor = new Date();
  if (!days.has(fmt(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (days.has(fmt(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

async function tfoOwnView(userId, villageIds) {
  const [due, overdue, openIssues, openCount, dates, totals] = await Promise.all([
    pool.query(
      `select dp.id, dp.farmer_name, c.name as crop_name, vi.name as village_name, dp.created_at,
         (select max(v.created_at) from visits v where v.demo_plot_id = dp.id) as last_visit_at
       from demo_plots dp join crops c on c.id = dp.crop_id join villages vi on vi.id = dp.village_id
       where dp.demo_status = 'ongoing' and dp.village_id = any($1)
       order by last_visit_at asc nulls first, dp.created_at asc limit 8`,
      [villageIds],
    ),
    pool.query(
      `select count(*)::int as c from demo_plots dp
       where dp.village_id = any($1) and dp.demo_status = 'ongoing'
         and dp.created_at < now() - interval '${OVERDUE_DAYS} days'
         and not exists (select 1 from visits v where v.demo_plot_id = dp.id and v.created_at >= now() - interval '${OVERDUE_DAYS} days')`,
      [villageIds],
    ),
    pool.query(
      `select i.id, i.status, i.created_at, i.assigned_at, it.name as issue_type_name, dp.farmer_name
       from issues i join issue_types it on it.id = i.issue_type_id join demo_plots dp on dp.id = i.demo_plot_id
       where i.assigned_to = $1 and i.status in ('assigned','in_progress') order by i.created_at asc limit 8`,
      [userId],
    ),
    pool.query(`select count(*)::int as c from issues where assigned_to = $1 and status in ('assigned','in_progress')`, [userId]),
    pool.query(
      `select distinct (created_at at time zone 'UTC')::date::text as d from visits
       where visited_by = $1 and created_at >= now() - interval '120 days'`,
      [userId],
    ),
    pool.query(
      `select count(*)::int as total, count(*) filter (where created_at >= date_trunc('month', now()))::int as this_month
       from visits where visited_by = $1`,
      [userId],
    ),
  ]);
  return {
    plotsDue: due.rows.map((r) => ({
      id: r.id, farmerName: r.farmer_name, cropName: r.crop_name, villageName: r.village_name,
      lastVisitAt: r.last_visit_at, createdAt: r.created_at,
    })),
    overdueTotal: overdue.rows[0].c,
    openIssues: openIssues.rows.map((r) => ({
      id: r.id, status: r.status, issueTypeName: r.issue_type_name, farmerName: r.farmer_name,
      since: r.assigned_at || r.created_at,
    })),
    openIssuesTotal: openCount.rows[0].c,
    streakDays: visitStreakDays(dates.rows.map((r) => r.d)),
    visitsTotal: totals.rows[0].total,
    visitsThisMonth: totals.rows[0].this_month,
  };
}

reportsRouter.get('/reports/dashboard', requireAuth, async (req, res) => {
  const view = DASHBOARD_VIEW_BY_ROLE[req.user.role] || 'team';
  const globalScope = view === 'global';
  const villageIds = globalScope ? null : await getCoveredVillageIds(req.user.userId);
  const vf = (alias) => (villageIds ? ` and ${alias}.village_id = any($1)` : '');
  const params = villageIds ? [villageIds] : [];

  const trendQueries = [
    monthlyTrendSql(`select f.id, f.created_at from farmers f where true${vf('f')}`),
    monthlyTrendSql(`select dp.id, dp.created_at from demo_plots dp where true${vf('dp')}`),
    monthlyTrendSql(`select v.id, v.created_at from visits v join demo_plots dp on dp.id = v.demo_plot_id where true${vf('dp')}`),
    monthlyTrendSql(`select i.id, i.created_at from issues i join demo_plots dp on dp.id = i.demo_plot_id where true${vf('dp')}`),
  ];
  const [farmers, plots, visits, issues, queue, scopeCountries] = await Promise.all([
    ...trendQueries.map((q) => pool.query(q, params)),
    pool.query(
      `select count(*) filter (where status in ('assigned','in_progress'))::int as assigned,
         count(*) filter (where status = 'pending_verification')::int as pending_verification,
         count(*) filter (where status = 'disputed')::int as disputed
       from issues where assigned_to = $1`,
      [req.user.userId],
    ),
    globalScope
      ? Promise.resolve({ rows: [] })
      : pool.query(
        `select distinct co.name from villages v join blocks b on b.id = v.block_id join districts d on d.id = b.district_id
         join states s on s.id = d.state_id join countries co on co.id = s.country_id
         where v.id = any($1) order by co.name`,
        [villageIds],
      ),
  ]);

  const payload = {
    view,
    scope: { global: globalScope, countries: scopeCountries.rows.map((r) => r.name) },
    trends: {
      months: farmers.rows.map((r) => r.month),
      farmers: farmers.rows.map((r) => r.c),
      plots: plots.rows.map((r) => r.c),
      visits: visits.rows.map((r) => r.c),
      issues: issues.rows.map((r) => r.c),
    },
    myQueue: {
      assigned: queue.rows[0].assigned,
      pendingVerification: queue.rows[0].pending_verification,
      disputed: queue.rows[0].disputed,
    },
  };

  if (view === 'global') payload.countryBreakdown = await countryBreakdown();
  if (view === 'country' || view === 'team') payload.tfoStats = await tfoStatsFor(villageIds);
  if (view === 'tfo') payload.tfoView = await tfoOwnView(req.user.userId, villageIds);
  res.json(payload);
});

// Every ongoing plot in the caller's coverage with when it was last visited
// and who is responsible for it, for the Visit Compliance report. The
// "how many days counts as overdue" threshold is applied in the page so
// changing it doesn't need another round trip. Responsible TFOs come from
// coverage (a village has no single owner column), computed once for the
// distinct villages involved rather than per plot.
reportsRouter.get('/reports/visit-compliance', requireAuth, async (req, res) => {
  const globalScope = req.user.role === 'super_admin' || req.user.role === 'leadership';
  const villageIds = globalScope ? null : await getCoveredVillageIds(req.user.userId);
  const result = await pool.query(
    `select dp.id, dp.farmer_name, dp.farmer_phone, dp.plot_type, dp.cycle, dp.created_at, dp.village_id,
       c.name as crop_name, vi.name as village_name, b.name as block_name, di.name as district_name,
       s.name as state_name, co.name as country_name,
       lv.created_at as last_visit_at, lv.visited_by_name as last_visited_by
     from demo_plots dp
     join crops c on c.id = dp.crop_id
     join villages vi on vi.id = dp.village_id
     join blocks b on b.id = vi.block_id
     join districts di on di.id = b.district_id
     join states s on s.id = di.state_id
     join countries co on co.id = s.country_id
     left join lateral (
       select v.created_at, u.name as visited_by_name from visits v join users u on u.id = v.visited_by
       where v.demo_plot_id = dp.id order by v.created_at desc limit 1
     ) lv on true
     where dp.demo_status = 'ongoing'${villageIds ? ' and dp.village_id = any($1)' : ''}
     order by lv.created_at asc nulls first, dp.created_at asc
     limit 5000`,
    villageIds ? [villageIds] : [],
  );

  const tfos = (await pool.query(`select id, name from users where role = 'tfo' and status = 'approved'`)).rows;
  const tfoCoverage = await Promise.all(tfos.map((t) => getCoveredVillageIds(t.id)));
  const tfosByVillage = new Map();
  tfos.forEach((t, i) => {
    for (const vid of tfoCoverage[i]) {
      if (!tfosByVillage.has(vid)) tfosByVillage.set(vid, []);
      tfosByVillage.get(vid).push(t.name);
    }
  });

  res.json({
    plots: result.rows.map(({ village_id, ...r }) => ({ ...r, responsible_tfos: tfosByVillage.get(village_id) || [] })),
  });
});

// Issue Aging: where open issues are sitting and for how long, plus
// resolution speed and dispute rate by country and by person. "Time at the
// current stage" is measured from whichever event put the issue in its
// current state (assigned/started/resolved/disputed) or its latest
// reassignment, whichever is later - so a reassigned issue's clock restarts
// with its new holder instead of counting time it spent with the last one.
reportsRouter.get('/reports/issue-aging', requireAuth, async (req, res) => {
  const globalScope = req.user.role === 'super_admin' || req.user.role === 'leadership';
  const villageIds = globalScope ? null : await getCoveredVillageIds(req.user.userId);
  const scope = villageIds ? ' and dp.village_id = any($1)' : '';
  const params = villageIds ? [villageIds] : [];

  const [openResult, countryResult, resolvedResult, disputedResult] = await Promise.all([
    pool.query(
      `select i.id, i.status, i.created_at, i.reopened_count, it.name as issue_type_name, dp.farmer_name,
         vi.name as village_name, co.name as country_name, i.assigned_to as holder_id, au.name as holder_name, au.role as holder_role,
         greatest(
           case i.status
             when 'raised' then i.created_at
             when 'assigned' then coalesce(i.assigned_at, i.created_at)
             when 'in_progress' then coalesce(i.started_at, i.assigned_at, i.created_at)
             when 'pending_verification' then coalesce(i.resolved_at, i.created_at)
             when 'disputed' then coalesce(i.disputed_at, i.created_at)
           end,
           (select max(r.created_at) from issue_reassignments r where r.issue_id = i.id)
         ) as stage_since,
         (select count(*)::int from issue_reassignments r where r.issue_id = i.id) as reassignments
       from issues i
       join issue_types it on it.id = i.issue_type_id
       join demo_plots dp on dp.id = i.demo_plot_id
       join villages vi on vi.id = dp.village_id
       join blocks b on b.id = vi.block_id join districts di on di.id = b.district_id
       join states s on s.id = di.state_id join countries co on co.id = s.country_id
       left join users au on au.id = i.assigned_to
       where i.status in ${OPEN_ISSUE_STATUSES_SQL}${scope}
       order by i.created_at asc limit 5000`,
      params,
    ),
    pool.query(
      `select co.name as country,
         count(*)::int as raised,
         count(*) filter (where i.status in ${OPEN_ISSUE_STATUSES_SQL})::int as open,
         count(*) filter (where i.status = 'closed')::int as closed,
         count(*) filter (where i.status = 'dismissed')::int as dismissed,
         count(*) filter (where i.disputed_at is not null)::int as disputed,
         count(*) filter (where i.resolved_at is not null)::int as resolved,
         round(avg(extract(epoch from (i.resolved_at - i.created_at)) / 86400) filter (where i.resolved_at is not null)::numeric, 1) as avg_resolution_days
       from issues i
       join demo_plots dp on dp.id = i.demo_plot_id
       join villages vi on vi.id = dp.village_id
       join blocks b on b.id = vi.block_id join districts di on di.id = b.district_id
       join states s on s.id = di.state_id join countries co on co.id = s.country_id
       where true${scope} group by co.name order by co.name`,
      params,
    ),
    pool.query(
      `select u.id, u.name, u.role, count(*)::int as resolved,
         round(avg(extract(epoch from (i.resolved_at - i.created_at)) / 86400)::numeric, 1) as avg_days
       from issues i join demo_plots dp on dp.id = i.demo_plot_id join users u on u.id = i.resolved_by
       where i.resolved_at is not null${scope} group by u.id, u.name, u.role`,
      params,
    ),
    pool.query(
      `select u.id, u.name, u.role, count(*)::int as disputed
       from issues i join demo_plots dp on dp.id = i.demo_plot_id join users u on u.id = i.disputed_by
       where true${scope} group by u.id, u.name, u.role`,
      params,
    ),
  ]);

  const people = new Map();
  const person = (id, name, role) => {
    if (!people.has(id)) people.set(id, { id, name, role, holding: 0, resolved: 0, avgResolutionDays: null, disputed: 0 });
    return people.get(id);
  };
  openResult.rows.forEach((r) => { if (r.holder_id) person(r.holder_id, r.holder_name, r.holder_role).holding++; });
  resolvedResult.rows.forEach((r) => {
    const p = person(r.id, r.name, r.role);
    p.resolved = r.resolved;
    p.avgResolutionDays = r.avg_days != null ? Number(r.avg_days) : null;
  });
  disputedResult.rows.forEach((r) => { person(r.id, r.name, r.role).disputed = r.disputed; });

  res.json({
    openIssues: openResult.rows.map(({ holder_id, ...r }) => r),
    byCountry: countryResult.rows.map((r) => ({
      country: r.country, raised: r.raised, open: r.open, closed: r.closed, dismissed: r.dismissed, disputed: r.disputed, resolved: r.resolved,
      avgResolutionDays: r.avg_resolution_days != null ? Number(r.avg_resolution_days) : null,
    })),
    byPerson: [...people.values()],
  });
});

reportsRouter.get('/reports/master-lists', requireAuth, async (_req, res) => {
  res.json({ lists: REPORT_MASTER_LISTS });
});

reportsRouter.get('/reports/master-lists/:key', requireAuth, async (req, res) => {
  const { key } = req.params;

  if (key === 'crops') {
    const result = await pool.query('select name from crops order by name');
    return res.json({ items: result.rows });
  }
  if (key === 'varieties') {
    const result = await pool.query(
      `select v.name, c.name as crop_name from varieties v join crops c on c.id = v.crop_id order by c.name, v.name`,
    );
    return res.json({ items: result.rows });
  }
  const list = SIMPLE_LISTS.find((l) => l.path === key);
  if (!list) return res.status(404).json({ error: 'No such list' });
  const result = await pool.query(`select name from ${list.table} order by name`);
  res.json({ items: result.rows });
});
