-- Some genuine issues can never be "resolved" - a demo plot that isn't visible
-- from the main road is a fact about the site, not something a TFO can fix.
-- Those are acknowledged (by a Team Lead) instead, which closes them.
-- Flagged per issue type in Master Lists, not per issue, so it stays a
-- deliberate Super Admin decision rather than something a raiser picks.
alter table issue_types add column if not exists acknowledge_only boolean not null default false;
