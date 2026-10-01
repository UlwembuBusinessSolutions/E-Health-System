# IAM-US-004 live API verification
## Frontend and backend integration: 2026-09-28

The staff frontend in the sibling E-Health-System-dev-frontend-ulwembu (3) project
now handles SESSION_REPLACED_OR_ENDED for JSON requests and authenticated downloads.
It clears only the matching token, resets staff state and cached queries, redirects
to the organisation login page, and displays the session-ended alert. Successful
password/SSO sign-in clears the saved notice. Delayed old-token responses cannot
clear a newer session.

Passed: frontend production build, changed-file lint, frontend contract checks,
6 backend session tests, 29 live API assertions, and 9 live two-browser checks.
The browser run used the actual production bundle and the existing localhost:8082
API through a local reverse proxy, with no fabricated authentication responses.
Both browser contexts were independent. There were no browser errors. Temporary
accounts and their test records were removed after verification.

Full report: ../../docs/testing/IAM-US-004-integration.md.
Live screenshot: ../../docs/testing/2026-09-28/staff-session/02-session-ended.png.
Live browser results: ../../docs/testing/2026-09-28/staff-session/results.json.
Live SSO and separate physical terminals remain outside this verification run.

## Live retest: 2026-09-25

Target: http://localhost:8081 (running service; health returned UP).
Database: local PostgreSQL, ulwembut / demo_clinic.

All 29 assertions passed against the live API:
- Initial login and authenticated identity retrieval succeeded.
- A second terminal login invalidated the first token with HTTP 401,
  the displacement message, and the browser-exposed X-Session-Status header.
- Incorrect password and stale-token logout preserved the replacement session.
- Five simultaneous successful logins left exactly one authorized token.
- The audit API returned displacement events; SQL verified exactly six events
  for the temporary user with old/new session IDs, IP, and device metadata.
- Active logout returned 204, token replay returned 401, and both persistent
  session registry fields were cleared.

The harness removed its temporary user, role assignment, and audit rows.
Existing user credentials were not modified. The running service was left up.
Raw output: `../target/live-session-results-2026-09-25.txt` (local build artifact).

Terminal identities were simulated through distinct User-Agent headers on one
machine. Separate physical network terminals and Microsoft SSO were not tested.
The standalone harness emitted logging-classpath warnings but exited with code 0.

## Previous run

Date: 2026-09-23
Target: http://localhost:8082 (updated workspace build, live-test profile)
Database: local PostgreSQL 17.8, ulwembut / demo_clinic

Flyway successfully migrated demo_clinic from V35 to V36. A temporary test user
was inserted for the checks and removed afterward with its role and audit rows.
Existing user passwords and account data were not modified.

Passed checks:
- Initial login and /api/v1/auth/me return HTTP 200.
- A second login revokes the first JWT: /auth/me returns HTTP 401.
- The revoked response includes the displacement message and X-Session-Status.
- CORS exposes X-Session-Status to the browser.
- The replacement JWT remains valid.
- Incorrect password returns 401 and preserves the current session.
- A stale-token logout returns 401 and does not revoke the replacement session.
- Five simultaneous login requests all succeed; exactly one resulting JWT remains valid.
- The audit API exposes SESSION_DISPLACED events.
- PostgreSQL contains exactly six displacement events for the test user, each
  with before/after session IDs, IP address, and device signature.
- Active logout returns 204; replay of the logged-out JWT returns 401.
- Both registry columns are NULL after logout.

29 assertions passed. Temporary test rows were removed. The extra API process
on port 8082 was stopped after testing. The original server on port 8081 was
left running and should be restarted from the updated source to use this change.
V36 remains applied to the local database.

These HTTP requests used distinct User-Agent terminal identifiers on the same
machine. Separate physical network terminals and Microsoft SSO were not exercised.

