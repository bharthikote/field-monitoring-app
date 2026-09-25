-- GPS proof-of-location for every field activity. Nullable everywhere because
-- older rows have none and a phone can fail to get a fix; demo_plots is
-- required-on-create at the API layer instead. gps_accuracy is the device's
-- reported error radius in metres.
alter table demo_plots add column if not exists gps_lat numeric, add column if not exists gps_lng numeric, add column if not exists gps_accuracy numeric;
alter table visits add column if not exists gps_lat numeric, add column if not exists gps_lng numeric, add column if not exists gps_accuracy numeric;
alter table trainings add column if not exists gps_lat numeric, add column if not exists gps_lng numeric, add column if not exists gps_accuracy numeric;
alter table field_days add column if not exists gps_lat numeric, add column if not exists gps_lng numeric, add column if not exists gps_accuracy numeric;
alter table institution_visits add column if not exists gps_lat numeric, add column if not exists gps_lng numeric, add column if not exists gps_accuracy numeric;
alter table agro_dealer_visits add column if not exists gps_lat numeric, add column if not exists gps_lng numeric, add column if not exists gps_accuracy numeric;
alter table data_collection_submissions add column if not exists gps_lat numeric, add column if not exists gps_lng numeric, add column if not exists gps_accuracy numeric;

-- Plots that come from a TFO demo already have the demo's GPS.
update demo_plots dp set gps_lat = td.gps_lat, gps_lng = td.gps_lng
from tfo_demos td
where dp.tfo_demo_id = td.id and dp.gps_lat is null;
