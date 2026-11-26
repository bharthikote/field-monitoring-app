-- Feed: success and impact stories from the field (Instagram-style).
-- One feed for every user in every country; posts can be opened by anyone
-- through their share link (/s/<share_token>), so nothing private (farmer
-- phone numbers) is ever stored on a post. Deletes are soft (deleted_at) so
-- an admin removal can be traced.
create table if not exists feed_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references users(id),
  caption text not null default '',
  village_id uuid references villages(id),
  share_token text not null unique,
  client_id uuid unique,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references users(id)
);
create index if not exists feed_posts_created_idx on feed_posts(created_at desc) where deleted_at is null;

create table if not exists feed_post_photos (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references feed_posts(id) on delete cascade,
  photo_url text not null,
  position int not null default 0
);
create index if not exists feed_post_photos_post_idx on feed_post_photos(post_id, position);

create table if not exists feed_likes (
  post_id uuid not null references feed_posts(id) on delete cascade,
  user_id uuid not null references users(id),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references feed_posts(id) on delete cascade,
  author_id uuid not null references users(id),
  body text not null,
  client_id uuid unique,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references users(id)
);
create index if not exists feed_comments_post_idx on feed_comments(post_id, created_at) where deleted_at is null;
