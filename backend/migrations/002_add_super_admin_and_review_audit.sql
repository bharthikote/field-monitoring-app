-- The role-check widening that used to live here is superseded by
-- 012_add_leadership_role.sql, which is now the single source of truth
-- for the full role list. Narrowing it here on every replay used to
-- break once a 'leadership' row existed, since migrate.js has no
-- tracking table and re-runs every file from scratch each time.

alter table users add column if not exists reviewed_by uuid references users(id);
alter table users add column if not exists reviewed_at timestamptz;
