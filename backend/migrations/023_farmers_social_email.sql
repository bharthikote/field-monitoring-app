-- Social Media (multi-select, fixed platform list) and optional Email,
-- rounding out the TFO detailed farmer form per the vendor app's own
-- screen. social_media is a plain text[] (a small fixed set, no per-item
-- metadata needed, so no join table) constrained to the known platforms;
-- email gets a basic format check at the DB layer too, matching the
-- application-layer validation.
alter table farmers add column if not exists social_media text[];
alter table farmers add constraint farmers_social_media_check
  check (social_media is null or social_media <@ array['facebook', 'instagram', 'snapchat', 'telegram', 'tiktok', 'twitter']::text[]);

alter table farmers add column if not exists email text;
alter table farmers add constraint farmers_email_check
  check (email is null or email ~ '^[^\s@]+@[^\s@]+\.[^\s@]+$');
