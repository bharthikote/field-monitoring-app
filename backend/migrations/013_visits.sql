-- Light Visit Form (PRD Section 6), built from the Demo Plot Observation
-- section of the existing Kobo form. One visit is logged against an
-- existing demo plot; issues/good-things observed are multi-select from
-- the master lists, each with its own optional evidence photo, matching
-- how the current form captures it.
create table if not exists visits (
  id uuid primary key default gen_random_uuid(),
  demo_plot_id uuid not null references demo_plots(id),
  visited_by uuid not null references users(id),
  action_plan text not null,
  comments text not null,
  overall_photo_url text not null,
  disease_id uuid references diseases(id),
  disease_other text,
  disease_photo_url text,
  pest_id uuid references pests(id),
  pest_other text,
  pest_photo_url text,
  created_at timestamptz not null default now()
);

create index if not exists visits_demo_plot_id_idx on visits (demo_plot_id);

create table if not exists visit_issues (
  visit_id uuid not null references visits(id) on delete cascade,
  issue_type_id uuid not null references issue_types(id),
  photo_url text,
  primary key (visit_id, issue_type_id)
);

create table if not exists visit_good_things (
  visit_id uuid not null references visits(id) on delete cascade,
  good_thing_id uuid not null references good_things_observed(id),
  photo_url text,
  primary key (visit_id, good_thing_id)
);
