# 更新 User Web（LAN 与公网 User Gateway）

在 `docker/` 目录执行日常更新（PowerShell）：

```powershell
docker compose up -d --build
```

`docker/.env` 通过 `COMPOSE_FILE=../compose.yaml` 指向仓库根 Compose；Compose 再读取仓库根 `.env`。默认服务包括 `user-lan`（LAN User + Admin）和 `gateway-tunnel`（公网 User-only origin），两者都使用 Dockerfile 中同一个 `user-web-build` 阶段，因此同一份 User Web 源码会生成相同的带哈希资源。

`gateway-tunnel` 不映射任何宿主机端口，只在 Compose 内部网络提供 HTTP。即使它随默认更新启动，公网也只有在 `cloudflared` 运行并连上 Cloudflare 时才可达。

默认 `up` 不包含 `cloudflared` Profile 服务。根据隔离 Compose 实测：

- connector 容器此前不存在：普通更新不会创建它。
- connector 此前停止：普通更新不会启动它。
- connector 此前运行：普通更新不会停止或重建它；Gateway 被替换后它仍可通过 Docker 服务名重新连接 origin。

因此“公网关闭”由 `cloudflared` 是否运行决定，而不是由 Gateway 是否在内部运行决定。

## 公网入口是独立操作

- **更新代码**：执行上面的普通 Compose 命令；无需额外脚本。
- **明确开放公网**：从仓库根目录执行 `docker compose --env-file .env --profile tunnel up -d cloudflared`。这会使用根 `.env` 中配置的 Token，并要求 Cloudflare Tunnel Public Hostname 指向 `http://gateway-tunnel:8080`。
- **关闭公网**：执行 `docker compose --env-file .env --profile tunnel stop cloudflared`。下次普通更新不会重新启动它；LAN Gateway、Fastify 和 MySQL 不受影响。

这些启停命令只控制公网入口；它们不会改变 DNS、Cloudflare 资源或 Tunnel 配置。

## 确认版本与浏览器缓存

部署后可分别读取 LAN `http://<LAN-IP>:8181/user/` 与公网 `/user/` 的 HTML，确认其 `assets/index-<hash>.js` 文件名相同；Gateway 对入口 HTML 返回 `Cache-Control: no-store`。

User Web 没有注册 Service Worker，也不会离线缓存搜索、预约、会话或播放器状态。Gateway 对 `index.html` 使用 `no-store`，manifest 使用 `no-cache`，Vite 静态资源文件名含内容哈希。更新后重新打开或刷新 `/user/` 即会重新获取入口 HTML；若浏览器仍显示旧页面，可执行一次强制刷新，已安装的 PWA 可完全关闭后再打开。脚本无法验证 Cloudflare 边缘节点在公网各地的缓存或真实手机浏览器状态。
