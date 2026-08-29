import jwt from 'jsonwebtoken';
import { pool } from '../db/pool.js';

export function requireAdmin(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Login required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, async (err, payload) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    if (payload.role !== 'admin' && payload.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query('select id, role, country_id from users where id = $1', [payload.userId]);
    const user = result.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    req.user = { userId: user.id, role: user.role, countryId: user.country_id };
    next();
  });
}
