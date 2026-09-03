-- Nutrient Master: plain named list (Nitrogen, Phosphorus, Potash, ...),
-- same shape as every other simple master list - plugs into the existing
-- generic SIMPLE_LISTS mechanism for a free Super Admin CRUD page.
create table nutrients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);
create table nutrients_countries (
  item_id uuid not null references nutrients(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);
insert into nutrients (name) values ('Nitrogen'), ('Phosphorus'), ('Potash');

-- Nutrient Configuration Master: a named composition (e.g. "Urea") made up
-- of one or more nutrient percentages. Distinct from the Activity Item
-- Master - an Activity Item references a configuration, it doesn't embed
-- one. Soft-deleted like activities/activity_items, so a later Business
-- Plan reference (not built yet) can't be broken by a master-data edit.
create table nutrient_configurations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

-- No total-must-equal-100 constraint, deliberately - a product's nutrient
-- percentages need not sum to 100% (carrier/filler material makes up the
-- rest). unique(configuration_id, nutrient_id) prevents the same nutrient
-- appearing twice in one configuration.
create table nutrient_configuration_components (
  id uuid primary key default gen_random_uuid(),
  configuration_id uuid not null references nutrient_configurations(id) on delete cascade,
  nutrient_id uuid not null references nutrients(id),
  percentage numeric not null check (percentage >= 0 and percentage <= 100),
  unique (configuration_id, nutrient_id)
);

-- Activity Item <-> Nutrient Configuration link. The CHECK constraint
-- mirrors the same rule enforced in the route layer (Is Nutrient = Yes
-- requires a configuration; No requires none) so it holds even if a future
-- caller bypasses the route validation.
alter table activity_items add column is_nutrient boolean not null default false;
alter table activity_items add column nutrient_configuration_id uuid references nutrient_configurations(id);
alter table activity_items add constraint activity_items_nutrient_check check (
  (is_nutrient = false and nutrient_configuration_id is null) or
  (is_nutrient = true and nutrient_configuration_id is not null)
);

-- Seed configurations matching the spec's worked examples.
insert into nutrient_configurations (name) values ('Urea'), ('DAP'), ('MOP');

-- Only the non-zero components are stored - matches how the "+Add
-- Nutrient" UI actually builds a configuration (add what's present, not a
-- fixed 3-row grid padded with 0% entries for everything absent).
insert into nutrient_configuration_components (configuration_id, nutrient_id, percentage)
select nc.id, n.id, v.percentage
from (values
  ('Urea', 'Nitrogen', 46),
  ('DAP', 'Nitrogen', 18), ('DAP', 'Phosphorus', 46),
  ('MOP', 'Potash', 60)
) as v(config_name, nutrient_name, percentage)
join nutrient_configurations nc on nc.name = v.config_name
join nutrients n on n.name = v.nutrient_name;

-- Seed a realistic Fertilization activity so the nutrient/non-nutrient
-- classification is immediately testable end to end (per spec section 16) -
-- three nutrient items linked to the configurations above, plus one
-- non-nutrient item, assigned to whatever countries/units already exist.
insert into units (name) values ('Kilogram') on conflict (name) do nothing;

do $$
declare
  v_activity_id uuid;
  v_urea_config_id uuid;
  v_dap_config_id uuid;
  v_mop_config_id uuid;
  v_urea_item_id uuid;
  v_dap_item_id uuid;
  v_mop_item_id uuid;
  v_labour_item_id uuid;
  v_country_id uuid;
  v_kg_unit_id uuid;
  v_labour_unit_id uuid;
begin
  select id into v_urea_config_id from nutrient_configurations where name = 'Urea';
  select id into v_dap_config_id from nutrient_configurations where name = 'DAP';
  select id into v_mop_config_id from nutrient_configurations where name = 'MOP';
  select id into v_kg_unit_id from units where name = 'Kilogram';

  insert into activities (name) values ('Fertilization') returning id into v_activity_id;

  insert into activity_items (activity_id, name, is_nutrient, nutrient_configuration_id)
    values (v_activity_id, 'Urea', true, v_urea_config_id) returning id into v_urea_item_id;
  insert into activity_items (activity_id, name, is_nutrient, nutrient_configuration_id)
    values (v_activity_id, 'DAP', true, v_dap_config_id) returning id into v_dap_item_id;
  insert into activity_items (activity_id, name, is_nutrient, nutrient_configuration_id)
    values (v_activity_id, 'MOP', true, v_mop_config_id) returning id into v_mop_item_id;
  insert into activity_items (activity_id, name, is_nutrient)
    values (v_activity_id, 'Labour Hired', false) returning id into v_labour_item_id;

  for v_country_id in select id from countries loop
    insert into activity_item_countries (item_id, country_id) values (v_urea_item_id, v_country_id);
    insert into activity_item_countries (item_id, country_id) values (v_dap_item_id, v_country_id);
    insert into activity_item_countries (item_id, country_id) values (v_mop_item_id, v_country_id);
    insert into activity_item_countries (item_id, country_id) values (v_labour_item_id, v_country_id);
  end loop;

  if v_kg_unit_id is not null then
    insert into activity_item_units (item_id, unit_id) values (v_urea_item_id, v_kg_unit_id);
    insert into activity_item_units (item_id, unit_id) values (v_dap_item_id, v_kg_unit_id);
    insert into activity_item_units (item_id, unit_id) values (v_mop_item_id, v_kg_unit_id);
  end if;

  for v_labour_unit_id in select id from units where name in ('Day', 'Hour') loop
    insert into activity_item_units (item_id, unit_id) values (v_labour_item_id, v_labour_unit_id);
  end loop;
end $$;
