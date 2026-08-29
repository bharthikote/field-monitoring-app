create table if not exists user_locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  level text not null check (level in ('country', 'state', 'district', 'block', 'village')),
  location_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  unique (user_id, level, location_id)
);

-- Migrate existing single-path assignments into the new multi-assignment table.
insert into user_locations (user_id, level, location_id, created_by)
select id, location_level,
  coalesce(village_id, block_id, district_id, state_id, country_id),
  reviewed_by
from users
where location_level is not null
on conflict do nothing;

alter table users drop column if exists location_level;
alter table users drop column if exists country_id;
alter table users drop column if exists state_id;
alter table users drop column if exists district_id;
alter table users drop column if exists block_id;
alter table users drop column if exists village_id;
