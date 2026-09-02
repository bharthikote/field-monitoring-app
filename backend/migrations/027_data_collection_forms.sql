create table data_collection_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table data_collection_form_fields (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references data_collection_forms(id) on delete cascade,
  field_type text not null check (field_type in ('text', 'number', 'textarea', 'date', 'phone', 'select', 'multiselect', 'photo')),
  label text not null,
  required boolean not null default false,
  options text[],
  created_at timestamptz not null default now()
);

create table data_collection_form_assignments (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references data_collection_forms(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  assigned_by uuid not null references users(id),
  assigned_at timestamptz not null default now(),
  unique (form_id, user_id)
);

create table data_collection_submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references data_collection_forms(id) on delete cascade,
  farmer_id uuid not null references farmers(id),
  village_id uuid not null references villages(id),
  submitted_by uuid not null references users(id),
  values jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
