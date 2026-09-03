-- Business Plan master data: Activity -> Activity Item, each Item scoped to
-- specific countries and carrying one or more applicable units. Consumed
-- later by the mobile Business Plan (not built yet) - this migration only
-- establishes the Super Admin-managed master configuration.

create table activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- Same shape as the other simple master lists (seasons, training_topics,
-- etc.) - plugs into the existing generic SIMPLE_LISTS mechanism, so Units
-- gets a full Super Admin CRUD page for free.
create table units (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table units_countries (
  item_id uuid not null references units(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

-- No uniqueness on (activity_id, name) - the same item name (e.g. "Labour")
-- legitimately recurs under multiple activities.
create table activity_items (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id),
  name text not null,
  remark text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- Deliberately NOT the generic masterDataScope.js pattern (empty = global) -
-- an Activity Item must be explicitly assigned at least one country, so
-- this is enforced at the route level, not left to an "unrestricted by
-- default" convention.
create table activity_item_countries (
  item_id uuid not null references activity_items(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table activity_item_units (
  item_id uuid not null references activity_items(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  primary key (item_id, unit_id)
);

create index activity_items_activity_id_idx on activity_items (activity_id);
