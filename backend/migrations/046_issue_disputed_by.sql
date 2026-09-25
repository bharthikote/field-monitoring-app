-- assigned_to gets overwritten to the reviewing Supervisor's id the moment
-- an issue is disputed, so the person who actually raised the dispute
-- would otherwise be lost - needed to notify them of the review outcome.
alter table issues add column if not exists disputed_by uuid references users(id);
