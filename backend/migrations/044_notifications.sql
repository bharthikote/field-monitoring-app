create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  issue_id uuid references issues(id) on delete cascade,
  type text not null check (type in ('issue_assigned', 'issue_resolved', 'issue_verified', 'issue_reopened')),
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id, created_at desc);
