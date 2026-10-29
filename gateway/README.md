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
  It has no published port and contains no Admin route.
- `cloudflared`: optional `tunnel` profile, routes to `gateway-tunnel:8080` only.
  Configure the token and hostname routing in Cloudflare yourself. Compose does
  not create a tunnel, DNS record, certificate, firewall rule or public route.
  See [Cloudflare Tunnel setup (Chinese)](CLOUDFLARE_TUNNEL.zh-CN.md) for the
  exact allowlist and HTTPS validation steps.

The historical `docker/user-lan.nginx.conf` and `docker/apache-private.conf`
remain as source-compatible copies for existing local edits; Compose builds and
mounts the canonical policies from this directory.

## Commands

Normal private/LAN operation remains:

```powershell
docker compose up -d --build
```

The optional public User-only path requires a token in the ignored repository
root `.env` and a Cloudflare hostname route to `http://gateway-tunnel:8080`.
See [Cloudflare Tunnel setup](CLOUDFLARE_TUNNEL.zh-CN.md). Enable the dedicated
User-only origin and connector with the explicit profile:

```powershell
docker compose -f docker/compose.yaml --profile tunnel up -d --build gateway-tunnel cloudflared
```

To stop the public connector and its dedicated origin:

```powershell
docker compose -f docker/compose.yaml --profile tunnel stop cloudflared gateway-tunnel
```

Do not target Apache, Fastify, the LAN Admin Gateway or a host-published port.
