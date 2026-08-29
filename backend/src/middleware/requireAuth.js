import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

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

    const result = await pool.query('select id, role, status, country_id from users where id = $1', [payload.userId]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }
    if (user.status !== 'approved') {
      return res.status(403).json({ error: 'Account is not approved' });
    }

    req.user = { userId: user.id, role: user.role, countryId: user.country_id };
    next();
  });
}
