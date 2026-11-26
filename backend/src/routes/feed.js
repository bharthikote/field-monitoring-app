import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { pool } from '../db/pool.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { uploadPhoto } from '../storage.js';

// Feed: success and impact stories from the field. One feed for everyone in
// every country (decision 2026-11-23); any approved user can post photos,
// like, comment and share. A post's share link (/s/<token>) opens a public
// page without logging in, so posts never carry private details.
export const feedRouter = Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MODERATORS = ['admin', 'super_admin'];
const MAX_PHOTOS = 10;
const MAX_CAPTION = 2200;
const MAX_COMMENT = 1000;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: MAX_PHOTOS } });
function handleFileUpload(req, res, next) {
  upload.any()(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'A photo is too large (max 8MB each)' });
    if (err.code === 'LIMIT_FILE_COUNT') return res.status(400).json({ error: `At most ${MAX_PHOTOS} photos per post` });
    res.status(400).json({ error: err.message });
  });
}

function shareUrl(req, token) {
  return `${req.protocol}://${req.get('host')}/s/${token}`;
}

const SELECT_POSTS = `
  select p.id, p.caption, p.created_at, p.share_token, p.author_id,
    u.name as author_name, u.role as author_role,
    vi.name as village_name, co.name as country_name,
    coalesce((select json_agg(ph.photo_url order by ph.position) from feed_post_photos ph where ph.post_id = p.id), '[]') as photos,
    (select count(*)::int from feed_likes l where l.post_id = p.id) as like_count,
    (select count(*)::int from feed_comments c where c.post_id = p.id and c.deleted_at is null) as comment_count,
    exists (select 1 from feed_likes l where l.post_id = p.id and l.user_id = $1) as liked_by_me
  from feed_posts p
  join users u on u.id = p.author_id
  left join villages vi on vi.id = p.village_id
  left join blocks b on b.id = vi.block_id
  left join districts di on di.id = b.district_id
  left join states s on s.id = di.state_id
  left join countries co on co.id = s.country_id
`;

function present(req, row) {
  const { share_token: token, author_id: authorId, ...rest } = row;
  return {
    ...rest,
    author_id: authorId,
    share_url: shareUrl(req, token),
    can_delete: authorId === req.user.userId || MODERATORS.includes(req.user.role),
  };
}

// Newest first, 20 at a time; pass ?before=<created_at of the last post> for the next page.
feedRouter.get('/feed', requireAuth, async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const before = req.query.before ? new Date(req.query.before) : null;
  if (before && Number.isNaN(before.getTime())) return res.status(400).json({ error: 'Invalid before' });
  const result = await pool.query(
    `${SELECT_POSTS} where p.deleted_at is null and ($2::timestamptz is null or p.created_at < $2)
     order by p.created_at desc limit $3`,
    [req.user.userId, before, limit],
  );
  res.json({ posts: result.rows.map((r) => present(req, r)) });
});

async function answerRepeatedPost(req, res, clientId) {
  const existing = await pool.query(`${SELECT_POSTS} where p.client_id = $2`, [req.user.userId, clientId]);
  if (existing.rowCount === 0) return false;
  if (existing.rows[0].author_id !== req.user.userId) {
    res.status(409).json({ error: 'This post id was already used by another user', code: 'client_id_conflict' });
    return true;
  }
  res.status(200).json({ post: present(req, existing.rows[0]), repeated: true });
  return true;
}

// Multipart: caption, optional villageId, optional clientId (offline retries
// return the post already made), and 1-10 photos in any file fields - kept
// in the order they arrive.
feedRouter.post('/feed', requireAuth, handleFileUpload, async (req, res) => {
  const caption = (req.body.caption || '').trim();
  const villageId = req.body.villageId || null;
  const clientId = req.body.clientId || null;
  const files = (req.files || []).filter((f) => f.mimetype?.startsWith('image/'));

  if (clientId && !UUID_RE.test(clientId)) return res.status(400).json({ error: 'clientId must be a UUID' });
  if (villageId && !UUID_RE.test(villageId)) return res.status(400).json({ error: 'Invalid villageId' });
  if (clientId && (await answerRepeatedPost(req, res, clientId))) return;
  if (files.length === 0) return res.status(400).json({ error: 'Add at least one photo' });
  if (caption.length > MAX_CAPTION) return res.status(400).json({ error: `Keep the caption under ${MAX_CAPTION} characters` });

  const client = await pool.connect();
  try {
    const urls = [];
    for (const f of files) urls.push(await uploadPhoto(f.buffer, f.originalname, f.mimetype));
    await client.query('begin');
    const created = await client.query(
      `insert into feed_posts (author_id, caption, village_id, share_token, client_id)
       values ($1, $2, $3, $4, $5) returning id`,
      [req.user.userId, caption, villageId, randomBytes(9).toString('base64url'), clientId],
    );
    const postId = created.rows[0].id;
    for (let i = 0; i < urls.length; i++) {
      await client.query('insert into feed_post_photos (post_id, photo_url, position) values ($1, $2, $3)', [postId, urls[i], i]);
    }
    await client.query('commit');
    const result = await pool.query(`${SELECT_POSTS} where p.id = $2`, [req.user.userId, postId]);
    res.status(201).json({ post: present(req, result.rows[0]) });
  } catch (err) {
    await client.query('rollback');
    if (err.code === '23505' && clientId && (await answerRepeatedPost(req, res, clientId))) return;
    if (err.code === '23503') return res.status(400).json({ error: 'No such village' });
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

feedRouter.delete('/feed/:id', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const post = await pool.query('select author_id from feed_posts where id = $1 and deleted_at is null', [req.params.id]);
  if (post.rowCount === 0) return res.status(404).json({ error: 'No such post' });
  if (post.rows[0].author_id !== req.user.userId && !MODERATORS.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the author or an admin can remove this post' });
  }
  await pool.query('update feed_posts set deleted_at = now(), deleted_by = $2 where id = $1', [req.params.id, req.user.userId]);
  res.json({ ok: true });
});

// Like / unlike are idempotent, so the phone can safely repeat them.
feedRouter.post('/feed/:id/like', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await pool.query('insert into feed_likes (post_id, user_id) values ($1, $2) on conflict do nothing', [req.params.id, req.user.userId]);
  } catch (err) {
    if (err.code === '23503') return res.status(404).json({ error: 'No such post' });
    throw err;
  }
  res.json({ ok: true });
});

feedRouter.delete('/feed/:id/like', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  await pool.query('delete from feed_likes where post_id = $1 and user_id = $2', [req.params.id, req.user.userId]);
  res.json({ ok: true });
});

feedRouter.get('/feed/:id/comments', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const result = await pool.query(
    `select c.id, c.body, c.created_at, c.author_id, u.name as author_name, u.role as author_role
     from feed_comments c join users u on u.id = c.author_id
     where c.post_id = $1 and c.deleted_at is null order by c.created_at`,
    [req.params.id],
  );
  res.json({
    comments: result.rows.map((c) => ({ ...c, can_delete: c.author_id === req.user.userId || MODERATORS.includes(req.user.role) })),
  });
});

feedRouter.post('/feed/:id/comments', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
  const body = (req.body.body || '').trim();
  const clientId = req.body.clientId || null;
  if (!body) return res.status(400).json({ error: 'Write a comment first' });
  if (body.length > MAX_COMMENT) return res.status(400).json({ error: `Keep comments under ${MAX_COMMENT} characters` });
  if (clientId && !UUID_RE.test(clientId)) return res.status(400).json({ error: 'clientId must be a UUID' });
  const post = await pool.query('select 1 from feed_posts where id = $1 and deleted_at is null', [req.params.id]);
  if (post.rowCount === 0) return res.status(404).json({ error: 'This post was removed' });
  const result = await pool.query(
    `insert into feed_comments (post_id, author_id, body, client_id) values ($1, $2, $3, $4)
     on conflict (client_id) do nothing returning id, created_at`,
    [req.params.id, req.user.userId, body, clientId],
  );
  res.status(result.rowCount ? 201 : 200).json({ ok: true, comment: result.rows[0] || null });
});

feedRouter.delete('/feed/comments/:commentId', requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.commentId)) return res.status(400).json({ error: 'Invalid id' });
  const c = await pool.query('select author_id from feed_comments where id = $1 and deleted_at is null', [req.params.commentId]);
  if (c.rowCount === 0) return res.status(404).json({ error: 'No such comment' });
  if (c.rows[0].author_id !== req.user.userId && !MODERATORS.includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the author or an admin can remove this comment' });
  }
  await pool.query('update feed_comments set deleted_at = now(), deleted_by = $2 where id = $1', [req.params.commentId, req.user.userId]);
  res.json({ ok: true });
});

// --- Public share page: anyone with the link, no login ---

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

feedRouter.get('/s/:token', async (req, res) => {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(req.params.token)) return res.status(404).send('Not found');
  const result = await pool.query(
    `select p.caption, p.created_at, u.name as author_name, vi.name as village_name, co.name as country_name,
       coalesce((select json_agg(ph.photo_url order by ph.position) from feed_post_photos ph where ph.post_id = p.id), '[]') as photos,
       (select count(*)::int from feed_likes l where l.post_id = p.id) as like_count
     from feed_posts p join users u on u.id = p.author_id
     left join villages vi on vi.id = p.village_id left join blocks b on b.id = vi.block_id
     left join districts di on di.id = b.district_id left join states s on s.id = di.state_id
     left join countries co on co.id = s.country_id
     where p.share_token = $1 and p.deleted_at is null`,
    [req.params.token],
  );
  if (result.rowCount === 0) {
    return res.status(404).type('html').send('<!doctype html><meta name="viewport" content="width=device-width"><p style="font-family:sans-serif;padding:24px">This story is no longer available.</p>');
  }
  const p = result.rows[0];
  const place = [p.village_name, p.country_name].filter(Boolean).join(', ');
  const title = `${p.author_name}${place ? ` - ${place}` : ''}`;
  const description = p.caption.slice(0, 200);
  const photos = p.photos.map((url) => `<img src="${esc(url)}" alt="Photo from the field" loading="lazy">`).join('');
  res.type('html').send(`<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | FieldSight</title>
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${p.photos[0] ? `<meta property="og:image" content="${esc(p.photos[0])}">` : ''}
<meta property="og:type" content="article">
<style>
  body{margin:0;background:#E8EEEA;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1F2A24}
  header{background:#fff;padding:14px 16px;font-weight:700;font-size:20px}
  header .f{color:#00664A}header .s{color:#5BAF2E}
  main{max-width:640px;margin:16px auto;padding:0 16px}
  .card{background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .who{padding:14px 16px}.who b{color:#00664A;font-size:17px}.who div{color:#5F7A6C;font-size:14px}
  img{display:block;width:100%;height:auto;margin-bottom:4px}
  .cap{padding:14px 16px;font-size:16px;line-height:1.45;white-space:pre-wrap}
  .meta{padding:0 16px 16px;color:#5F7A6C;font-size:14px}
</style></head>
<body><header><span class="f">Field</span><span class="s">Sight</span></header>
<main><div class="card">
<div class="who"><b>${esc(p.author_name)}</b><div>${esc(place)}</div></div>
${photos}
<div class="cap">${esc(p.caption)}</div>
<div class="meta">${p.like_count} like${p.like_count === 1 ? '' : 's'} &middot; ${esc(new Date(p.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }))}</div>
</div></main></body></html>`);
});
