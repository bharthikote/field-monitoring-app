-- TFO's Home Garden flow - same architecture as tfo_demos/tfo_demo_crops
-- (migration 029): a site-level parent plus repeatable per-crop rows, kept
-- as its own entity since Home Garden's site fields (land type, compost,
-- site id) and crop fields (no per-crop irrigation/season/counts, just
-- seedlings + dates + optional container/plant numbers) genuinely differ
-- from a Demo's.
create table tfo_home_gardens (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references farmers(id),
  village_id uuid not null references villages(id),
  created_by uuid not null references users(id),
  gps_lat numeric not null,
  gps_lng numeric not null,
  cycle text not null check (cycle in (
    'demo_1', 'homegarden_1', 'homegarden_2', 'homegarden_3',
    'adoption_1', 'adoption_2', 'adoption_3', 'adoption_4'
  )),
  area numeric not null check (area >= 0),
  land_type text not null check (land_type in ('own', 'lease_rented')),
  compost boolean not null,
  irrigation_system text not null check (irrigation_system in ('hand_watering', 'drip_irrigation', 'sprinkler', 'rainfed')),
  field_condition text not null check (field_condition in ('sandy', 'sandy_loam', 'loamy', 'clay')),
  site_id text not null,
  created_at timestamptz not null default now()
);

create table tfo_home_garden_crops (
  id uuid primary key default gen_random_uuid(),
  home_garden_id uuid not null references tfo_home_gardens(id) on delete cascade,
  crop_id uuid not null references crops(id),
  variety_id uuid not null references varieties(id),
  no_of_seedlings integer not null check (no_of_seedlings >= 0),
  sowing_date date not null,
  transplant_date date not null,
  harvest_date date not null,
  container_number text,
  plant_number text,
  created_at timestamptz not null default now(),
  check (sowing_date <= transplant_date and transplant_date <= harvest_date)
);

create index tfo_home_gardens_farmer_id_idx on tfo_home_gardens (farmer_id);
create index tfo_home_garden_crops_home_garden_id_idx on tfo_home_garden_crops (home_garden_id);
