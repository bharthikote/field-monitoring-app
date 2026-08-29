alter table user_locations add column if not exists mode text not null default 'include'
  check (mode in ('include', 'exclude'));
