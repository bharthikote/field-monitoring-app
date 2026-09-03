-- New simple master list (same shape as training_topics/diseases/etc.),
-- country-scoped like every other master list via the generic
-- <table>_countries mechanism in masterDataScope.js.
create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table if not exists seasons_countries (
  item_id uuid not null references seasons(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

-- Sensible starting defaults (unscoped - visible to every country until
-- Super Admin restricts or renames them from Master Lists).
insert into seasons (name) values ('Kharif'), ('Rabi'), ('Summer'), ('Winter')
on conflict (name) do nothing;
