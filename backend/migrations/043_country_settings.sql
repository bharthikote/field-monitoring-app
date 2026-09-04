-- Country Settings: extends the existing countries/units/seasons master
-- data with the configuration a Super Admin needs per country (currency,
-- phone code, measurement units, agricultural seasons, and location
-- hierarchy display terminology) - the backend location hierarchy itself
-- (countries -> states -> districts -> blocks -> villages) is unchanged.

alter table countries
  add column iso_code text,
  add column phone_code text,
  add column currency_name text,
  add column state_label text not null default 'State',
  add column district_label text not null default 'District',
  add column block_label text not null default 'Block',
  add column village_label text not null default 'Village',
  add column status text not null default 'active' check (status in ('active', 'inactive'));

-- Real ISO 3166-1 alpha-2 codes, international calling codes, and currency
-- names for the 14 real countries seeded so far (currency_code already
-- exists from migration 037). Dummy Country deliberately left null - it's
-- dev/test only, never a real production country (see migration 035).
update countries set iso_code = v.iso, phone_code = v.phone, currency_name = v.currency_name
from (values
  ('Bangladesh', 'BD', '+880', 'Bangladeshi Taka'),
  ('Cambodia', 'KH', '+855', 'Cambodian Riel'),
  ('Ghana', 'GH', '+233', 'Ghanaian Cedi'),
  ('India', 'IN', '+91', 'Indian Rupee'),
  ('Indonesia', 'ID', '+62', 'Indonesian Rupiah'),
  ('Laos', 'LA', '+856', 'Lao Kip'),
  ('Myanmar', 'MM', '+95', 'Myanmar Kyat'),
  ('Nepal', 'NP', '+977', 'Nepalese Rupee'),
  ('Nigeria', 'NG', '+234', 'Nigerian Naira'),
  ('Philippines', 'PH', '+63', 'Philippine Peso'),
  ('South Sudan', 'SS', '+211', 'South Sudanese Pound'),
  ('Tanzania', 'TZ', '+255', 'Tanzanian Shilling'),
  ('Thailand', 'TH', '+66', 'Thai Baht'),
  ('Uganda', 'UG', '+256', 'Ugandan Shilling')
) as v(name, iso, phone, currency_name)
where countries.name = v.name;

-- --- Units: classify the existing flat Unit Master into the 5 Country
-- Settings categories (nullable - a unit not used by Country Settings,
-- e.g. Piece/Roll/Seedlings which only apply to Activity Cost/Return line
-- items, simply has no category and is unaffected). No new unit table -
-- reuses the existing `units` rows and ids exactly as the spec requires.
alter table units add column category text check (category in ('area', 'weight', 'liquid', 'time', 'distance'));

update units set category = v.category
from (values
  ('Square feet', 'area'), ('Square meter', 'area'),
  ('Kilo', 'weight'), ('Gram', 'weight'), ('Ton', 'weight'), ('Quintal', 'weight'), ('Viss', 'weight'),
  ('Liter', 'liquid'), ('Ml', 'liquid'),
  ('Day', 'time'), ('Hour', 'time'),
  ('Meter', 'distance')
) as v(name, category)
where units.name = v.name;

insert into units (name, category) values ('Acre', 'area'), ('Hectare', 'area'), ('Kilometer', 'distance')
on conflict (name) do nothing;

-- Which existing Unit Master entries are valid/enabled for a given country
-- in each category - references the existing units table, not a new one.
create table country_units (
  country_id uuid not null references countries(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  primary key (country_id, unit_id)
);

-- --- Seasons: were a generic, globally-shared master list
-- (name unique, optionally country-restricted via seasons_countries).
-- The spec requires seasons to become genuinely country-specific - two
-- countries can each have their own "Rainy Season" with different dates,
-- as distinct rows, not one shared row. Adding country_id/start_month/
-- end_month directly onto the existing `seasons` table (rather than a new
-- table) preserves every existing row's id, so tfo_demo_crops.season_id
-- (already in use - see migration 029) keeps resolving correctly with no
-- data migration needed. The 4 pre-existing global rows (country_id left
-- null) are kept as-is and still valid for any demo that already
-- references them; going forward, country-scoped rows are what a Super
-- Admin configures per country and what the mobile Season picker queries
-- by country, with the legacy null-country rows kept as a fallback for any
-- country that hasn't been configured yet.
alter table seasons drop constraint seasons_name_key;
alter table seasons
  add column country_id uuid references countries(id) on delete cascade,
  add column start_month smallint check (start_month between 1 and 12),
  add column end_month smallint check (end_month between 1 and 12);
create unique index seasons_country_name_uidx on seasons (country_id, name);

-- Real season data explicitly given in the request: India's own worked
-- example (Summer/Monsoon/Winter) and Ghana's reference screenshot
-- (Rainy season/Dry season). No agricultural-calendar data was invented
-- for any other country - they fall back to the legacy global list above
-- until a Super Admin configures their real seasons via Country Settings.
insert into seasons (name, country_id, start_month, end_month)
select v.name, c.id, v.start_month, v.end_month
from (values
  ('India', 'Summer', 3, 6),
  ('India', 'Monsoon', 7, 9),
  ('India', 'Winter', 10, 2),
  ('Ghana', 'Rainy season', 4, 10),
  ('Ghana', 'Dry season', 10, 3)
) as v(country_name, name, start_month, end_month)
join countries c on c.name = v.country_name
on conflict (country_id, name) do nothing;
