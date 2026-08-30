create table if not exists visit_diseases (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  disease_id uuid references diseases(id),
  disease_other text,
  photo_url text not null,
  check (disease_id is not null or disease_other is not null)
);

create table if not exists visit_pests (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references visits(id) on delete cascade,
  pest_id uuid references pests(id),
  pest_other text,
  photo_url text not null,
  check (pest_id is not null or pest_other is not null)
);

alter table visits drop column if exists disease_id;
alter table visits drop column if exists disease_other;
alter table visits drop column if exists disease_photo_url;
alter table visits drop column if exists pest_id;
alter table visits drop column if exists pest_other;
alter table visits drop column if exists pest_photo_url;
