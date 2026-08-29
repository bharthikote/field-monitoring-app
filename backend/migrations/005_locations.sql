create table if not exists countries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists states (
  id uuid primary key default gen_random_uuid(),
  country_id uuid not null references countries(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (country_id, name)
);

create table if not exists districts (
  id uuid primary key default gen_random_uuid(),
  state_id uuid not null references states(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (state_id, name)
);

create table if not exists blocks (
  id uuid primary key default gen_random_uuid(),
  district_id uuid not null references districts(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (district_id, name)
);

create table if not exists villages (
  id uuid primary key default gen_random_uuid(),
  block_id uuid not null references blocks(id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (block_id, name)
);

alter table users add column if not exists location_level text
  check (location_level in ('country', 'state', 'district', 'block', 'village'));
alter table users add column if not exists country_id uuid references countries(id);
alter table users add column if not exists state_id uuid references states(id);
alter table users add column if not exists district_id uuid references districts(id);
alter table users add column if not exists block_id uuid references blocks(id);
alter table users add column if not exists village_id uuid references villages(id);
