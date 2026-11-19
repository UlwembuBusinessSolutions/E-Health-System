# Ulwembu frontend

React/Vite frontend for the Spring Boot API in the separate `E-Health-System-dev-backend-ulwembu` project. The frontend and backend folders are siblings under `NewProject`.

## Prerequisites

- Node.js and npm
- Java 21 and Maven for a native backend run
- PostgreSQL 16, either locally or through Docker Compose

## Start the backend

Open a PowerShell terminal at `NewProject` and run:

```powershell
Set-Location .\E-Health-System-dev-backend-ulwembu\E-Health-System-dev-backend-ulwembu
```

Start PostgreSQL with `docker compose up -d postgres` if Docker is available and port 5432 is free. Otherwise, configure `DB_URL`, `DB_USERNAME`, and `DB_PASSWORD` to match an existing PostgreSQL database. Then start the API:

```powershell
.\run-local.ps1
```

Confirm it is ready:

```powershell
Invoke-RestMethod http://localhost:8082/actuator/health
```

The response should report `UP`.

## Start the frontend

In a second PowerShell terminal at `NewProject`:

```powershell
Set-Location .\E-Health-System-dev-frontend-ulwembu\E-Health-System-dev-frontend-ulwembu
npm ci
npm run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`; if that port is occupied, Vite selects another). Vite proxies `/api`, `/platform`, and `/actuator` to the backend at `http://localhost:8082`, so local browser requests use one origin. If the backend uses another address, set `BACKEND_PROXY_TARGET` before `npm run dev`:

```powershell
$env:BACKEND_PROXY_TARGET = 'http://localhost:8181'
npm run dev
```

For deployments where the frontend and backend are served from different origins, set `VITE_API_BASE_URL` to the backend origin and configure the backend's `CORS_ALLOWED_ORIGINS` to include the frontend origin.

## First platform login

On a fresh development database, the backend's `dev` profile creates the initial platform operator from `PLATFORM_BOOTSTRAP_*`. The defaults are `ops@ulwembu.example` and `ChangeMe123!`; override them before starting the backend if needed.

Use `/platform/login` to create an organization and its first staff account. Staff sign-in uses the organization slug, staff email, and the one-time password returned during organization setup. Tenant selection is currently by slug rather than subdomain.

## Project layout

- Backend: `E-Health-System-dev-backend-ulwembu/E-Health-System-dev-backend-ulwembu/src/main/java` and `src/main/resources/db/migration`
- Frontend API clients: `E-Health-System-dev-frontend-ulwembu/E-Health-System-dev-frontend-ulwembu/src/shared/api`
- Frontend Vite integration: `E-Health-System-dev-frontend-ulwembu/E-Health-System-dev-frontend-ulwembu/vite.config.ts`

Real email delivery and S3 uploads require their respective provider credentials. In local development, email messages are captured to disk and uploads need AWS credentials.