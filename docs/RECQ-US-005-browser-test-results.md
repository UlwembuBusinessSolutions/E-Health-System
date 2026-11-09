# RECQ-US-005 browser verification

Date: 2026-09-10

**PASS: 9 browser scenarios.** Headless Google Chrome drove the actual React frontend against a real Spring Boot server and PostgreSQL. No API responses were mocked.

## Verified

- Nurse signs in through the UI and sees all three server-backed tokens
- Stop removes the token from the waiting queue; Resume remains available after reload
- Resume preserves priority, persisted issue time and identity; called token survives reload
- Complete from Called records the timestamp and removes the token from the UI
- Called → In service → Completed works through the UI
- Mobile cancellation requires a reason, sends the selected code, and removes the token
- Completed/cancelled tokens stay removed after reload; empty queue disables Call next
- Every browser lifecycle action is persisted in the audit log, including cancellation reason
- No JavaScript page errors or failed API responses

Desktop viewport: 1440 ? 1000. Mobile-width viewport: 390 ? 844. The mobile queue table scrolls horizontally to reach the action controls; this is a viewport test, not a physical mobile-device test.

The first attempt timed out waiting for all login-page resources. The harness now waits for DOM readiness and the visible controls, with longer navigation timeouts. The successful rerun required no application code changes.

The temporary frontend and backend servers were stopped, and the fixture database and credentials file were removed. Existing clinic records were not changed.

## Screenshots

- [01-queue-desktop.png](queue-browser-screenshots/01-queue-desktop.png)
- [02-stopped-after-reload.png](queue-browser-screenshots/02-stopped-after-reload.png)
- [03-mobile-cancellation.png](queue-browser-screenshots/03-mobile-cancellation.png)
- [04-empty-queue-mobile.png](queue-browser-screenshots/04-empty-queue-mobile.png)

## Repeat the test

Install the browser driver once:

```powershell
npm.cmd install --prefix .tools/browser playwright --no-audit --no-fund
```

Start the fixture in one terminal:

```powershell
& ./.tools/apache-maven-3.9.9/bin/mvn.cmd -o test '-Dqueue.live.tests=true' '-Dqueue.browser.hold=true' '-Dtest=QueueLifecycleLiveApiTest'
```

Run the browser in another terminal (Chrome must be installed):

```powershell
node scripts/verify-queue-browser.cjs '<absolute-frontend-directory>'
```

The fixture waits up to ten minutes for browser completion and cleans up its database in a finally block. Browser results and screenshots are written to target/queue-browser.
