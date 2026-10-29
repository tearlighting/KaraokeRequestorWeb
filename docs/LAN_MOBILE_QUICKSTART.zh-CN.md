# 局域网手机扫码点歌

## 启动与扫码

1. 在仓库根目录执行 `docker compose up -d --build`。这会启动本机服务及独立的 `user-lan` 入口，默认 Windows 主机端口为 TCP 8181。
2. 在 PC 打开 Admin → System，确认 Media Agent 已连接。Agent 会报告当前网卡的私网 IPv4 候选，Admin 会显示对应的用户端 URL 和二维码。若有多个候选，先选与手机 Wi-Fi 所在网段匹配的一项。
3. 手机连接同一 Wi-Fi，使用 iPhone 相机或 Android 相机扫描二维码，打开 `/user/` 页面。不要用手机访问 `localhost`、Docker 服务名或 Windows 文件共享。
4. 在手机 User Web 选 Everything 搜索，选择结果、填写预约者名称和可选备注/保密项，再提交。预约及幂等回执由 Fastify 写入 MySQL；队列页会显示服务端返回的预约和状态。

## 服务与安全范围

- `http://<Windows-LAN-IP>:8181/user/` 是唯一面向局域网的 Web 入口。此入口只提供构建后的 User Web，并代理用户会话、能力、搜索、队列、公开播放状态、用户播放器控制和预约 API。
- `/admin/`、Legacy PHP 页面、Launcher、Agent、Fastify 主机端口、Vite 端口和 MySQL 不通过 LAN 入口开放。管理操作仍由 Fastify 在服务端按管理会话授权。
- 浏览器请求均为同源 `/api/v1/...`，不直连 Everything、PHP、Windows 本地服务或 Docker 内部名称。每台手机/浏览器使用独立的 HttpOnly 会话 Cookie；不要共享浏览器配置文件或导入其他设备 Cookie。
- Agent 离线时用户仍可查看已有队列；Everything 搜索可用性取决于 Windows Everything HTTP Server 与 PHP 兼容搜索路径是否在线。Admin/System 中的 Agent 和 Everything 状态是实际心跳/探测状态，不表示搜索一定命中。

## Everything 与 Windows Firewall

Everything 必须已将你选择的媒体目录加入索引，并在 Windows 本机 HTTP Server 启用项目配置使用的端口 81。先在 Everything 桌面应用按文件名搜索确认命中，再从 User Web 搜索；手机不会访问 Windows 共享，也不会直接访问端口 81。

Compose 发布 8181 后，如果同一私有 Wi-Fi 的手机仍无法打开页面，先确认路由器未启用客户端隔离。然后检查 Windows Defender Firewall 是否拦截 Docker Desktop 的 Private 网络入站连接。此项目不会自动改防火墙；如需手工规则，应仅允许 **Private** profile、TCP 8181、远端 `LocalSubnet`，不要关闭防火墙或开放到 Public profile/所有远端地址。

Media Agent 未连接或未报告私网 IPv4 时，Admin 不生成猜测的 IP/二维码。连接 Agent 后刷新 System，等待地址上报后再扫码。电脑网卡切换、DHCP 地址变化后，Agent 心跳会更新候选地址，使用 Admin 当前显示的二维码。
