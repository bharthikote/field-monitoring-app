alter table farmers drop constraint farmers_phone_key;
create unique index farmers_phone_active_key on farmers (phone) where status = 'active';
