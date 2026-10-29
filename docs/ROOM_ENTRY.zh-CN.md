# 房间入口与公网连接

## 本仓库现状

Phase 21 的 LAN User Web 仍是默认入口：`http://<Windows 私网 IPv4>:8181/user/`。Admin System 会用 Agent 报告的当前网卡地址测试专用探针，探测成功才显示二维码。更换网卡或 DHCP 地址后，Agent 心跳更新候选地址，重新打开 Admin System 即可看到当前地址。

Phase 22 在 Admin System 增加房间名称、首选入口和自定义 HTTPS User URL。数据存入 MySQL `app_setting`，不改表结构。URL 只允许域名 HTTPS 的根路径或 `/user/` 路径，保存时规范化到 `/user/`；设置保存不代表公网已部署。Admin 浏览器每 30 秒向该 URL 的无敏感信息探针发请求，只有响应中的随机 nonce 和服务标识都正确才显示自定义二维码。这里的“可达”仅代表当前管理员浏览器所在网络能到达，不保证所有公网运营商都可达。

公网入口需要由用户自行准备 HTTPS 反向代理或 VPN/隧道，把公开的 `/user/` 与白名单 `/api/v1` 转发到本机专用 `user-lan:8080`，并保留原 Host。当前 Compose 没有安装 WireGuard、启动隧道、申请 DNS/TLS 或改路由器。不要将 PHP/Apache、Fastify、Admin、Agent/Launcher、Vite 或 MySQL 作为公网上游。User 入口不含通用代理能力，未知路由返回 404。

自定义 URL 未通过探测时，不会生成它的二维码；已测试可达的 LAN 地址仍可作为回退。若选了公网但尚未配置/验证，Admin 会显示不可用原因及回退入口。公网 URL 可供任何能访问它的人打开点歌页面；它不是用户注册系统，也不应把管理口令或认证关键字放入 URL。上线前应由房间运营者确认访问范围、TLS 和滥用防护。

## 使用原版在线连接时的差异

当前本仓库 `legacy/php/toolinfo.php` 从 Legacy `config.ini` 读取 `globalhost` 和 `connectinternet`，对 `http://<globalhost>` 做有限超时探测，只有探测成功才显示在线二维码；本地 URL 根据请求 Host 和 `SERVER_ADDR` 生成。EasyAuth 开启时，旧实现会将认证关键字附加到 URL 查询参数。`legacy/php/pfwd_settings.php` 还保留 Windows `tasklist` 检查 WireGuard 与旧 pfwd 设置/控制 UI。`legacy/php/api/capabilities.php` 从 `roomurl` 产生 `room_name` 和按 `roomurlshow` 过滤的房间列表，多个 Legacy 页面用该配置提供“切换部屋”选择；这不等于多个独立租户共用一个数据库。

本仓库当前 MySQL/React 路径不复用上述 `globalhost`、pfwd/WireGuard 控制器或 EasyAuth URL 认证。React User 展示单实例房间名；切换实例应打开另一实例的 User URL。原 PHP 多部屋下拉、在线传输管理和简易认证都不由本 Phase 22 入口设置实现。

## 一键检查

1. 运行 `docker compose up -d --build`。
2. 启动 Windows Media Agent，在 Admin → System 等待 Agent 连线及 LAN 探测。
3. 保持默认 `LAN` 模式时，选择与手机 Wi-Fi 同网段且显示可达的候选。
4. 配自有公网基础设施后，在“自定义公开 User URL”填写例如 `https://karaoke.example.net/user/`，保存，再等待探针显示“当前 Admin 浏览器可到达”。选择自定义入口后，QR 才会优先指向它；失败时显示已验证的 LAN 回退。
5. 在手机扫描当前二维码，确认实际手机网络能加载 User 页面并读取必要 User API。Admin 的浏览器探测不能替代手机端验收。
