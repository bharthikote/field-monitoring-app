-- Training activity (PRD Section 6), built from the Training Observation
-- group of the Kobo form. One entry per farmer per training session - no
-- ongoing "plot" record, unlike Demo/Adoption Plot.
create table if not exists trainings (
  id uuid primary key default gen_random_uuid(),
  farmer_name text not null,
  farmer_phone text not null,
  village_id uuid not null references villages(id),
  training_type text not null check (training_type in ('classroom','field_based','mixed')),
  ext_material_used text not null check (ext_material_used in ('ext_material_only','training_material_only','both','none')),
  interaction_quality int not null check (interaction_quality between 1 and 5),
  gender_interaction text not null check (gender_interaction in ('both_interacted','only_male','only_female','no_interaction')),
  seating text not null check (seating in ('equal','discriminatory')),
  remarks text,
  photo_url text not null,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index if not exists trainings_village_id_idx on trainings (village_id);
