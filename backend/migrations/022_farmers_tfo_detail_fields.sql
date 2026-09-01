-- TFOs collect a richer farmer profile than higher roles do today (per the
-- vendor app's own "Add Farmer" screen) - all new columns are nullable so
-- the existing simple name/phone/village creation flow (higher roles)
-- keeps working unchanged; only the new TFO form populates them. The
-- farmers table itself stays the single registry either way, keyed on
-- phone - no separate TFO farmer table.
alter table farmers add column if not exists photo_url text;
alter table farmers add column if not exists farmer_type text
  check (farmer_type in ('key_farmer', 'core_farmer', 'farmer', 'community_trainer_farmer'));
alter table farmers add column if not exists gender text check (gender in ('male', 'female', 'others'));
alter table farmers add column if not exists age int check (age > 14);
alter table farmers add column if not exists birth_date date;
alter table farmers add column if not exists address text;
alter table farmers add column if not exists education_level text
  check (education_level in ('primary', 'secondary', 'higher', 'adult', 'no_school'));
alter table farmers add column if not exists literacy text check (literacy in ('yes', 'no'));
alter table farmers add column if not exists phone_type text check (phone_type in ('smartphone', 'cellphone', 'no_phone'));
