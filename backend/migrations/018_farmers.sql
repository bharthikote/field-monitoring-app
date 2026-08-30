-- Farmers master list. Additive alongside demo_plots/trainings, which keep
-- their own farmer_name/farmer_phone/village_id columns unchanged (reports.js
-- and the web admin panel read those directly) - this table becomes the
-- single source of truth for identity/village going forward, linked via a
-- new farmer_id FK on each activity table.
create table if not exists farmers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  village_id uuid not null references villages(id),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

-- One farmer per distinct phone seen across demo_plots and trainings, using
-- the earliest activity's name/village/creator as canonical - matches the
-- "farmer's earliest plot is canonical" rule already enforced in app code
-- (CreateDemoPlotScreen's village-lock feature).
insert into farmers (name, phone, village_id, created_by, created_at)
select distinct on (phone) name, phone, village_id, created_by, created_at
from (
  select farmer_name as name, farmer_phone as phone, village_id, created_by, created_at from demo_plots
  union all
  select farmer_name as name, farmer_phone as phone, village_id, created_by, created_at from trainings
) all_activities
order by phone, created_at asc
on conflict (phone) do nothing;

alter table demo_plots add column if not exists farmer_id uuid references farmers(id);
update demo_plots dp set farmer_id = f.id from farmers f where f.phone = dp.farmer_phone and dp.farmer_id is null;
alter table demo_plots alter column farmer_id set not null;

alter table trainings add column if not exists farmer_id uuid references farmers(id);
update trainings tr set farmer_id = f.id from farmers f where f.phone = tr.farmer_phone and tr.farmer_id is null;
alter table trainings alter column farmer_id set not null;

create index if not exists demo_plots_farmer_id_idx on demo_plots (farmer_id);
create index if not exists trainings_farmer_id_idx on trainings (farmer_id);
