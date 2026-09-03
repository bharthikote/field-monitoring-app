-- Realistic master seed data for Activity Cost / Nutrient Configuration,
-- per the user's reviewed and corrected spec (not a blind copy of the
-- reference screenshots - several records there were placeholders or
-- inconsistent, e.g. mixed Labor/Labour spelling and fertilizer names
-- shown as "the nutrient" instead of their actual composition).
--
-- Non-destructive throughout: never deletes or renames a country, never
-- removes an existing activity/item/link - only adds what's missing and
-- (where the user explicitly asked for a terminology cleanup) renames a
-- couple of existing item labels without touching their id/relationships.

-- --- Countries: add the real 13-country list. Existing rows (India,
-- Nepal, Dummy Country) are untouched - Nepal isn't in the user's list but
-- deleting it risks breaking villages/users/farmers already under it from
-- earlier testing, so it's simply left alone rather than removed.
insert into countries (name)
select v.name from (values
  ('Bangladesh'), ('Cambodia'), ('Ghana'), ('India'), ('Indonesia'), ('Laos'),
  ('Myanmar'), ('Nigeria'), ('Philippines'), ('South Sudan'), ('Tanzania'), ('Thailand'), ('Uganda')
) as v(name)
where not exists (select 1 from countries c where c.name = v.name);

-- --- Units: rename the existing "Kilogram" to the shorter "Kilo" the spec
-- uses throughout (safe - renames the row, doesn't touch its id, so
-- anything already linked to it keeps working), then add the rest of the
-- unit vocabulary the spec's item tables actually use.
update units set name = 'Kilo' where name = 'Kilogram';

insert into units (name)
select v.name from (values
  ('Gram'), ('Ton'), ('Liter'), ('Ml'), ('Meter'), ('Roll'), ('Piece'),
  ('Square feet'), ('Square meter'), ('Viss'), ('Time')
) as v(name)
where not exists (select 1 from units u where u.name = v.name);

-- --- Nutrient Configurations: Urea/DAP/MOP already exist (migration 034).
-- Add the rest the Fertilization seed below references. Percentages follow
-- the same "only non-zero components stored" convention as before.
insert into nutrient_configurations (name)
select v.name from (values ('13-0-45'), ('NPK 16-16-16'), ('MAP 11-52-0'), ('NPK 14-14-14')) as v(name)
where not exists (select 1 from nutrient_configurations nc where nc.name = v.name);

insert into nutrient_configuration_components (configuration_id, nutrient_id, percentage)
select nc.id, n.id, v.percentage
from (values
  ('13-0-45', 'Nitrogen', 13), ('13-0-45', 'Potash', 45),
  ('NPK 16-16-16', 'Nitrogen', 16), ('NPK 16-16-16', 'Phosphorus', 16), ('NPK 16-16-16', 'Potash', 16),
  ('MAP 11-52-0', 'Nitrogen', 11), ('MAP 11-52-0', 'Phosphorus', 52),
  ('NPK 14-14-14', 'Nitrogen', 14), ('NPK 14-14-14', 'Phosphorus', 14), ('NPK 14-14-14', 'Potash', 14)
) as v(config_name, nutrient_name, percentage)
join nutrient_configurations nc on nc.name = v.config_name
join nutrients n on n.name = v.nutrient_name
where not exists (
  select 1 from nutrient_configuration_components ncc
  where ncc.configuration_id = nc.id and ncc.nutrient_id = n.id
);

-- --- Clean up terminology on the two pre-existing Fertilization items the
-- spec renames (id/relationships untouched, only the label changes) and
-- extend their country/unit coverage now that the real country list
-- exists - they were seeded "All" back when only India/Nepal/Dummy Country
-- were available, so "All" needs the new real countries added to actually
-- mean all of them.
update activity_items set name = 'MOP (0-0-60)' where name = 'MOP' and activity_id = (select id from activities where name = 'Fertilization');
update activity_items set name = 'Labor hired' where name = 'Labour Hired' and activity_id = (select id from activities where name = 'Fertilization');

insert into activity_item_countries (item_id, country_id)
select ai.id, c.id
from activity_items ai
join activities a on a.id = ai.activity_id and a.name = 'Fertilization'
join countries c on c.name != 'Dummy Country'
where ai.name in ('Urea', 'DAP', 'Labor hired')
  and not exists (select 1 from activity_item_countries aic where aic.item_id = ai.id and aic.country_id = c.id);

insert into activity_item_countries (item_id, country_id)
select ai.id, c.id
from activity_items ai
join activities a on a.id = ai.activity_id and a.name = 'Fertilization'
join countries c on c.name in ('Cambodia', 'Indonesia', 'Myanmar', 'Nigeria', 'Philippines', 'Tanzania', 'Thailand', 'Uganda')
where ai.name = 'MOP (0-0-60)'
  and not exists (select 1 from activity_item_countries aic where aic.item_id = ai.id and aic.country_id = c.id);

insert into activity_item_units (item_id, unit_id)
select ai.id, u.id
from activity_items ai
join activities a on a.id = ai.activity_id and a.name = 'Fertilization'
join units u on u.name in ('Kilo', 'Gram', 'Liter')
where ai.name in ('Urea', 'DAP', 'MOP (0-0-60)')
  and not exists (select 1 from activity_item_units aiu where aiu.item_id = ai.id and aiu.unit_id = u.id);

-- --- The rest of the seed: every other activity/item from the spec,
-- data-driven so the same get-or-create logic handles all of them at once
-- rather than 60+ near-identical hand-written blocks. Skips anything that
-- already exists by (activity name, item name), so re-running this
-- migration file (it never runs twice under normal operation, but just in
-- case) can't create duplicates.
do $$
declare
  v_activity_id uuid;
  v_item_id uuid;
  v_config_id uuid;
  rec record;
begin
  for rec in
    select * from (values
      -- activity_name, item_name, unit_list (comma-separated, '' = none), country_mode ('ALL' or comma-separated), nutrient_config_name
      ('Seedling Production', 'Labor hired', 'Day,Hour', 'ALL', null),
      ('Seedling Production', 'Manure', 'Ton,Kilo', 'ALL', null),
      ('Seedling Production', 'Net insects', 'Meter,Roll', 'ALL', null),
      ('Seedling Production', 'Other', '', 'Dummy Country', null),
      ('Seedling Production', 'Seeds cost', 'Gram', 'ALL', null),
      ('Seedling Production', 'Seedling cost', '', 'Bangladesh,Cambodia,Ghana,India,Laos,Myanmar,Nigeria,Philippines,South Sudan,Tanzania,Thailand,Uganda', null),
      ('Seedling Production', 'Seed nursery plastic bags', 'Kilo,Piece', 'ALL', null),
      ('Seedling Production', 'Substrate', 'Kilo', 'ALL', null),
      ('Seedling Production', 'Seed tray', 'Piece', 'ALL', null),
      ('Seedling Production', 'Shading net', 'Kilo,Roll', 'Bangladesh,Cambodia,Ghana,India,Laos,Myanmar,Nigeria,Philippines,South Sudan,Tanzania,Thailand,Uganda', null),

      ('Land Preparation', 'Bed preparation', 'Day,Hour', 'ALL', null),
      ('Land Preparation', 'Clearing', 'Day,Hour', 'ALL', null),
      ('Land Preparation', 'Gasoil- fuel', 'Liter', 'ALL', null),
      ('Land Preparation', 'Labor hired', 'Day,Hour', 'ALL', null),
      ('Land Preparation', 'Lime', 'Kilo,Liter', 'ALL', null),
      ('Land Preparation', 'Manure', 'Kilo', 'ALL', null),
      ('Land Preparation', 'Others', '', 'Dummy Country', null),
      ('Land Preparation', 'Ploughing', 'Day,Hour', 'ALL', null),
      ('Land Preparation', 'Soil treatment', 'Square feet,Square meter', 'ALL', null),
      ('Land Preparation', 'Fencing', 'Piece', 'Ghana', null),

      ('Mulch', 'Bamboo Stick', 'Piece', 'ALL', null),
      ('Mulch', 'Labor hired', 'Day,Hour', 'ALL', null),
      ('Mulch', 'Others', 'Meter', 'Dummy Country', null),
      ('Mulch', 'Plastic material', 'Meter', 'ALL', null),
      ('Mulch', 'Straw material', 'Kilo,Roll', 'ALL', null),
      ('Mulch', 'Transport', 'Hour,Time', 'ALL', null),
      ('Mulch', 'Other mulch material', 'Kilo,Piece,Roll', 'ALL', null),

      ('Trellis', 'Bamboo', 'Piece', 'Bangladesh,Cambodia,Ghana,India,Indonesia,Laos,Myanmar,Nigeria,Philippines,Tanzania,Thailand,Uganda', null),
      ('Trellis', 'Labor hired', 'Day,Hour', 'ALL', null),
      ('Trellis', 'Nails', 'Kilo,Gram', 'ALL', null),
      ('Trellis', 'Other', '', 'Dummy Country', null),
      ('Trellis', 'Rope/ String', 'Kilo,Meter', 'ALL', null),
      ('Trellis', 'Wire', 'Kilo,Meter', 'ALL', null),
      ('Trellis', 'Wood', 'Piece', 'ALL', null),
      ('Trellis', 'Trellising net', 'Kilo,Meter,Roll', 'ALL', null),

      -- Fertilization: Urea/DAP/MOP (0-0-60)/Labor hired already exist and
      -- were patched above - only the new items are listed here.
      ('Fertilization', 'Containers', 'Piece', 'Bangladesh,Cambodia,Ghana,India,Myanmar,Nigeria,Philippines,South Sudan,Tanzania,Thailand,Uganda', null),
      ('Fertilization', 'Humic acid', 'Viss,Kilo,Gram,Liter,Ml', 'Cambodia,India,Indonesia,Myanmar,Nigeria,Philippines,Tanzania,Thailand,Uganda', null),
      ('Fertilization', '13-0-45', 'Viss,Kilo,Gram,Liter,Ml', 'Cambodia,India,Indonesia,Myanmar,Nigeria,Philippines,Tanzania,Thailand,Uganda', '13-0-45'),
      ('Fertilization', 'NPK (16-16-16)', 'Viss,Kilo,Gram,Liter,Ml', 'Cambodia,India,Indonesia,Myanmar,Nigeria,Philippines,Tanzania,Thailand,Uganda', 'NPK 16-16-16'),
      ('Fertilization', 'MAP (11-52-0)', 'Viss,Kilo,Gram,Liter,Ml', 'Cambodia,India,Indonesia,Myanmar,Nigeria,Philippines,Tanzania,Thailand,Uganda', 'MAP 11-52-0'),
      ('Fertilization', 'NPK 14-14-14', 'Viss,Kilo,Gram,Liter,Ml', 'Cambodia,India,Indonesia,Myanmar,Nigeria,Philippines,Tanzania,Thailand,Uganda', 'NPK 14-14-14'),
      ('Fertilization', 'Supravim (foliar)', 'Viss,Kilo,Gram,Liter,Ml', 'Cambodia,India,Indonesia,Myanmar,Nigeria,Philippines,Tanzania,Thailand,Uganda', null),
      ('Fertilization', '12-61-0', 'Viss,Kilo,Gram,Liter,Ml', 'India,Nigeria', null),
      ('Fertilization', '16-16-16', 'Viss,Kilo,Gram,Liter,Ml', 'Bangladesh,India,Laos', 'NPK 16-16-16'),

      ('Irrigation', 'Rain hose/ Rain pipe', 'Piece,Meter', 'ALL', null),
      ('Irrigation', 'Water Sprinkler', 'Piece', 'ALL', null),
      ('Irrigation', 'Watertank', 'Piece', 'ALL', null),
      ('Irrigation', 'Labor hired', 'Day,Hour', 'ALL', null),

      ('Crop Maintenance', 'Others', '', 'Dummy Country', null),
      ('Crop Maintenance', 'Vining', 'Day,Hour', 'ALL', null),
      ('Crop Maintenance', 'Weeding', 'Day,Hour', 'ALL', null),
      ('Crop Maintenance', 'Pruning', 'Day,Hour', 'ALL', null),
      ('Crop Maintenance', 'Watering', 'Day,Hour', 'ALL', null),

      ('Pest Management', 'Acibenzolar-S-methyl (P01) + Mancozeb (M03)', 'Gram,Kilo,Ml,Liter', 'ALL', null),
      ('Pest Management', 'Emamectin benzoate', 'Gram,Kilo,Ml,Liter', 'ALL', null),

      ('Harvest', 'Packaging materials', 'Piece,Kilo', 'ALL', null),
      ('Harvest', 'Transport cost', 'Time,Hour', 'ALL', null),
      ('Harvest', 'Labor hired', 'Day,Hour', 'ALL', null),

      ('Cleaning old crop', 'Labor hired', 'Day,Hour', 'ALL', null),

      ('Protective cultivation', 'Green House', 'Piece,Square meter', 'ALL', null),
      ('Protective cultivation', 'Green net', 'Meter,Roll', 'ALL', null),
      ('Protective cultivation', 'Nails', 'Kilo,Gram', 'ALL', null),
      ('Protective cultivation', 'Plastic sheet', 'Meter,Roll', 'ALL', null),
      ('Protective cultivation', 'Other', '', 'Dummy Country', null),

      ('Other Costs', 'Green house', 'Piece,Square meter', 'ALL', null),
      ('Other Costs', 'Land rent', 'Time', 'ALL', null),
      ('Other Costs', 'Loan credit', 'Time', 'ALL', null),
      ('Other Costs', 'Small Tools', 'Piece', 'ALL', null)
    ) as t(activity_name, item_name, unit_list, country_mode, nutrient_config_name)
  loop
    select id into v_activity_id from activities where name = rec.activity_name;
    if v_activity_id is null then
      insert into activities (name) values (rec.activity_name) returning id into v_activity_id;
    end if;

    select id into v_item_id from activity_items where activity_id = v_activity_id and name = rec.item_name;
    if v_item_id is not null then
      continue; -- already exists (e.g. Fertilization's pre-existing items) - don't touch it
    end if;

    v_config_id := null;
    if rec.nutrient_config_name is not null then
      select id into v_config_id from nutrient_configurations where name = rec.nutrient_config_name;
    end if;

    insert into activity_items (activity_id, name, is_nutrient, nutrient_configuration_id)
      values (v_activity_id, rec.item_name, v_config_id is not null, v_config_id)
      returning id into v_item_id;

    if rec.country_mode = 'ALL' then
      insert into activity_item_countries (item_id, country_id)
        select v_item_id, id from countries where name != 'Dummy Country';
    else
      insert into activity_item_countries (item_id, country_id)
        select v_item_id, id from countries where name = any(string_to_array(rec.country_mode, ','));
    end if;

    if rec.unit_list is not null and rec.unit_list != '' then
      insert into activity_item_units (item_id, unit_id)
        select v_item_id, id from units where name = any(string_to_array(rec.unit_list, ','));
    end if;
  end loop;
end $$;
