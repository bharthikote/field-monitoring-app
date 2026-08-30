alter table demo_plots add column if not exists plot_type text not null default 'demo'
  check (plot_type in ('demo', 'adoption'));

create table if not exists visit_techniques (
  visit_id uuid not null references visits(id) on delete cascade,
  technique_id uuid not null references techniques(id),
  primary key (visit_id, technique_id)
);
