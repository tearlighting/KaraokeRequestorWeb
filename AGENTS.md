# Development rules

- `apps/user-web`, `apps/admin-web`, `apps/api-server` are the new TypeScript system; `legacy/php/` is compatibility code and the behavior reference. `packages/contracts/` owns shared wire contracts. See [migration/Owner matrix](docs/LEGACY_COMPATIBILITY.md) and [progress](docs/REFACTOR_PROGRESS.md).
- Inspect branch, index, untracked files and local changes first. Preserve user edits and runtime data; do not stage whole directories blindly. No automatic commit/push/force-push, `reset --hard`, volume deletion, real database recreation/schema migration or actual password changes.
- Prefer TypeScript for new features. Modify PHP for compatibility or PHP-owned modules only. Do not copy a PHP subsystem into TypeScript without behavior comparisons. Each module has one authoritative writer. A PHP Adapter call is not Node-native. Update the Owner matrix and compatibility tests whenever ownership changes.
- Keep `/api/v1` contracts compatible; validate inputs and domain outputs with Zod. Return `{ok:true,data}` or `{ok:false,error:{code,message,...}}`. Preserve actionable failures; never turn failures into empty success or retry uncertain Legacy writes.
- Authorize on the server, not in Vite. Preserve user/admin role and Origin separation, JSON/custom-header CSRF checks, HttpOnly sessions, nonempty legacy admin password and per-operation proof verification. Never trust caller role/IP headers. Bridge credentials are server-only; no credential/body logging or password persistence. Legacy Basic identity does not imply a Node session.
- Business ownership follows the current Owner matrix, not historical defaults. Phase 8 moves reservation creation/replacement to Node after equivalence tests. Its only schema addition is the separately approved, explicit `request_submission` migration; never run schema DDL during startup. PHP remains owner for search, metadata/lifecycle, settings/playback writes and unconverted legacy operations. Read-only adapters must not initialize DBs. SQLite paths are fixed/configured and WAL-aware; resolve paths explicitly, never from process CWD or browser input.
- Never expose or commit actual passwords, INI/runtime configuration, databases/journals, Bridge credentials, private keys, media, logs, node_modules/dist or test artifacts. `.gitignore` does not remove already tracked INI/PPK files; review index and diffs separately. Do not print raw configuration in diagnostics.
- Keep `origin` (tearlighting) and `upstream` (bee7813993) distinct. Analyze upstream changes before deciding whether to port to Node or retain Legacy; do not blindly overwrite Legacy or automatically merge/reset protected branches. Keep original PHP URLs available; avoid PHP → Node → PHP loops and duplicate writes.

## Commands (repository root; use npm.cmd in PowerShell)

```powershell
docker compose -f docker/compose.yaml up --build -d
docker compose -f docker/compose.yaml exec -T web php /workspace/docker/check-php.php
docker compose -f docker/compose.yaml exec -T web php /workspace/apps/api-server/tests/php/auth-check.php
docker compose -f docker/compose.yaml exec -T web php /workspace/apps/admin-web/tests/php/admin-auth-check.php
npm.cmd --prefix apps/api-server run typecheck
npm.cmd --prefix apps/api-server run build
npm.cmd --prefix apps/api-server test
npm.cmd --prefix apps/user-web run build
npm.cmd --prefix apps/user-web run test:e2e
npm.cmd --prefix apps/admin-web run build
npm.cmd --prefix apps/admin-web run test:e2e
```

All three apps have `typecheck`, `build`, `dev` scripts; install with `npm.cmd ci` in each app. Real regression tests require the synthetic isolated Compose deployment and installed Edge; test credentials must not enter traces. Never run Phase 7 write regression against deployed data; use the isolated test runbook below. User/admin Vite ports are 5173/5174, API 3000, Legacy 8080, bound locally. See [API runbook](apps/api-server/README.md) for environment configuration.

Phase 5: Node owns GET settings projection; PHP owns PUT. Keep the single config-file mount read-only; never log/return its other fields. PHP session checks remain mandatory before/after the native read. See the compatibility document for supported INI syntax, fresh-checkout bootstrap and atomic-replacement mount limitations.

Phase 6: user/admin queue reads are Node-native; PHP remains the writer and owns initialization/WAL side-file lifecycle. Mount only `legacy/php/runtime/queue/` read-only to Node, never the whole Legacy tree. Legacy queue tickets are short-lived read-only capabilities, never Node admin sessions; preserve their signature, Origin, UA and policy-revocation checks. Runtime DB relocation requires explicit approval and stopped writers with hash verification.

Phase 7: administrator delete/up/down/warikomi are Node-owned in Compose (`YUKARI_NODE_QUEUE_MUTATIONS=1`). Mount **only the dedicated queue directory** read/write; PHP and non-root Node share group 33. PHP still owns reservation creation/automatic placement, metadata/lifecycle, settings and playback writes. Notification-only PHP reuse is not a PHP queue writer. Preserve explicit committed-but-not-notified errors; never replay a committed mutation. Migrated Legacy HTTP writes fail 410 before bootstrap; do not restore them or grant write access with read tickets. See the Phase 7 matrix for the intentionally closed bulk/restore paths.

Phase 7 write regression must use synthetic `docker/compose.isolated.yaml` and `E2E_CONFIG_PATH`, not the deployed database, even with cleanup. See [isolated test runbook](docs/LEGACY_COMPATIBILITY.md#phase-7-isolated-test-runbook). Never run host Windows and container Linux SQLite simultaneously on the same WAL fixture; cross-runtime tests run both writers in Linux containers.

Phase 8 reservation writes use Node transactions and a durable hashed submission receipt in the same queue database. The additive migration is an explicit one-time CLI step after isolated oracle tests and approval; no startup migration or automatic retry. Reuse a receipt to resolve uncertain responses; never send it in URLs/logs. Legacy `exec.php` must forward through its authenticated compatibility adapter when Node ownership is enabled; do not retain a second PHP INSERT path in the deployed mode. Core request/history/receipt writes are atomic; notification is post-commit and may return a committed-but-notified error.

Phase 9 Player Agent runs on the Windows host, never in Docker. Set `MPV_PATH` to the explicit executable; never require global `PATH`. Agent Bearer credentials are independent of user/admin sessions; only admin sessions can create/control tasks, and public playback status is sanitized. Keep task state in its separate Player Agent volume; do not add queue SQLite schema or update `nowplaying` from the test-player workflow. Agent media paths must resolve beneath its configured host media root; spawn the configured mpv executable with fixed arguments and `shell:false`. Use mpv's local JSON IPC for observed playback state/end-file events; do not infer `playing`/`completed` from process launch, duration, timers, or keyboard simulation. The Agent may connect idle without `PLAYER_TEST_VIDEO`; do not create a test task until a real media file is configured beneath `PLAYER_MEDIA_ROOT`. Auto queue playback remains disabled until real-media path mapping and Legacy playback-mark/volume/progress side effects have isolated equivalence tests. Host setup/validation: [Player Agent README](apps/player-agent/README.md).
