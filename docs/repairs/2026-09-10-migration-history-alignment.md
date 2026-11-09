# Local migration history alignment

The `ulwembus` database had seven unchanged tenant SQL migrations recorded under an older numbering scheme. Flyway correctly refused startup because those version numbers now refer to different scripts in the repository.

The repair verified the exact Flyway CRC32 checksums of all seven local SQL files against the applied histories in `amo`, `demo_clinic`, `fourways`, `water`, and `waterford`. It then updated only `version` and `script` in those history rows, in a single transaction. Checksums, execution timestamps, installed ranks, and application records were preserved.

| Migration | Recorded version | Repository version |
| --- | --- | --- |
| Pharmacy named patient dispensing | 15 | 21 |
| Pharmacy stock movements | 16 | 20 |
| Triage assessments | 17 | 19 |
| Patient passport number | 19 | 15 |
| Patient deceased | 20 | 16 |
| Audit log filter indexes | 21 | 17 |
| Audit log privileged | 22 | 18 |

Pre-repair history backup: `target/migration-history-backup/ulwembus-before-alignment.sql`.

The accompanying SQL file is a one-time, guarded repair for that database and old mapping. It intentionally fails if the seven expected old rows do not match, including after the repair has already been applied. Do not rerun it as a migration or disable Flyway validation. Future migration version numbers should remain unchanged once applied.

Verification: `mvn spring-boot:run` successfully validated all five tenant histories and applied V24 to each tenant. The application reached ACCEPTING_TRAFFIC and `GET http://localhost:8081/actuator/health` returned HTTP 200 with status UP.
