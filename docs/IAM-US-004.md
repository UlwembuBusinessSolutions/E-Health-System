# IAM-US-004: Single active staff session

The tenant users row is the durable session registry: active_session_jti and
active_session_expires_at hold at most one session per account. Password and
Microsoft SSO login acquire a database write lock on that row before issuing
and registering a token. Concurrent logins serialize; the last committed login
wins. Different staff accounts and tenants remain independent. No IP address or
terminal location is used to decide whether a session is valid.

Each authenticated staff request checks the JWT session ID against the registry.
A displaced token receives HTTP 401 with X-Session-Status:
SESSION_REPLACED_OR_ENDED and a JSON message explaining that the session ended
because of another sign-in or logout. Notification occurs on the next request;
this backend does not push a message to an idle browser. The staff frontend now clears the matching token and cached queries, returns to the organisation login page, and displays a session-ended alert. This covers JSON requests and authenticated CSV downloads. The notice survives refresh and clears after successful password or SSO sign-in. Late responses cannot erase a newer token. Requests already executing
when another login commits are not cancelled.

SESSION_DISPLACED is written through AuditLogService in the login transaction,
with old and new session IDs, actor, timestamp, and the new request's IP and user
agent. JWT strings and passwords are not logged. Expired registry entries do not
produce displacement events. Local idle activity is updated after login commits.
Logout clears only the registry entry matching its session ID, so a delayed
logout cannot clear a replacement session.

Deployment: apply tenant Flyway V36 through the normal migration process before
using the updated application. Existing staff JWTs require a fresh sign-in.
Patient and platform-operator authentication are outside this staff story.

Verification: SingleActiveSessionTest covers replacement, SSO, notification,
terminal independence, failed login preservation, expired sessions, conditional
logout invocation, legacy tokens, and tenant mismatch. Run mvn test. A PostgreSQL
integration check should also exercise simultaneous logins in separate
transactions to verify locking and atomic audit persistence on the deployment
database.

Local verification (2026-09-23): Maven reported BUILD SUCCESS, 55 tests,
0 failures, 0 errors, 1 existing database test skipped. All six session tests
passed. This machine has JDK 25; its cached Byte Buddy requires the temporary
-Dnet.bytebuddy.experimental=true test flag. Command used:

    mvn -o -B -Dmaven.repo.local=C:/Users/nhlah/.m2/repository -Dnet.bytebuddy.experimental=true test

The V36 migration and concurrent transactions were not exercised against a live
PostgreSQL database in this run.
