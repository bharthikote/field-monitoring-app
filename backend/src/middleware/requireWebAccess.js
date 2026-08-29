import { requireAuth } from './requireAuth.js';

const WEB_ROLES = ['admin', 'super_admin', 'leadership'];

// Anyone who's allowed into the web panel at all - Admin/Super Admin for
// the administrative pages, plus Leadership for read-only Reports (PRD
// Section 2: "View/reporting access only"). Every other role's entire
// experience is the mobile app. Individual write routes stay on
// requireAdmin - this only gates the "am I allowed in the door" check.
export function requireWebAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!WEB_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'This account does not have web access' });
    }
    next();
  });
}
