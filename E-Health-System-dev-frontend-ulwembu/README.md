# ulwembu

Multi-tenant clinic staff management platform — a real Spring Boot backend (`api/`) plus a React/Vite frontend (`src/`). This file is the fast path to running both on a new machine. For the full design/API reference, see `backend-auth-guide.html` and `api-reference.html` (open either directly in a browser).

## Prerequisites

- **Docker Desktop** — required either way
- **Java 21** (Temurin recommended) + **Maven** — only if running the backend natively (Option B below)
- **Node.js** (18+) and npm — for the frontend either way

## Option A — one command for database + backend

```bash
cd api
docker compose up -d
```

That's it — this single command builds the backend image (multi-stage `Dockerfile`: Maven build, then a slim JRE runtime) and starts both Postgres and the API together, with the container-to-container networking already wired (the api container reaches Postgres at its service name, not `localhost`). First run takes a minute or two to build; after that it's fast.

Confirm it's up: `curl http://localhost:8081/actuator/health` → `{"status":"UP"}`

Skip straight to [step 3, Frontend](#3-frontend) — the backend's already up on `http://localhost:8081`.

This path doesn't read `api/.env` — real SMTP/AWS credentials still need to be added directly to `api/docker-compose.yml`'s `api.environment` block (or a `docker-compose.override.yml`, which Compose merges in automatically) if you need real email/upload delivery from the containerized backend. Everything else works with zero configuration, same as Option B below.

## Option B — run the backend natively (better for actually developing it)

Native gives you normal debugging, hot-reload-on-recompile, and IDE integration — worth it once you're editing backend code rather than just running it.

### 1. Database only

```bash
cd api
docker compose up -d postgres
```

Starting just the `postgres` service (not `api`) avoids building the backend image at all — this starts Postgres 16 on the standard port `5432`, with a database/user/password (`ulwembu` / `ulwembu` / `ulwembu_dev_local`) that already matches `application.yml`'s built-in local-dev defaults.

If port `5432` is already in use by another Postgres instance on your machine, either stop that one first or remap the port in `api/docker-compose.yml` and set `DB_URL` accordingly.

### 2. Backend

```bash
cd api
cp .env.example .env   # then fill in real values — see below
mvn spring-boot:run
```

`.env` isn't automatically loaded by Spring Boot — export it into your shell first, or use a tool that does (`direnv`, an IDE run-config with an env-file option, etc.):

```bash
set -a && source .env && set +a
mvn spring-boot:run
```

**What actually needs a real value in `.env` vs. what already works out of the box:**

| Setting | Works with defaults? | Needed for |
|---|---|---|
| Database | Yes — matches step 1 | Everything |
| `JWT_SECRET` / `PLATFORM_JWT_SECRET` | Yes — real generated defaults baked into `application.yml` | Local dev only; generate your own for anything beyond a laptop |
| `PLATFORM_BOOTSTRAP_*` | Yes — creates `ops@ulwembu.example` / `ChangeMe123!` on first boot | Your first login (see step 4) |
| `SMTP_*` / `NOTIFICATIONS_FROM_ADDRESS` | No real send without real values | Actual email delivery — without these, every email is still captured to `./data/emails/` and safely fails, so nothing breaks, you just won't get real inbox delivery |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `STORAGE_*` | No real upload without real values | Staff photo / organization logo upload — fails gracefully (500, logged) without these |

The backend runs and is fully usable for everything except real email and real file uploads with zero `.env` changes at all. On first boot it automatically: runs Flyway migrations against the shared `control` schema, and creates the first platform operator account from `PLATFORM_BOOTSTRAP_*`.

Confirm it's up:

```bash
curl http://localhost:8081/actuator/health
# {"status":"UP"}
```

## 3. Frontend

```bash
cp .env.example .env   # VITE_API_BASE_URL=http://localhost:8081 by default — only change if the backend runs elsewhere
npm install
npm run dev
```

Opens on `http://localhost:5173` (or the next free port after it).

## 4. First login

**Platform side** (create client organizations) — `http://localhost:5173/platform/login`:

```
Email:    ops@ulwembu.example
Password: ChangeMe123!
```

(Or whatever you set `PLATFORM_BOOTSTRAP_EMAIL`/`PLATFORM_BOOTSTRAP_PASSWORD` to in `.env`.)

From there, **New organization** creates a real client org with one or more admin accounts — the temporary password for each is shown exactly once in the response, so copy it immediately.

**Staff/org-admin side** — `http://localhost:5173/login` — needs three things: the organization's slug (whatever you typed when provisioning it), the admin's email, and that one-time temporary password from above. There's no subdomain-based tenant resolution yet, so the login screen has an explicit "Organization" field for this.

## Project layout

```
api/                    Real Spring Boot backend
  docker-compose.yml     Postgres + api (backend) for local dev — see Option A/B above
  Dockerfile              Multi-stage build for the api service (Maven build -> JRE runtime)
  .env.example           All overridable settings, with local-dev defaults noted
  src/main/java/...       co.ehealth.platform — core/ (shared infra), identity/, facility/, platform/
src/                     React/Vite frontend
  shared/api/             Real backend calls (platform.ts, auth.ts, staff.ts, organization.ts) + still-mocked ones (facilities.ts, roles.ts, password reset)
backend-auth-guide.html  Full backend design doc — schema, security model, every service, every bug found and fixed
api-reference.html       Endpoint-by-endpoint reference — request/response shapes, error catalog, frontend/backend drift tracking
```

## Known rough edges, worth knowing before you start

- **Option A (containerized backend) hasn't been run end to end** — no Docker daemon was available in the environment this was built in. The `Dockerfile`/`docker-compose.yml` were checked for correct syntax, and the exact Maven build the image runs (`mvn package -DskipTests`) was confirmed to succeed and produce a real jar — but the actual `docker compose up` (image build, container networking, the app connecting to Postgres via the `postgres` hostname) is unverified. Worth a close eye the first time someone actually runs it. Option B (native) has been run and tested extensively.
- No automated test suite yet — everything above was verified by hand against a running instance.
- Real email delivery and real S3 upload both need credentials you'll have to provision yourself (SMTP account, AWS bucket + IAM user) — see `backend-auth-guide.html` Section 7 for the exact setup.
- The frontend's tenant resolution is a manual slug field, not real subdomain routing — fine for local testing, not how a real deployment would work.
- Several screens (facilities list, roles list, password reset) are still on frontend mocks, not the real backend.
