-- Two corrections to the Home Garden form (migration 030): the "site
-- condition" field is actually just Soil Type (same 4-option list Demo
-- Plot already uses), and Site ID was included by mistake and should never
-- have existed.
alter table tfo_home_gardens rename column field_condition to soil_type;
alter table tfo_home_gardens drop column site_id;
