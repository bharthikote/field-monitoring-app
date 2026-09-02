alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check
  check (role in ('tfo', 'supervisor', 'team_lead', 'country_manager', 'admin', 'super_admin', 'leadership', 'data_enumerator'));
