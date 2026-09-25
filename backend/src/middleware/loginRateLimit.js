// Slows down password guessing on /auth/login without adding a dependency.
// Two independent limits: per client address (one machine hammering many
// accounts) and per account identifier (many machines hammering one
// account). In-memory, so it resets on restart and is per server instance -
// fine for a single Render service, not a substitute for a shared store if
// this ever runs on several instances.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 30;
const MAX_PER_IDENTIFIER = 10;

const hits = new Map();

function tooMany(key, max) {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now - entry.start > WINDOW_MS) {
    hits.set(key, { start: now, count: 1 });
    return false;
  }
  entry.count += 1;
  return entry.count > max;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) if (now - entry.start > WINDOW_MS) hits.delete(key);
}, WINDOW_MS).unref();

export function loginRateLimit(req, res, next) {
  const identifier = String(req.body?.identifier || '').trim().toLowerCase();
  if (tooMany(`ip:${req.ip}`, MAX_PER_IP) || (identifier && tooMany(`id:${identifier}`, MAX_PER_IDENTIFIER))) {
    return res.status(429).json({ error: 'Too many login attempts. Please wait 15 minutes and try again.' });
  }
  next();
}
