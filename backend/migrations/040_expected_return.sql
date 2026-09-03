-- Mirrors tfo_demo_expected_costs (migration 037) exactly in shape, for
-- the Return side: quantity/unit/unit_price instead of farmer/loan prices.
-- Total is never stored (quantity * unit_price, computed at read time),
-- same convention as Cost not storing farmer_price + loan_price anywhere.
create table tfo_demo_expected_returns (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references tfo_demos(id) on delete cascade,
  activity_return_id uuid not null references activity_returns(id),
  item_id uuid not null references activity_return_items(id),
  quantity numeric not null check (quantity >= 0),
  unit_id uuid not null references units(id),
  unit_price numeric not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demo_id, item_id)
);
create index tfo_demo_expected_returns_demo_id_idx on tfo_demo_expected_returns (demo_id);
