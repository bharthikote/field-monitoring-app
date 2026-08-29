const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Registered via router.param('id', validateUuidParam) - runs before any
// route handler with an :id in its path. Rejects malformed ids with a
// clean 400 instead of letting them reach a raw pool.query() and crash
// with a Postgres "invalid input syntax for type uuid" error.
export function validateUuidParam(req, res, next, value) {
  if (!UUID_RE.test(value)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  next();
}
