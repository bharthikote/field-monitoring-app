-- Offline phone app (android/): every record saved on the phone gets its own
-- UUID before it is sent. The server keeps it in client_id so that sending
-- the same record again (after a dropped connection, a retry, a second sync)
-- returns the row already saved instead of creating a duplicate. Nullable:
-- the web admin and older app versions don't send one.
alter table farmers add column if not exists client_id uuid unique;
alter table demo_plots add column if not exists client_id uuid unique;
alter table visits add column if not exists client_id uuid unique;
alter table trainings add column if not exists client_id uuid unique;
alter table field_days add column if not exists client_id uuid unique;
alter table institution_visits add column if not exists client_id uuid unique;
alter table agro_dealer_visits add column if not exists client_id uuid unique;
alter table tfo_demos add column if not exists client_id uuid unique;
alter table tfo_home_gardens add column if not exists client_id uuid unique;
alter table data_collection_submissions add column if not exists client_id uuid unique;
