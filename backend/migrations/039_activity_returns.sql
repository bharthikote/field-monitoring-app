-- Activity Returns: same Activity -> Item -> Country/Unit shape as Activity
-- Costs (migration 033), deliberately kept as its own set of tables rather
-- than reusing activities/activity_items - Cost and Return are different
-- business objects that happen to share a name sometimes (e.g. both have a
-- "Harvest" activity), not the same record wearing two hats. No nutrient
-- concept here at all - that's Cost-specific.
create table activity_returns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  has_item boolean not null default true,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table activity_return_items (
  id uuid primary key default gen_random_uuid(),
  activity_return_id uuid not null references activity_returns(id),
  name text not null,
  remark text,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table activity_return_item_countries (
  item_id uuid not null references activity_return_items(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table activity_return_item_units (
  item_id uuid not null references activity_return_items(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  primary key (item_id, unit_id)
);

create index activity_return_items_activity_return_id_idx on activity_return_items (activity_return_id);

-- Two units the seed data below needs that don't exist yet - shared Units
-- master (same table Activity Cost uses), not owned by Return.
insert into units (name)
select v.name from (values ('Quintal'), ('Seedlings')) as v(name)
where not exists (select 1 from units u where u.name = v.name);

-- Seed the 4 demo activities from the reference screenshots. Country/unit
-- lists are transcribed exactly as given (including Dummy Country, unlike
-- the Activity Cost seed pass) - this data comes from an existing
-- reference system's real configuration, not a placeholder to clean up.
-- Barrier crops and Intercropping only show an activity-level row in the
-- reference (no item breakdown was available), so each gets one item
-- named after its activity, mirroring how Harvest's own primary item is
-- also named "Harvest" - flagged as an inferred assumption, not confirmed
-- source data. Seedlings Sale similarly has no country data in the
-- reference (only its unit, "Seedlings", was visible) - seeded with
-- Dummy Country as a placeholder pending real configuration, rather than
-- inventing a country list with no evidence.
do $$
declare
  v_activity_id uuid;
  v_item_id uuid;
  rec record;
begin
  for rec in
    select * from (values
      ('Barrier crops', 'Barrier crops', 'Quintal,Viss,Kilo', 'Dummy Country,Nigeria,Indonesia,India,Laos,Myanmar,Tanzania,Thailand,South Sudan,Uganda,Ghana,Philippines,Bangladesh,Cambodia'),
      ('Intercropping', 'Intercropping', 'Quintal,Viss,Kilo', 'Dummy Country,Nigeria,Indonesia,India,Laos,Myanmar,Tanzania,Thailand,South Sudan,Uganda,Ghana,Philippines,Bangladesh,Cambodia'),
      ('Harvest', 'Harvest', 'Quintal,Viss,Kilo', 'Dummy Country,Nigeria,Indonesia,India,Laos,Myanmar,Tanzania,Thailand,South Sudan,Uganda,Ghana,Philippines,Bangladesh,Cambodia'),
      ('Harvest', 'Harvest - Piece', 'Piece', 'Dummy Country'),
      ('Seedlings Sale', 'Seedlings Sale', 'Seedlings', 'Dummy Country')
    ) as t(activity_name, item_name, unit_list, country_list)
  loop
    select id into v_activity_id from activity_returns where name = rec.activity_name;
    if v_activity_id is null then
      insert into activity_returns (name, has_item) values (rec.activity_name, true) returning id into v_activity_id;
    end if;

    select id into v_item_id from activity_return_items where activity_return_id = v_activity_id and name = rec.item_name;
    if v_item_id is not null then
      continue;
    end if;

    insert into activity_return_items (activity_return_id, name) values (v_activity_id, rec.item_name) returning id into v_item_id;

    insert into activity_return_item_countries (item_id, country_id)
      select v_item_id, id from countries where name = any(string_to_array(rec.country_list, ','));
    insert into activity_return_item_units (item_id, unit_id)
      select v_item_id, id from units where name = any(string_to_array(rec.unit_list, ','));
  end loop;
end $$;
