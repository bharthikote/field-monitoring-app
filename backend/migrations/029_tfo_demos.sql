-- TFO's own richer Demo flow (per the vendor app's "Add Demo" screen) -
-- deliberately a separate entity from demo_plots (the higher-role flow's
-- single-crop-per-row table): one demo here can carry several crops, plus
-- GPS/land-size/soil fields demo_plots has no room for.
create table tfo_demos (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references farmers(id),
  village_id uuid not null references villages(id),
  created_by uuid not null references users(id),
  gps_lat numeric not null,
  gps_lng numeric not null,
  cycle text not null check (cycle in (
    'demo_1', 'demo_2', 'demo_3', 'demo_4',
    'adoption_1', 'adoption_2', 'adoption_3', 'adoption_4'
  )),
  own_area numeric not null check (own_area >= 0),
  rent_area numeric not null check (rent_area >= 0),
  soil_ph numeric not null check (soil_ph >= 0 and soil_ph <= 14),
  soil_type text not null check (soil_type in ('sandy', 'sandy_loam', 'loamy', 'clay')),
  created_at timestamptz not null default now()
);

-- One demo can carry multiple crops (per farmer, this is not a hard rule -
-- a single-crop demo is just a demo with one row here).
create table tfo_demo_crops (
  id uuid primary key default gen_random_uuid(),
  demo_id uuid not null references tfo_demos(id) on delete cascade,
  crop_id uuid not null references crops(id),
  variety_id uuid not null references varieties(id),
  season_id uuid not null references seasons(id),
  crop_area numeric not null check (crop_area >= 0),
  no_of_seeding integer not null check (no_of_seeding >= 0),
  sowing_date date not null,
  transplant_date date not null,
  est_harvest_date date not null,
  irrigation_system text not null check (irrigation_system in ('hand_watering', 'drip_irrigation', 'sprinkler', 'rainfed')),
  no_transplanted integer check (no_transplanted >= 0),
  no_harvested integer check (no_harvested >= 0),
  created_at timestamptz not null default now(),
  -- Sowing -> transplant -> harvest is a fixed real-world sequence, and each
  -- stage's surviving count can only ever shrink from the one before it
  -- (plants lost to disease/weather along the way, never gained).
  check (sowing_date <= transplant_date and transplant_date <= est_harvest_date),
  check (no_transplanted is null or no_transplanted <= no_of_seeding),
  check (no_harvested is null or no_transplanted is null or no_harvested <= no_transplanted)
);

create index tfo_demos_farmer_id_idx on tfo_demos (farmer_id);
create index tfo_demo_crops_demo_id_idx on tfo_demo_crops (demo_id);
