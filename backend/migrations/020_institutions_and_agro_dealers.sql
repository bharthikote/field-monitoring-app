-- Institutional Visit and Agro Dealer Visit activities (PRD Section 6),
-- built from the Kobo form's grp_govt/grp_agriinput groups - modified per
-- the user's explicit request: instead of typing/picking the institute or
-- dealer name fresh on every visit, each gets its own simple profile
-- (name + village) created once and reused, same "profile then visit"
-- shape as farmers -> Training/Field Day.

create table if not exists institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_type text not null check (org_type in ('kvk', 'icar', 'university', 'horticulture', 'others')),
  org_type_other text,
  village_id uuid not null references villages(id),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index if not exists institutions_village_id_idx on institutions (village_id);

create table if not exists institution_visits (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  observations text,
  photo_url text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index if not exists institution_visits_institution_id_idx on institution_visits (institution_id);

-- Purpose of Visit is a small fixed Kobo choice list (not a growing master
-- list), multi-select with a free-text "Others" escape hatch - the typed
-- text is substituted client-side in place of the sentinel before it's
-- sent, so this just stores whatever strings arrive, no separate "other"
-- column needed.
create table if not exists institution_visit_purposes (
  institution_visit_id uuid not null references institution_visits(id) on delete cascade,
  purpose text not null,
  primary key (institution_visit_id, purpose)
);

create table if not exists agro_dealers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  village_id uuid not null references villages(id),
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index if not exists agro_dealers_village_id_idx on agro_dealers (village_id);

create table if not exists agro_dealer_visits (
  id uuid primary key default gen_random_uuid(),
  dealer_id uuid not null references agro_dealers(id),
  observations text,
  photo_url text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index if not exists agro_dealer_visits_dealer_id_idx on agro_dealer_visits (dealer_id);

create table if not exists agro_dealer_visit_purposes (
  agro_dealer_visit_id uuid not null references agro_dealer_visits(id) on delete cascade,
  purpose text not null,
  primary key (agro_dealer_visit_id, purpose)
);
