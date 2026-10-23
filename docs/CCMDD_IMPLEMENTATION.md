# CCMDD pick-up point directory and parcel tracing

**Epic:** EP-10 PHRM · **Feature:** PHRM-F03 Stock Control & Expiry Management  
**Stories:** Both Must-priority stories, 5 points each.

## Implemented acceptance criteria

| Requirement | Implementation | Test |
|---|---|---|
| Dispatched parcel notifies pick-up point | `POST /api/v1/pharmacy/ccmdd/parcels` creates a tenant-scoped parcel and queues an email to the cached SYNCH pick-up point's registered contact | Dispatch a fully dispensed prescription and inspect notification status; check captured email in backend `data/emails` in dev |
| Collection status tracked | Status transition endpoint, dispatch/ready/collected/returned timestamps, tracking reference and audit | Update READY → COLLECTED in pharmacy > CCMDD and check parcel card |
| Uncollected patient appears on tracing work list | Due date = dispatch time + configured tracing days; database queries only outstanding parcels past deadline | Use 1 tracing day and advance system clock in a test environment, then check `GET /tracing` |
| National pick-up points from SYNCH, filtered by area | Configured HTTPS SYNCH JSON client, stored master list, name/code/province/district/area search | Configure SYNCH endpoint, refresh and filter in pharmacy > CCMDD > SYNCH pick-up points |
| SYNCH unavailable: cached list used and clearly stale | Persisted per-tenant cache, last-success timestamp, failed refresh cooldown, source/fallback/stale flags | Sync successfully, disconnect the endpoint, then force refresh and verify stale warning with last sync time |

## Browser workflow

Sign in with a tenant staff account that has **PHRM:VIEW** (view) and **PHRM:MANAGE** (to dispatch, notify and mark collected). Open **Pharmacy → CCMDD**. The page has **Parcel status tracking**, **SYNCH pick-up points**, and **Uncollected tracing list** sections. To dispatch, choose a tenant facility, find a fully dispensed prescription by its **exact serial number**, select an active point, and set tracing after 1–90 days. The queued notification status is deliberately distinguished from verified SMTP delivery.

Once dispatched, click **Mark ready / notify point** when the parcel becomes available at the point. Mark **Collected** when collection is confirmed. An open parcel appears on the tracing list only after its deadline, where the pharmacist records contact attempts until it is collected or returned. A parcel can be traced more than once, with the last note and attempt count preserved.

## Running with Docker

Extract the complete archive so backend and frontend directories are **siblings**. Open PowerShell in `E-Health-System-dev-backend-ulwembu`:

```powershell
# Supply an actual authorized SYNCH HTTPS endpoint and token (if required).
$env:CCMDD_SYNCH_URL="https://your-synch-server.example/api/pickup-points"
$env:CCMDD_SYNCH_TOKEN="YOUR_TOKEN"
$env:CCMDD_TRACING_DAYS="7"
docker compose up --build -d
docker compose ps
docker compose logs -f api
```

Frontend: http://localhost:5173 · Backend: http://localhost:8081 · PostgreSQL: localhost:5432. If 5432 is occupied, set `$env:POSTGRES_PORT="5433"` before `docker compose up`. The tenant Flyway runner automatically applies `V59__ccmdd_parcels_and_synch_directory.sql`. Docker builds Maven and npm dependencies in their Linux images; **do not** package local Windows `node_modules` into the ZIP.

## SYNCH contract

The real government/partner SYNCH endpoint and API credentials were not provided in the upload. There is **no invented national directory**: point assignment is unavailable until the real service has returned data at least once. The backend accepts a JSON array, `{ "items": [...] }`, or `{ "pickupPoints": [...] }`; each record requires `id`/`pickupPointId`/`synchId`/`code` and `name`/`pickupPointName`/`displayName`. Optional fields: `province`, `district`, `area`, `address`, `contactEmail`, `active`. Map actual integration response fields if the authorized SYNCH API differs from this provisional adapter. Endpoint URL and credentials are exclusively backend environment variables. HTTPS is mandatory for remote connections; plain HTTP is allowed for localhost developer fixtures only. Cache refresh defaults to 60 minutes, with forced refresh via PHRM:MANAGE.

On network failure the previous **active** point list is retained. The UI reports **CACHED · STALE / NOT VERIFIED** and shows the last successful sync; without cache it reports **UNAVAILABLE**. Retired points cannot be assigned but remain linked to historic parcels. No fake or imported point records are presented as SYNCH data.

## Data/security and limitations

- The tenant's PostgreSQL schema stores directory snapshots, parcel statuses, due times and tracing notes. The system never silently deletes a traced patient from the list until collection or return.
- A single CCMDD parcel is allowed per prescription. A fully dispensed prescription and active SYNCH point are required. Facility IDs are verified against the prescription and parcel; module permissions protect every endpoint. Fine-grained individual clinician facility-scope authorization follows the host application's existing identity model and is not added in this story.
- Email notifications contain only the tracking reference and collection point, **not** patient name, MPI, medicine or diagnosis. An email notification marked `QUEUED` means the async delivery worker accepted it; it **does not** prove the recipient received it. Missing contact email shows `NOT_CONFIGURED`; a queue-time error shows `FAILED`. Delivery receipts, SMS gateways and government SYNCH production credentials require separate integration.
- Use HTTPS and a real SMTP provider for live delivery. Production suitability also depends on operational security/privacy review, including who may view tracing notes and patient contact details.

## Developer checks

```powershell
cd E-Health-System-dev-backend-ulwembu
mvn test
cd ../E-Health-System-dev-frontend-ulwembu
npm ci
npm run build
```

The included JUnit tests cover directory JSON validation, HTTPS enforcement, duplicate point IDs, parcel preconditions and tracing-list filtering. The UI compile was verified using TypeScript; a complete Maven/production bundle cannot be executed in the limited authoring environment.


## National directory story verification

Pharmacy > CCMDD opens the SYNCH pick-up point directory. Search by name or code and filter by province, district and area. Only active points from the synchronized master list are listed. Select **Assign to parcel** to carry a location into dispatch.

When a refresh fails, the saved tenant list remains available with **Cached SYNCH master list**, **STALE / NOT VERIFIED**, and the last successful synchronization timestamp. Without a previously synchronized directory, the page explains that no cached list is available. An empty filtered result instead asks the user to change or clear filters.

Focused validation: `mvn -q "-Dtest=SynchDirectoryClientTest,CcmddDirectoryServiceTest" test` (7 tests). This validates the adapter and cache behavior with test fixtures; it does not prove connectivity to the production national SYNCH service. Production verification requires an authorized endpoint and credentials.
