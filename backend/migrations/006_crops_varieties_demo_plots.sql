create table if not exists crops (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists varieties (
  id uuid primary key default gen_random_uuid(),
  crop_id uuid not null references crops(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (crop_id, name)
);

create table if not exists demo_plots (
  id uuid primary key default gen_random_uuid(),
  farmer_name text not null,
  farmer_phone text not null,
  crop_id uuid not null references crops(id),
  variety_id uuid not null references varieties(id),
  village_id uuid not null references villages(id),
  demo_status text not null default 'ongoing'
    check (demo_status in ('ongoing', 'completed', 'terminated')),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists demo_plots_farmer_phone_idx on demo_plots (farmer_phone);
