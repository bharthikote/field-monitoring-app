-- Actual Cost/Return: unlike Expected Cost/Return (one upserted row per
-- item), these are proper transaction ledgers - a farmer applies Urea on
-- 3 different dates, or harvests 3 times, and every one of those is its
-- own independent, dated row. Deliberately no unique(demo_id, item_id) -
-- that constraint is exactly what Expected Cost/Return needed and exactly
-- what these must NOT have.
create table tfo_demo_actual_costs (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references tfo_demos(id) on delete cascade,
  activity_id uuid not null references activities(id),
  item_id uuid not null references activity_items(id),
  activity_date date not null,
  quantity numeric not null check (quantity >= 0),
  unit_id uuid not null references units(id),
  actual_price numeric not null default 0 check (actual_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tfo_demo_actual_costs_demo_id_idx on tfo_demo_actual_costs (demo_id);

create table tfo_demo_actual_returns (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references tfo_demos(id) on delete cascade,
  activity_return_id uuid not null references activity_returns(id),
  item_id uuid not null references activity_return_items(id),
  activity_date date not null,
  quantity numeric not null check (quantity >= 0),
  unit_id uuid not null references units(id),
  unit_price numeric not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tfo_demo_actual_returns_demo_id_idx on tfo_demo_actual_returns (demo_id);
