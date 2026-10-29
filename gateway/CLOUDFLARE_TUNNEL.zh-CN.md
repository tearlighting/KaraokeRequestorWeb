# Cloudflare Tunnel（可选）

Tunnel 默认关闭。普通 `docker compose up -d --build` 不会启动 `cloudflared`，也不会公开任何入口。Tunnel 使用官方 `cloudflare/cloudflared` 镜像，连接到 Compose 内部的 `gateway-tunnel:8080`；它不在 Windows 宿主机安装客户端，也不发布宿主机端口。

## 首次配置

1. 在 Cloudflare Zero Trust 中创建或选择一个**远程管理**的 Tunnel，添加 Public Hostname。DNS/Cloudflare 资源由管理员在 Cloudflare 控制台配置，本项目不会创建或修改它们。
2. 将该 hostname 的 Service 指向 `http://gateway-tunnel:8080`。不要指向 `web`、`api-server`、`user-lan`、Windows 主机端口或 MySQL。
3. 将 Tunnel Token 放入仓库根目录被 Git 忽略的 `.env`：

   ```dotenv
   CLOUDFLARE_TUNNEL_TOKEN=<Cloudflare 提供的 Tunnel Token>
   ```

   `.env.example` 仅提供空变量示例。不要把 Token 放进 Compose 命令行、源码、截图或 Git。
4. 在 Admin → System → 房间连接中，将公开 User URL 配置为 `https://<你的 hostname>/user/`，验证地址后再选择公开入口。Fastify 只接受与已保存 HTTPS 主机完全匹配的 User 请求来源。
5. 从仓库根目录显式启动 Tunnel Profile：

   ```powershell
   docker compose -f docker/compose.yaml --profile tunnel up -d --build gateway-tunnel cloudflared
   ```

## 停止与验证

停止公网连接并关闭专用 Gateway（不会停止 LAN Gateway、API 或 MySQL）：

```powershell
docker compose -f docker/compose.yaml --profile tunnel stop cloudflared gateway-tunnel
```

通过浏览器或 `curl.exe -i` 验证 Cloudflare hostname：

- `https://<hostname>/user/` 应返回 User Web。
- `https://<hostname>/admin/`、`/admin/assets/...` 应由 Tunnel Gateway 返回 404。
- `/api/v1/admin/session`、`/api/v1/admin/queue`、`/api/v1/settings`、`/api/v1/playback/control` 以及未列入白名单的 `/api/v1/agent/...` 应由 Gateway 返回 404。
- User 所需 API（例如 `/api/v1/capabilities`、`/api/v1/search`、`/api/v1/queue`、`/api/v1/requests`）继续经过 Fastify 的会话、Origin 和 CSRF 校验。不能用 HTTP 200 代替搜索或预约业务结果验证。

Tunnel Nginx 镜像只包含 React User 静态文件；`/api/v1/` 只允许 `gateway/nginx/tunnel-user.conf` 中按方法和精确路径列出的 User API，其余路径默认拒绝。Admin 静态文件不会进入该镜像。LAN 入口仍使用原来的 Gateway 配置和端口，不受 Tunnel Profile 影响。cloudflared 的 metrics 端口只在 Compose 网络内部 `expose`，没有宿主机端口映射。

## HTTPS 与连接限制

Cloudflare 在公网侧提供 HTTPS，Tunnel 到 Gateway 使用 Compose 内部 HTTP。User 浏览器与 API 使用同源 `/api/v1/...` 请求，因此不需要开放额外 CORS；用户会话仍使用 `HttpOnly; SameSite=Strict` Cookie，HTTPS 登录响应会附加 `Secure`。Gateway 将原始 Origin 和 Host 交给 Fastify 的受信入口检查，设置公开 URL 并选择 `public` 后，其他主机来源会被拒绝。Admin 来源配置不包含公开 hostname，且 Tunnel Gateway 不提供任何 Admin 路由。

Tunnel Gateway 保留 HTTP/1.1 Upgrade/Connection 转发和 60 秒读超时，以兼容 WebSocket/长连接；浏览器仍不能直连 Agent 或 mpv。当前房间公开 URL 来自 Admin 保存并验证的连接设置，不从任意请求 Host 拼接。

如果 Token 尚未配置，不要启动 `tunnel` Profile。Profile 启动不创建 Tunnel、DNS 或路由，仍需 Cloudflare 控制台完成 hostname → `http://gateway-tunnel:8080` 的指向。Token 仅在容器环境中提供给官方 `cloudflared` 客户端；Compose 状态输出或诊断中不得打印其值。
