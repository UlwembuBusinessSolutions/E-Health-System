# E-Health-System

Real Spring Boot backend (Java 21) for the multi-tenant clinic staff management platform. This branch is backend-only — no frontend here. For the full design/API reference, see `backend-auth-guide.html` and `api-reference.html` (open either directly in a browser).

## Prerequisites

- **Docker Desktop** — for Option A (one command), or just the database half of Option B
- **Java 21** (Temurin recommended) + **Maven** — only if running the backend natively (Option B)

## Option A — one command, database + backend

```bash
docker compose up -d
```

Builds the backend image (multi-stage `Dockerfile`: Maven build, then a slim JRE runtime) and starts Postgres + the API together, with container-to-container networking already wired (the `api` container reaches Postgres at the `postgres` service name, not `localhost`). First run takes a minute or two to build; after that it's fast.

Confirm it's up:

```bash
curl http://localhost:8081/actuator/health
# {"status":"UP"}
```

This path doesn't read `.env` — real SMTP/AWS credentials still need to go directly into `docker-compose.yml`'s `api.environment` block (or a `docker-compose.override.yml`, which Compose merges in automatically) if you need real email/upload delivery from the containerized backend. Everything else works with zero configuration.

## Option B — run natively (better for actually developing it)

Native gives you normal debugging, hot-reload-on-recompile, and IDE integration.

### 1. Database only

```bash
docker compose up -d postgres
```

Starts Postgres 16 on the standard port `5432`, with a database/user/password (`ulwembu` / `ulwembu` / `ulwembu_dev_local`) that already matches `application.yml`'s built-in local-dev defaults.

If port `5432` is already in use by another Postgres instance, either stop that one first or remap the port in `docker-compose.yml` and set `DB_URL` accordingly.

### 2. Backend

```bash
cp .env.example .env   # then fill in real values — see below
set -a && source .env && set +a
mvn spring-boot:run
```

`.env` isn't automatically loaded by Spring Boot — export it into your shell first (as above), or use a tool that does (`direnv`, an IDE run-config with an env-file option, etc.).

**What actually needs a real value in `.env` vs. what already works out of the box:**

| Setting | Works with defaults? | Needed for |
|---|---|---|
| Database | Yes — matches step 1 | Everything |
| `JWT_SECRET` / `PLATFORM_JWT_SECRET` | Yes — real generated defaults baked into `application.yml` | Local dev only; generate your own for anything beyond a laptop |
| `PLATFORM_BOOTSTRAP_*` | Yes — creates `ops@ulwembu.example` / `ChangeMe123!` on first boot | Your first login (see below) |
| `SMTP_*` / `NOTIFICATIONS_FROM_ADDRESS` | No real send without real values | Actual email delivery — without these, every email is still captured to `./data/emails/` and safely fails, so nothing breaks, you just won't get real inbox delivery |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `STORAGE_*` | No real upload without real values | Staff photo / organization logo upload — fails gracefully (500, logged) without these |

The backend runs and is fully usable for everything except real email and real file uploads with zero `.env` changes at all. On first boot it automatically: runs Flyway migrations against the shared `control` schema, and creates the first platform operator account from `PLATFORM_BOOTSTRAP_*`.

Confirm it's up:

```bash
curl http://localhost:8081/actuator/health
# {"status":"UP"}
```

## First login

Platform side (create client organizations) — `POST /platform/auth/login`:

```
Email:    ops@ulwembu.example
Password: ChangeMe123!
```

(Or whatever you set `PLATFORM_BOOTSTRAP_EMAIL`/`PLATFORM_BOOTSTRAP_PASSWORD` to in `.env`.)

From there, `POST /platform/organizations` creates a real client org with one or more admin accounts — the temporary password for each is shown exactly once in the response, so copy it immediately. See `api-reference.html` for the full request/response shapes, or `backend-auth-guide.html` Section 11 for the complete endpoint table.

## Project layout

```
docker-compose.yml     Postgres + api for local dev — see Option A/B above
Dockerfile              Multi-stage build for the api service (Maven build -> JRE runtime)
.env.example            All overridable settings, with local-dev defaults noted
src/main/java/...        co.ehealth.platform — core/ (shared infra), identity/, platform/
backend-auth-guide.html Full backend design doc — schema, security model, every service, every bug found and fixed
api-reference.html      Endpoint-by-endpoint reference — request/response shapes, error catalog
```

## Known rough edges, worth knowing before you start

- **Option A (containerized backend) hasn't been run end to end in every environment it's been developed in** — the `Dockerfile`/`docker-compose.yml` were checked for correct syntax, and the exact Maven build the image runs (`mvn package -DskipTests`) was confirmed to succeed and produce a real jar, but a Docker daemon wasn't always available to run the full `docker compose up` end to end. Option B (native) has been run and tested extensively, including the exact account-creation-email and search/filter/sort flows this branch adds.
- No automated test suite yet — verified by hand against a running instance.
- Real email delivery and real S3 upload both need credentials you'll have to provision yourself (SMTP account, AWS bucket + IAM user) — see `backend-auth-guide.html` Section 7 for the exact setup.
