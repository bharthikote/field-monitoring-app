create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile_number text unique,
  email text unique,
  password_hash text not null,
  role text not null check (role in ('tfo', 'supervisor', 'team_lead', 'country_manager', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_identifier_present check (mobile_number is not null or email is not null)
);
