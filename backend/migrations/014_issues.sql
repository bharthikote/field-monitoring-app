create table if not exists issues (
  id uuid primary key default gen_random_uuid(),
  demo_plot_id uuid not null references demo_plots(id),
  issue_type_id uuid not null references issue_types(id),
  photo_url text,
  raised_by uuid not null references users(id),
  assigned_to uuid references users(id),
  status text not null default 'raised'
    check (status in ('raised', 'assigned', 'in_progress', 'pending_verification', 'closed')),
  resolution_note text,
  rejection_note text,
  reopened_count int not null default 0,
  verified_by uuid references users(id),
  created_at timestamptz not null default now(),
  assigned_at timestamptz,
  started_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz
);

create index if not exists issues_assigned_to_idx on issues(assigned_to);
create index if not exists issues_raised_by_idx on issues(raised_by);
