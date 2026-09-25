-- Flat routing (any raiser -> the TFO for that village), a dispute-
-- authenticity path, and chainable reassignment when the assignee isn't
-- actually the responsible party (e.g. a missing crop board that was
-- someone else's job to supply). See conversation for the full design.

alter table issues drop constraint if exists issues_status_check;
alter table issues add constraint issues_status_check
  check (status in ('raised', 'assigned', 'in_progress', 'pending_verification', 'disputed', 'closed', 'dismissed'));

-- Who actually did the resolving - needed because assigned_to gets
-- repurposed to hold the verifier's id during pending_verification, so it
-- no longer points at the person whose work is being verified.
alter table issues add column if not exists resolved_by uuid references users(id);

alter table issues add column if not exists dispute_note text;
alter table issues add column if not exists disputed_at timestamptz;
alter table issues add column if not exists dismissal_note text;
alter table issues add column if not exists dismissed_at timestamptz;

-- Full reassignment history (chainable - each hop is its own row), not
-- just the latest one, so a pattern of an issue bouncing around is visible.
create table if not exists issue_reassignments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references issues(id) on delete cascade,
  from_user_id uuid not null references users(id),
  to_user_id uuid not null references users(id),
  comment text not null,
  created_at timestamptz not null default now()
);

create index if not exists issue_reassignments_issue_id_idx on issue_reassignments (issue_id);

alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in (
    'issue_assigned', 'issue_resolved', 'issue_verified', 'issue_reopened',
    'issue_disputed', 'issue_dismissed', 'issue_reassigned'
  ));
