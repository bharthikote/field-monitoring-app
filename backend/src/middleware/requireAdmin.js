import { requireAuth } from './requireAuth.js';

// Admin or Super Admin only. Builds on requireAuth so the same
// token-verify + approved-user-lookup logic isn't duplicated.
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}
