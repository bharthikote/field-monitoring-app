-- Leadership: PRD Section 2 - "All countries, view/reporting access only."
-- The web login gate now lets this role in (previously Admin/Super Admin
-- only), scoped to just the Reports section.
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('tfo', 'supervisor', 'team_lead', 'country_manager', 'admin', 'super_admin', 'leadership'));
