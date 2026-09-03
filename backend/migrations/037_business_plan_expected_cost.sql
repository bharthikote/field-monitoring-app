-- Currency is a property of the country, needed so the mobile Expected
-- Cost screen can show amounts in the right local currency automatically
-- instead of hardcoding THB. Real ISO 4217 codes for the 13-country list
-- plus the pre-existing Nepal; Dummy Country deliberately left null (dev/
-- test only, never a real production country - see migration 035).
alter table countries add column currency_code text;

update countries set currency_code = v.code
from (values
  ('Bangladesh', 'BDT'), ('Cambodia', 'KHR'), ('Ghana', 'GHS'), ('India', 'INR'),
  ('Indonesia', 'IDR'), ('Laos', 'LAK'), ('Myanmar', 'MMK'), ('Nigeria', 'NGN'),
  ('Philippines', 'PHP'), ('South Sudan', 'SSP'), ('Tanzania', 'TZS'), ('Thailand', 'THB'),
  ('Uganda', 'UGX'), ('Nepal', 'NPR')
) as v(name, code)
where countries.name = v.name;

-- A TFO's saved Expected Cost entry for one Activity Item under one demo.
-- unique(demo_id, item_id) is the "consolidate duplicate item" rule from
-- the spec, enforced at the data layer via upsert (ON CONFLICT) rather
-- than left to the UI alone - re-adding an item the farmer already entered
-- always updates that same row instead of creating a second visible entry.
-- activity_id is redundant with item_id's own FK (an item belongs to
-- exactly one activity) but kept as a plain column for cheap query/index
-- access without an extra join, and to match the spec's own "Activity +
-- Item" phrasing for the uniqueness rule.
create table tfo_demo_expected_costs (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references tfo_demos(id) on delete cascade,
  activity_id uuid not null references activities(id),
  item_id uuid not null references activity_items(id),
  quantity numeric not null check (quantity >= 0),
  unit_id uuid not null references units(id),
  farmer_price numeric not null default 0 check (farmer_price >= 0),
  loan_price numeric not null default 0 check (loan_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (demo_id, item_id)
);
create index tfo_demo_expected_costs_demo_id_idx on tfo_demo_expected_costs (demo_id);
