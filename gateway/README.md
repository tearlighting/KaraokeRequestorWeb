# Yukari Web Gateway

The Gateway owns HTTP entry points only. Fastify remains the owner of identity,
authorization, APIs, reservations, queue and player commands.

## Entry points

- `web` / Apache: loopback-only `127.0.0.1:8180`; Legacy PHP compatibility and
  production User/Admin React routes. This remains the local recovery/admin URL.
- `user-lan` / Nginx: LAN port `${USER_LAN_PORT:-8181}`; `/user/*` and `/admin/*`
  React routes plus a method/path allowlist to Fastify. Admin APIs still require
  Fastify's authenticated Admin session, role and CSRF checks. Unknown paths,
  PHP, Agent, MySQL and Everything are not proxied.
- `gateway-tunnel` / Nginx: internal-only User Web and the User API allowlist.
  It is part of the default Compose project so ordinary builds update public
  User assets together with LAN assets. It has no published port and contains
  no Admin route. Its internal availability does not expose it to the Internet.
- `cloudflared`: optional `tunnel` profile, routes to `gateway-tunnel:8080` only.
  This is the only public connector and remains excluded from ordinary Compose
  runs. Enabling or stopping it controls actual public reachability.
  Configure the token and hostname routing in Cloudflare yourself. Compose does
  not create a tunnel, DNS record, certificate, firewall rule or public route.
  See [Cloudflare Tunnel setup (Chinese)](CLOUDFLARE_TUNNEL.zh-CN.md) for the
  exact allowlist and HTTPS validation steps.

The historical `docker/user-lan.nginx.conf` and `docker/apache-private.conf`
remain as source-compatible copies for existing local edits; Compose builds and
mounts the canonical policies from this directory.

## Commands

From the repository root, normal updates remain:

```powershell
docker compose up -d --build
```

The same command works from `docker/`; its local `.env` sets `COMPOSE_FILE` to
the repository-root Compose file, which then loads the repository-root `.env`.
The default Compose model includes `user-lan` (User + Admin assets) and
`gateway-tunnel` (User assets), so one build refreshes all three entry paths.
`cloudflared` remains in the `tunnel` profile. Compose does not start a missing
or stopped profiled service unless that profile is explicitly selected, and a
running profiled service is left running when omitted from `up`. Thus an
ordinary update refreshes the internal Gateway while preserving whether the
public connector was running or stopped.

An optional script remains available for operators who specifically want to
update only User Gateway images without rebuilding other services:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\Update-UserWeb.ps1
```

See the [User Web update runbook](../docs/USER_WEB_UPDATE.zh-CN.md) for its
version and cache checks.

The optional public User-only path requires a token in the ignored repository
root `.env` and a Cloudflare hostname route to `http://gateway-tunnel:8080`.
See [Cloudflare Tunnel setup](CLOUDFLARE_TUNNEL.zh-CN.md). Enable the dedicated
User-only origin and connector with the explicit profile:

```powershell
docker compose --env-file .env --profile tunnel up -d cloudflared
```

To stop public access (the internal User-only origin may continue running):

```powershell
docker compose --env-file .env --profile tunnel stop cloudflared
```

Do not target Apache, Fastify, the LAN Admin Gateway or a host-published port.
