-- Projects: a new top-level entity with its own status lifecycle
-- (ongoing/completed/terminated - mirrors tfo_demos' own status convention
-- rather than the generic active/inactive soft-delete pattern, since a
-- Project's business status IS ongoing/completed/terminated, not a
-- visibility flag).
create table projects (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  country_id uuid not null references countries(id),
  start_date date not null,
  end_date date not null,
  target_farmer_trained integer check (target_farmer_trained is null or target_farmer_trained >= 0),
  target_key_farmer_trained integer check (target_key_farmer_trained is null or target_key_farmer_trained >= 0),
  target_core_farmer_trained integer check (target_core_farmer_trained is null or target_core_farmer_trained >= 0),
  target_demo integer check (target_demo is null or target_demo >= 0),
  target_knowledge_acquisition integer check (target_knowledge_acquisition is null or target_knowledge_acquisition >= 0),
  status text not null default 'ongoing' check (status in ('ongoing', 'completed', 'terminated')),
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

-- Deliberately NOT a copy of user_locations' include/exclude shape - a
-- Project's location set is just an explicit flat list (whatever nodes,
-- at whatever levels, were ticked), no "cover this whole country except
-- one district" carve-out semantics. The existing global user_locations
-- table is untouched - this is a separate, additive relationship.
create table project_locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  level text not null check (level in ('country', 'state', 'district', 'block', 'village')),
  location_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  unique (project_id, level, location_id)
);
create index project_locations_project_id_idx on project_locations (project_id);

-- Project membership - which users work on which projects. The unique
-- pair is also the FK target for project_user_locations below, so a
-- user+project location can only ever exist if that user is actually a
-- member of that project (enforced at the DB level, not just in the API).
create table project_users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  unique (project_id, user_id)
);
create index project_users_project_id_idx on project_users (project_id);
create index project_users_user_id_idx on project_users (user_id);

-- The third level: which of a project's locations a specific project
-- member actually covers. Validated in the API against project_locations
-- (a user can never receive a location the project itself doesn't have),
-- and the composite FK below means that even a direct DB write can't
-- create one for a non-member.
create table project_user_locations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null,
  user_id uuid not null,
  level text not null check (level in ('country', 'state', 'district', 'block', 'village')),
  location_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid references users(id),
  unique (project_id, user_id, level, location_id),
  foreign key (project_id, user_id) references project_users (project_id, user_id) on delete cascade
);
create index project_user_locations_project_user_idx on project_user_locations (project_id, user_id);
