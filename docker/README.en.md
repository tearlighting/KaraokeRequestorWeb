# Docker Development Environment

Phase 6: the original queue database now lives in `legacy/php/runtime/queue/`. Node mounts only that directory read-only; PHP remains the sole business writer and maintains WAL/SHM availability. Legacy swipe reads use a short-lived queue-only capability. Existing databases require an approved stopped-writer relocation; never create a replacement queue.

Phase 4: legacy PHP sources and local runtime data now live in `legacy/php/`, mounted at Apache `/var/www/html`; browser URLs are unchanged. The repository is also mounted read-only at `/workspace` for CLI checks. The legacy UI proxies only Node-native `/api/v1/meta/health`; business remains PHP-owned. See [compatibility](../docs/LEGACY_COMPATIBILITY.md).

## Phase 3 endpoints

From the repository root, run `docker compose -f docker/compose.yaml up --build -d`. This starts legacy PHP at http://127.0.0.1:8080 and the unified Node API at http://127.0.0.1:3000/health. Both ports bind to loopback. A one-shot service initializes the private bridge credential; PHP remains the only database writer.

Run `npm ci` and `npm run dev` separately in `apps/user-web` and `apps/admin-web` (use `npm.cmd` in PowerShell). They use ports 5173 and 5174 and proxy Node `/api/v1`, not PHP. The new admin login requires a nonempty legacy configuration password. See the [API Server README](../apps/api-server/README.md) and [progress record](../docs/REFACTOR_PROGRESS.md).

This setup is for local development and UI testing of the Yukari Web UI on Windows 11 with Docker Desktop. PHP/Apache runs in a Linux container. Windows players are not included, and this configuration is not intended for production.

## Requirements

- Windows 11 with Docker Desktop installed and running.
- Docker Desktop configured for Linux containers (the WSL 2 backend is recommended).
- Run the following commands from the repository root, `KaraokeRequestorWeb`.

## Start

```powershell
docker compose -f docker/compose.yaml up --build
```

The first run builds a PHP 8.2 + Apache image and installs the required PHP extensions. Once Apache starts, open <http://localhost:8080>. To run it in the background:

```powershell
docker compose -f docker/compose.yaml up --build -d
```

View logs:

```powershell
docker compose -f docker/compose.yaml logs -f web
```

Stop and remove the container:

```powershell
docker compose -f docker/compose.yaml down
```

## Development and limitations

- Compose mounts the repository root as a read-write bind mount at `/var/www/html`. Changes to PHP, CSS, JavaScript, or images are available after refreshing the browser; rebuilding the image is unnecessary.
- Configuration, SQLite databases, uploaded images, and other runtime files remain in the repository workspace. Stopping or recreating the container does not delete them.
- The entrypoint grants workspace write permissions for local development. Use this only in a trusted local environment; do not use it in production or for a publicly exposed service.
- SQLite/PDO SQLite, mbstring, cURL, GD, ZIP, and other required PHP extensions are enabled. The default timezone is `Asia/Tokyo`.
- Windows players such as MPC-BE and foobar2000, Windows song folders, player control, and features requiring local devices or privileges are not integrated. Without a media library, the search and request pages can be used for UI development, but actual tracks cannot be played.
- External integrations such as Google Drive require their own credentials. External CDNs and online services require network access.

## Troubleshooting

- If port 8080 is already in use, stop the program using it.
- If the `docker` command is not recognized, install and start Docker Desktop, then reopen PowerShell.
- For PHP errors, inspect `docker compose -f docker/compose.yaml logs web`. Common causes include an image build failure, workspace write permissions, or using a feature that depends on a Windows player.
- `docker compose ... down` does not delete workspace data. Do not manually remove configuration files or SQLite databases unless you intend to reset the local state.
