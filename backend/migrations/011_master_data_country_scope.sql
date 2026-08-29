-- Lets Super Admin restrict any crop, variety, or master list item to
-- specific countries. No rows here for an item = visible to every country
-- (the default), so nothing that already exists changes behavior until
-- someone deliberately assigns it.
create table if not exists crops_countries (
  item_id uuid not null references crops(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table if not exists varieties_countries (
  item_id uuid not null references varieties(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table if not exists training_topics_countries (
  item_id uuid not null references training_topics(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table if not exists field_day_topics_countries (
  item_id uuid not null references field_day_topics(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table if not exists issue_types_countries (
  item_id uuid not null references issue_types(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table if not exists diseases_countries (
  item_id uuid not null references diseases(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table if not exists pests_countries (
  item_id uuid not null references pests(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table if not exists techniques_countries (
  item_id uuid not null references techniques(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);

create table if not exists good_things_observed_countries (
  item_id uuid not null references good_things_observed(id) on delete cascade,
  country_id uuid not null references countries(id) on delete cascade,
  primary key (item_id, country_id)
);
