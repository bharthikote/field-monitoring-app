import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';
import { resolveCountryIdsForUser } from '../db/locationHelpers.js';

// Any logged-in, approved user - regardless of role. Used by mobile-facing
// endpoints (demo plots, master data reads, location browsing) that every
// field role needs, not just Admin/Super Admin.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Login required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }

    const result = await pool.query('select id, role, status from users where id = $1', [payload.userId]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Account is not approved' });
    }

    // A user can now hold multiple location assignments at mixed levels
    // (e.g. two whole blocks plus a handful of individual villages
    // elsewhere), not one single path. countryIds is the distinct set of
    // countries all of those assignments fall under - used to scope "own
    // country" permission checks (Admin managing locations/users).
    const countryIds = await resolveCountryIdsForUser(user.id);

    req.user = { userId: user.id, role: user.role, countryIds };
    next();
  });
}
