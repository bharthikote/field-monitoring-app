-- Field Day activity (PRD Section 6), built from the Field Day Observation
-- group of the Kobo form. One entry per farmer per field day, same shape as
-- trainings - a single log, not a persistent plot with repeat visits.
create table if not exists field_days (
  id uuid primary key default gen_random_uuid(),
  farmer_id uuid not null references farmers(id),
  farmer_name text not null,
  farmer_phone text not null,
  village_id uuid not null references villages(id),
  fieldday_type text not null check (fieldday_type in ('practical', 'theory', 'both')),
  interaction_quality int not null check (interaction_quality between 1 and 5),
  roi_discussion text not null check (roi_discussion in ('both', 'roi_only', 'biz_only', 'not_discussed')),
  sales_team_attended boolean not null,
  sales_person_name text,
  expected_harvest_date date not null,
  remarks text,
  photo_url text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index if not exists field_days_village_id_idx on field_days (village_id);
create index if not exists field_days_farmer_id_idx on field_days (farmer_id);
