# Windows 视频点歌最短操作指南

## 本机现状（2026-10-23）

- Docker Compose 的 MySQL、PHP、Fastify、user-web、admin-web 均 healthy。Fastify 当前 `YUKARI_NODE_AUTOPLAY=0`。
- MySQL `app_setting.playmode=1`；Legacy 能力接口报告 `autoplay=false`。本机未发现 Everything、PHP CLI 或旧 MPC/foobar 调度进程。Windows mpv 进程存在，但不据此推断它正在播放预约。
- Player Agent 已连接 Fastify，心跳状态为 connected/idle。向导配置了 API、mpv、媒体根目录和测试视频；本机配置中没有路径映射项。绝对路径内容不写入本文。
- Everything 搜索当前不可用：PHP 能力接口为 `everything_search=false`；Windows 没有 Everything 进程，也没有监听本机 81 端口。PHP 容器能解析 `host.docker.internal`，但连接该端口失败。
- YukaLister 能力标记为可用（配置的索引路径存在），但本轮没有执行实际关键词命中验证。

## 选择媒体目录并配置 Agent

1. 将你明确授权给播放器的 MP4/MKV 放在一个本地目录。目录可自行选择；不要把媒体放进仓库。Agent 不会扫描整盘，只会播放所选根目录内、通过路径校验的文件。
2. Compose 服务已在运行。从仓库根目录运行 `scripts\windows\Configure-PlayerAgent.cmd`，在目录对话框选媒体根目录，在文件对话框选择 `mpv.exe`，再可选选择该根目录内的测试视频。配置保存在 `%LOCALAPPDATA%\YukariPlayerAgent\agent-config.json`，不含 Agent Token。
3. 运行 `scripts\windows\Start-PlayerAgent.cmd`。在管理端 `http://127.0.0.1:5174/` 登录并打开 System，确认 Agent connected。当前已连接，无需重新配置；若重启 Agent 后断开，先看 `%LOCALAPPDATA%\YukariPlayerAgent\logs`。
4. System 页的 Start local test video 是隔离测试任务，只播放本机选择的测试文件，不会消费预约。使用 Pause、Resume、Stop 检查 mpv 控制。

## 让视频出现在搜索结果

把视频放进 Agent 媒体根目录只授权 Agent 访问，不会建立搜索索引。Everything 和 YukaLister 是两条不同路径：

1. 打开 Everything，在 **Tools → Options → Folders** 中将你选定的媒体目录加入索引，并等待索引完成。之后在 Everything 自身搜索框搜索文件名，先确认结果确实出现。
2. 在 Everything **Tools → Options → HTTP Server** 启用 HTTP Server，端口设为项目使用的 `81`，确认 JSON 搜索响应可用。PHP Docker 已配置用 `host.docker.internal:81` 访问宿主机，且 `host.docker.internal` DNS 已验证正常；不要把 HTTP Server 端口暴露到公网。Windows 防火墙只允许本机/Docker Desktop 私有网络所需的访问范围。
3. 在 Windows 浏览器确认 `http://127.0.0.1:81/` 有响应；再确认 PHP Docker 到 `host.docker.internal:81` 可达。两项都通过后，PHP `/api/capabilities.php` 才应将 `everything_search` 报告为 true。当前 HTTP Server 未运行，因此 React Everything 搜索暂不可用。
4. YukaLister 则需由现有 YukaLister 工具生成/更新 SQLite 搜索索引，并确认 PHP 可访问其索引文件。当前能力标记为可用，但还没有证明新放入的测试视频已在索引中。

## React 搜索、预约与预检

1. 在 `http://127.0.0.1:5173/` 选择 Everything，搜索已经在 Everything 中验证命中的文件名。React 请求 `/api/v1/search`，由 Fastify 调用 PHP 原搜索实现；目前搜索算法没有迁到 Node。
2. 在结果中点击预约。Phase 16 的正常 MySQL 模式由 Fastify 写 `reservation` 和 `request_submission`，不由 React 直连 PHP 数据库。Navicat 验证时先查看 `id, songfile, kind, reqorder, nowplaying`，不要展示/分享 `fullpath`。
3. 在 admin-web 的 Queue 选中该预约并点击 Check media。只有 Agent 报告 `playable` 才证明数据库路径能在 Windows 媒体根目录内解析到真实文件；`path_unmapped`、`file_missing`、`invalid_path` 或 Agent 离线都不能当作可播放。
4. Everything 返回 Windows 绝对路径且该文件位于 Agent 媒体根目录时，不需要 `PLAYER_PATH_MAPPINGS`。如果预约存的是 Docker/POSIX 路径，必须先核实确切源前缀，再用 Configure-PlayerAgent 配置该前缀映射到媒体根目录下的真实文件夹；不要按文件名猜路径。当前映射数为 0，尚未用真实搜索结果验证路径格式。

## 正式预约自动播放

当前不能启动正式自动播放：Fastify Compose 开关仍是 `YUKARI_NODE_AUTOPLAY=0`，Everything 也尚不可用，尚未对真实搜索结果路径完成 Agent 预检。管理员启动按钮保持不可用是预期行为。不要启动旧 Windows Legacy 播放调度器，也不要为测试改写正式队列。

正式启用前要先让 Everything 搜索可用、用一条真实预约确认 MySQL `reservation` 写入、确认 Agent `Check media=playable`，再核对播放模式及队列。切换前必须由用户明确批准将 Compose 的 `YUKARI_NODE_AUTOPLAY` 改为 `1` 并重建 Fastify；本指南不执行该变更。
