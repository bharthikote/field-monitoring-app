-- Institutions and Agro Dealers are usually located at a block or district
-- headquarters (a KVK, government office, dealer shop), not necessarily a
-- village - generalize their location from a fixed village_id to a
-- level+id pair (same pattern already used by user_locations), so a
-- profile can point at a village, block, or district. State/country are
-- deliberately excluded - too broad to be "a place" someone visits.

alter table institutions add column location_level text;
alter table institutions add column location_id uuid;
update institutions set location_level = 'village', location_id = village_id;
alter table institutions alter column location_level set not null;
alter table institutions alter column location_id set not null;
alter table institutions add constraint institutions_location_level_check check (location_level in ('village', 'block', 'district'));
drop index if exists institutions_village_id_idx;
alter table institutions drop column village_id;
create index institutions_location_idx on institutions (location_level, location_id);

alter table agro_dealers add column location_level text;
alter table agro_dealers add column location_id uuid;
update agro_dealers set location_level = 'village', location_id = village_id;
alter table agro_dealers alter column location_level set not null;
alter table agro_dealers alter column location_id set not null;
alter table agro_dealers add constraint agro_dealers_location_level_check check (location_level in ('village', 'block', 'district'));
drop index if exists agro_dealers_village_id_idx;
alter table agro_dealers drop column village_id;
create index agro_dealers_location_idx on agro_dealers (location_level, location_id);
