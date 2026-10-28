# Production administration

Start at https://knititnow.com/admin. This is the directory for content,
marketing, customers, support, publishing, and reporting tools.

## One staff login

The login at /admin/login uses the existing Watson owner password
(WATSON_ADMIN_PASSWORD). It creates the existing signed, HttpOnly,
Secure, SameSite=Lax watson_session cookie for 24 hours, with Path=/.
Existing valid Watson sessions continue to work. No customer Memberstack
login is required to navigate staff pages or call their admin APIs.

Both /admin and /watson pages link back to All administration. Old tool
addresses remain valid. /watson/login redirects to the shared staff login.
Sign out of administration clears the shared session for both workspaces.
Login return targets are limited to local /admin and /watson pages.

## Server enforcement

Admin pages require a staff session (with the existing localhost-only
fallback retained for development). Admin APIs accept the verified staff
cookie through the shared admin gate. Existing verified Memberstack API
callers remain supported, with their existing allowlist checks. A customer
session does not substitute for the staff page login.

Astro reads the password from its server build/runtime environment. Standalone
Netlify reporting functions read the same password from their function runtime.
The password must be available in Builds and Functions on the production site;
never expose it through a PUBLIC_ environment variable.

Staff mutations, including login and logout, require a matching Origin.
The browser meta marker and X-Kin-Staff-Session header are UI hints only;
neither grants server access. Memberstack customer authentication,
subscriptions, calendar sync schedules, and integration settings are unchanged.

## Validation

The staff-session tests cover login, both workspaces, an admin write request,
preview requests, logout, expiry, malformed/forged cookies, password rotation,
missing configuration, redirect boundaries, and cross-origin rejection.
Verify the production login with the existing staff password after deployment.
Do not test by triggering calendar syncs or changing customer records.
