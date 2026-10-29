# tearlighting.com 接入 Cloudflare Tunnel 操作指南

目标是保留 EC2 上的根域名和 `www` 网站，只把 `yukari.tearlighting.com` 接入家中 Yukari。所有 Cloudflare、阿里云和 DNS 操作均由域名所有者确认执行；本指南不会创建资源或变更记录。

## 当前公开 DNS 检查

查询时间：2026-10-29（Asia/Tokyo）；通过公开 DNS Resolver `1.1.1.1` 查询。

| 名称 | 当前可见记录 | 说明 |
|---|---|---|
| `tearlighting.com` | NS `ns7.alidns.com`, `ns8.alidns.com`；A `54.66.247.81` | NS 属于阿里云 DNS；A 地址位于 ARIN 登记给 Amazon 的 `54.64.0.0/11` 网段，符合现有 EC2 网站入口。 |
| `www.tearlighting.com` | A `54.66.247.81` | 与根域名相同。 |
| `blog.tearlighting.com` | A `54.66.247.81` | 有限常见名称探测发现，与根域名相同。 |
| 根域名 AAAA、MX、TXT、DS | 本次公开查询未返回对应记录 | 这不代表其他子域名或阿里云控制台中不存在这些记录；迁移前仍须检查完整 Zone。 |

当前 HTTP 探测中，根域名和 `www` 的 HTTP 请求各自重定向到同主机 HTTPS；两个 HTTPS 地址均返回 200。为保持这一现状，迁移后的 `@` 与 `www` 记录先继续直连 EC2（DNS only），不要把它们指向 Tunnel。

公开 DNS 不能列举一个域名下的全部记录。证书透明度查询本次也未能完成；`www` 和 `blog` 的发现只来自有限名称探测，不是完整子域名清单。迁移前请在阿里云控制台导出或逐项记录全部解析记录，特别是邮件、域名验证、DKIM/DMARC、SRV、CAA 和子域委派记录。

## A. 在 Cloudflare 网页准备

1. 登录 Cloudflare，选择 **Add a site**，添加 `tearlighting.com`，选择 **Free** 方案。Cloudflare Free 使用 Full setup：Cloudflare 接管整个 Zone 的权威 DNS；无需转移域名注册商。参见 [Cloudflare Full setup](https://developers.cloudflare.com/dns/zone-setups/full-setup/setup/) 和 [DNS FAQ](https://developers.cloudflare.com/dns/faq/)。
2. Cloudflare 自动扫描记录后，逐条与阿里云导出的完整记录核对。扫描结果不保证完整，缺少的记录要手工添加。
3. 保留现有 EC2 网站记录：
   - `@` A → `54.66.247.81`
   - `www` A → `54.66.247.81`
   - 初次切换建议两条都设为 **DNS only**，直接访问 EC2，尽量维持现有 HTTPS/TLS 行为。不要改成 Tunnel，也不要删除。
   - `blog` 当前也解析到该地址；若它仍在使用，复制为 `blog` A → `54.66.247.81`，先设 **DNS only**。
4. 先不要创建 `yukari` DNS 记录；创建 Tunnel 的 Published application route 时再由 Cloudflare 添加对应记录。
5. 保存 Cloudflare 给出的两条权威 Nameserver。记下它们，下一步需要填入阿里云。
6. 在 **Networks → Tunnels**（部分界面显示 **Networking → Tunnels**）选择 **Create a tunnel**，创建远程管理 Tunnel。添加 Published application：
   - Hostname：`yukari.tearlighting.com`
   - Service：`http://gateway-tunnel:8080`
   - 不添加根域名、`www`、Admin 或其他服务。
7. 从 Tunnel 的 Docker 安装/连接说明复制 Tunnel Token；只粘贴到自己的本机配置，不要发到聊天或截图中。详细 Tunnel 文档见 [Cloudflare Tunnel 创建指南](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/get-started/create-remote-tunnel/) 和 [路由说明](https://developers.cloudflare.com/tunnel/concepts/routing/)。

## B. 在阿里云网页切换权威 DNS

域名仍由阿里云注册和续费。只把权威 DNS 从 AliDNS 改为 Cloudflare；EC2、网站内容、AWS 账号和服务器均不迁移。

1. 登录阿里云 **域名控制台**，找到 `tearlighting.com`，点击 **管理**。
2. 进入 **DNS 管理 → 修改 DNS → 修改 DNS 服务器**（界面名称可能略有调整）。
3. 替换当前 `ns7.alidns.com` / `ns8.alidns.com` 为 Cloudflare 为该 Zone 分配的两条 Nameserver，然后提交。阿里云官方路径说明见[修改 DNS 服务器](https://help.aliyun.com/en/dws/user-guide/modify-dns-server)。
4. 如果阿里云域名设置中启用了 DNSSEC，先按 Cloudflare/阿里云迁移说明处理旧 DS；Cloudflare 要求切换 Nameserver 前关闭旧 DNSSEC/移除旧 DS。公开查询本次没有返回 DS，但仍应以阿里云控制台状态为准。
5. 等待注册局与递归 DNS 更新。不要在 Cloudflare 显示 Zone Active 之前删除 Cloudflare 中复制的记录或恢复旧 NS；切换期间根域名与 `www` 应继续解析到相同 EC2 A 记录。

如果希望继续由 AliDNS 管权威 DNS、只把一个子域名交给 Cloudflare，需要对子域委派及方案可用性另行核实。Cloudflare 当前列出的子域名独立设置需要 Enterprise；Free 方案的标准 Full setup 会接管整个 `tearlighting.com` Zone。因此这里采用整域 NS 切换，并不把“AliDNS 继续做权威 DNS + Cloudflare Free Tunnel”当作已验证方案。参见 [Cloudflare DNS setup options](https://developers.cloudflare.com/dns/zone-setups/)。

## C. 在本机配置 Token

在仓库根目录打开被 Git 忽略的 `.env`，设置：

```dotenv
CLOUDFLARE_TUNNEL_TOKEN=<从 Cloudflare Tunnel 控制台复制的 Token>
```

不要把 Token 放到 `.env.example`、Compose 命令行、Git、日志或聊天中。仓库的 [.env.example](../.env.example) 只保留空变量示例；`.env` 已被 `.gitignore` 忽略。Cloudflare 的 Token 是运行 Tunnel 的凭据，持有它的人可以连接该 Tunnel。

## D. 启动和停止 Yukari Tunnel

从仓库根目录运行。普通 `docker compose up -d --build` 不会启动 Tunnel：

```powershell
docker compose --profile tunnel up -d --build gateway-tunnel cloudflared
```

这会启动官方 `cloudflare/cloudflared` 容器和独立 User-only Nginx origin；两者使用 Compose 内部网络，Windows 主机不安装 cloudflared，也不开放入站端口。关闭公网连接：

```powershell
docker compose --profile tunnel stop cloudflared gateway-tunnel
```

停止这两个服务不会停止 LAN Gateway、Fastify、MySQL 或 Windows Agent。不要为 Tunnel 配置路由器端口转发，也不要修改 Sunshine/Moonlight 的端口或连接配置。

## E. 配置公开 User URL 并验证

1. 等 Cloudflare Tunnel connector 显示已连接，且 `yukari.tearlighting.com` DNS route 已生效。
2. 打开本地 Admin → System → 房间连接，将公开 User URL 设为 `https://yukari.tearlighting.com/user/`。先让 Admin 页面实测可达，再选择公开入口。Fastify 只接受 MySQL 中配置的 HTTPS 主机匹配的 User Origin；不要把 URL 设为根路径或 Admin 路径。
3. 在外网设备验证：

   ```powershell
   curl.exe -I https://tearlighting.com/
   curl.exe -I https://www.tearlighting.com/
   curl.exe -I https://yukari.tearlighting.com/user/
   curl.exe -I https://yukari.tearlighting.com/admin/
   curl.exe -i https://yukari.tearlighting.com/api/v1/admin/session
   curl.exe -i https://yukari.tearlighting.com/api/v1/settings
   ```

   根域名和 `www` 应继续呈现原 EC2 网站及其当前 HTTPS 行为。`yukari` 的 User 页面应返回成功；`/admin/`、管理 API、设置 API 应返回 404。Tunnel Gateway 的 User API 白名单外路径也返回 404。公网 DNS 查询 `yukari` 得到 Cloudflare 网络地址是预期行为，不应显示家中公网 IP。
4. 从局域网另行确认 `http://<家中 Windows LAN IP>:8181/user/` 与 `/admin/` 仍可用。Tunnel 使用出站连接，不要求开放家庭路由器的入站端口。

实际公网验证必须等域名所有者完成 Cloudflare、阿里云和本机 Token 操作后进行。本次仅完成公开 DNS 查询与本地配置审查，没有修改 DNS、创建 Cloudflare 资源、填入 Token 或启动公网服务。
