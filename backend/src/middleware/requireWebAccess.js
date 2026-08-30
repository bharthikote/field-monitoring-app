import { requireAuth } from './requireAuth.js';

const WEB_ROLES = ['admin', 'super_admin', 'leadership', 'tfo', 'supervisor', 'team_lead', 'country_manager'];

// Anyone who's allowed into the web panel at all - Admin/Super Admin for
// the administrative pages; everyone else (Leadership, TFO, Supervisor,
// Team Lead, Country Manager) for read-only Reports, scoped to whatever
// their location assignments cover (same coverage rule the mobile app
// already uses - see getCoveredVillageIds). Individual write routes stay
// on requireAdmin - this only gates the "am I allowed in the door" check.
export function requireWebAccess(req, res, next) {
  requireAuth(req, res, () => {
    if (!WEB_ROLES.includes(req.user.role)) {
      return res.status(403).json({ error: 'This account does not have web access' });
    }
    next();
  });
}
