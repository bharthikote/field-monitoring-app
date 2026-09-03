-- Demonstration data for the mobile Business Plan -> Expected Cost screen,
-- per the spec's request for seed data covering: multiple items under one
-- activity, different units, farmer-only / loan-only / farmer+loan
-- contributions, and the same item saved multiple times consolidating
-- into one row (Urea below - the final upsert wins, matching the app's
-- own "update/merge" save behavior).
--
-- Seeded onto the first ongoing TFO demo found, rather than a hardcoded
-- id, so this migration doesn't fail on a fresh database with no demos
-- yet - it's a no-op in that case instead of an error.
do $$
declare
  v_demo_id uuid;
  v_country_id uuid;
  v_activity_id uuid;
  v_item_id uuid;
  v_unit_id uuid;
  rec record;
begin
  select td.id, s.country_id into v_demo_id, v_country_id
  from tfo_demos td
  join villages vi on vi.id = td.village_id join blocks b on b.id = vi.block_id
  join districts d on d.id = b.district_id join states s on s.id = d.state_id
  where td.status = 'ongoing'
  order by td.created_at asc
  limit 1;

  if v_demo_id is null then
    return;
  end if;
  if exists (select 1 from tfo_demo_expected_costs where demo_id = v_demo_id) then
    return;
  end if;

  for rec in
    select * from (values
      -- activity_name, item_name, unit_name, quantity, farmer_price, loan_price
      ('Land Preparation', 'Bed preparation', 'Day', 2, 1200, 0),
      ('Land Preparation', 'Manure', 'Kilo', 300, 100, 100),
      ('Fertilization', 'Urea', 'Kilo', 10, 100, 50),
      ('Fertilization', 'Urea', 'Kilo', 20, 200, 100),
      ('Fertilization', 'Urea', 'Kilo', 5, 50, 25),
      ('Fertilization', 'DAP', 'Kilo', 8, 320, 160),
      ('Mulch', 'Plastic material', 'Meter', 100, 3000, 0),
      ('Irrigation', 'Water Sprinkler', 'Piece', 1, 0, 500),
      ('Seedling Production', 'Manure', 'Kilo', 50, 150, 0),
      ('Seedling Production', 'Seed tray', 'Piece', 20, 350, 0),
      ('Seedling Production', 'Net insects', 'Meter', 50, 400, 0),
      ('Pest Management', 'Acibenzolar-S-methyl (P01) + Mancozeb (M03)', 'Kilo', 2, 120, 0),
      ('Pest Management', 'Emamectin benzoate', 'Kilo', 2, 220, 0)
    ) as t(activity_name, item_name, unit_name, quantity, farmer_price, loan_price)
  loop
    select ai.id, ai.activity_id into v_item_id, v_activity_id
    from activity_items ai join activities a on a.id = ai.activity_id
    where a.name = rec.activity_name and ai.name = rec.item_name and ai.status = 'active'
      and exists (select 1 from activity_item_countries aic where aic.item_id = ai.id and aic.country_id = v_country_id);

    select id into v_unit_id from units where name = rec.unit_name;

    if v_item_id is not null and v_unit_id is not null then
      insert into tfo_demo_expected_costs (demo_id, activity_id, item_id, quantity, unit_id, farmer_price, loan_price)
        values (v_demo_id, v_activity_id, v_item_id, rec.quantity, v_unit_id, rec.farmer_price, rec.loan_price)
      on conflict (demo_id, item_id) do update set
        quantity = excluded.quantity, unit_id = excluded.unit_id,
        farmer_price = excluded.farmer_price, loan_price = excluded.loan_price, updated_at = now();
    end if;
  end loop;
end $$;
