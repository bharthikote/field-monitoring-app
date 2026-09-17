// Matches EXEMPT_FROM_LOCATION in create-user.html / user-profile.html -
// Leadership and Super Admin are the only roles that legitimately have no
// location (Leadership sees every country by design; Super Admin bypasses
// scoping everywhere already).
const EXEMPT_ROLES = ['leadership', 'super_admin'];

// Blocks creating new field data (farmers, demo plots, visits, trainings,
// field days, institution/agro dealer visits, TFO demos/home gardens, data
// collection submissions) for a user with zero location assignments.
//
// Before this, creation was unscoped by design (see the old comment on
// GET /farmers/by-phone) while browsing/searching existing records was
// always coverage-scoped via getCoveredVillageIds. That split let a user
// with no location at all still create farmers/plots/visits/issues nobody
// could ever find or route - including issues with nobody to auto-assign
// to, since assignableUsersFor also depends on this same location data.
// Use requireAuth first so req.user.countryIds is populated.
export function requireLocation(req, res, next) {
  if (EXEMPT_ROLES.includes(req.user.role)) return next();
  if (!req.user.countryIds.length) {
    return res.status(403).json({
      error: 'You need a location assigned before you can do this. Contact your Admin.',
    });
  }
  next();
}
