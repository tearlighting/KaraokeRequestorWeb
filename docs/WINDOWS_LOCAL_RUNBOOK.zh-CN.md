# Windows 11 本地启动

需要 Windows 11、Docker Desktop（Linux containers）、Node.js 24、mpv 和已配置的原版 PHP `config.ini`。Compose 仍只绑定 loopback；正式自动播放固定保持关闭。

## 一键启动

双击 `scripts/windows/Start-Yukari.cmd`。脚本先检查 Docker Engine 是否可用，再确认 Compose 中 `YUKARI_NODE_AUTOPLAY=0`，安全创建缺失的本机 Agent token（不覆盖已有 token），构建并启动 Compose，等待 API、门户、用户端和管理端全部就绪；已运行过 `Configure-PlayerAgent.cmd` 时也会启动宿主机 Agent。若 Docker Desktop 未启动，窗口会显示原因并保留错误信息：先打开 Docker Desktop，等待状态变为 Running，再重新双击启动器。就绪后打开统一入口：

MySQL 模式下 React + Fastify 是主要产品。Legacy PHP 保留搜索、认证兼容和签名预约转发；MyPage、收藏、配对、CMS 评论、Bingo、旧队列管理、旧播放器控制、INI 设置页和更新/恢复入口不可用，会返回 410。该模式不挂载业务 SQLite，也不启动 WAL anchor。原 SQLite 文件、Volume 和备份会保留在本机，但不供正常服务使用。

- 入口：<http://127.0.0.1:8180/app/>
- 用户点歌：<http://127.0.0.1:8180/user/>
- 管理端：<http://127.0.0.1:8180/admin/>
- 用户端 Vite 开发服务器：<http://127.0.0.1:5173/>
- 管理端 Vite 开发服务器：<http://127.0.0.1:5174/>
- Legacy PHP 页面继续使用原 URL，例如 `/search.php`。

正式构建的 React 静态文件由 Apache 同源提供，API 请求代理到 Fastify；Fastify 仍独立做用户/管理员会话、角色、Origin 和 CSRF 校验。开发 UI 时可另外启动 Vite：

```powershell
npm.cmd --prefix apps/user-web run dev     # http://127.0.0.1:5173
npm.cmd --prefix apps/admin-web run dev    # http://127.0.0.1:5174
```

两个 Vite 开发服务器、API 3000 和 PHP 8180 均由同一个 Compose 项目启动，只发布到本机 loopback。Vite 容器 bind mount React 与共享 package 源码，修改后热更新；通常不需要在宿主机手动运行 `npm run dev`。Apache 的 `/user/`、`/admin/` 同时保留生产构建页面。

## Player Agent 和媒体目录

双击 `scripts/windows/Configure-PlayerAgent.cmd`，通过文件夹选择器明确选取允许访问的媒体根目录，并选择 `mpv.exe`。测试视频可留空；如选择，必须位于该媒体根目录内。向导不会扫描其他磁盘。

如果 Legacy 保存 Docker/POSIX 绝对路径，向导会询问一个已核实的 POSIX 根目录前缀。留空时这类队列路径继续显示“路径未映射”。必须从实际 `fullpath` 和本机存储布局核实 source/target；不要按文件名猜测。配置保存在 `%LOCALAPPDATA%\YukariPlayerAgent\agent-config.json`，仅包含本机路径，不包含 Agent token。Agent 仍通过 realpath、根目录 allowlist 和文件存在性检查，拒绝目录穿越和逃逸符号链接。

配置后运行 `Start-Yukari.cmd`。它会在 Docker 服务就绪后静默启动（或复用）Windows Launcher；Launcher 不弹出 CMD 窗口，也不会立即启动播放器 Agent。随后在 Admin → System 点击「Agent 起動・接続」，才启动/复用 Agent。mpv 路径保存为完整路径，不依赖 PATH。Launcher 和 Agent 日志位于 `%LOCALAPPDATA%\YukariPlayerAgent\logs`。

## 停止、状态和日志

- 双击 `scripts/windows/Stop-Yukari.cmd`：通过 Agent 命名管道请求停止当前播放器，再仅停止 Compose 的 `api-server` 和 `web`。容器和卷保留，不杀其他 Node 进程。
- 双击 `scripts/windows/Get-YukariStatus.cmd`：查看 Compose、入口页面、API health 和 Agent 进程状态。
- 双击 `scripts/windows/Show-YukariLogs.cmd`：跟踪 API 日志；`Show-YukariLogs.ps1 -Service web` 查看 PHP/Apache。启动日志在 `%LOCALAPPDATA%\Yukari\logs`。

若 Agent 没有响应定向停止，停止脚本会拒绝强杀它并保留 Docker 服务运行；查看 Agent stderr 日志后再处理。不要对所有 `node.exe` 使用 taskkill。

正式 `playmode`、媒体映射、请求数据库和预约均不由启动器修改。正式自动播放需另外完成人工路径/Legacy 调度器审查和授权；本地启动器不会开启它。

## Phase 13: built entry points, local media wizard, and E2E teardown

`Start-Yukari.cmd` is the normal Windows entry point. The Docker image builds both React apps and serves them from the existing Apache origin: `/app/` is the portal, `/user/` is user-web, and `/admin/` is admin-web. Original PHP URLs such as `/search.php` remain unchanged. `npm.cmd --prefix apps/user-web run dev` and the admin equivalent still start Vite separately for UI development.

Use `Configure-PlayerAgent.cmd` to select exactly one media root and the actual `mpv.exe` with Windows file/folder pickers. The optional test clip must be beneath that selected root. The wizard asks for an exact Legacy POSIX source prefix; leave it blank unless it has been verified against stored queue paths. It saves only paths and Agent ID under `%LOCALAPPDATA%\YukariPlayerAgent\agent-config.json`; the Agent token remains separate. No drive scan or production path is inferred. The wizard defaults to `%ProgramFiles%\MPV Player\mpv.exe` when present, but still lets the operator choose another executable.

`Start-Yukari.cmd` starts Docker services and then starts or reuses the fixed Windows Launcher entry in the background. The Launcher is a Windows host process (mpv and Everything are also host applications), not a Docker service; it has no visible console window. Admin → System sends the fixed authenticated start/stop request to that Launcher. Configure the local media root/mpv once with `Configure-PlayerAgent.cmd`; no separate Agent CMD is needed for normal use. Launcher logs are under `%LOCALAPPDATA%\YukariPlayerAgent\logs`.

`Stop-Yukari.cmd` asks the recorded Agent to stop over its per-Agent local pipe, validates PID/start time/executable, then stops only this Compose project's `web` and `api-server`. Status and logs are available through `Get-YukariStatus.cmd` and `Show-YukariLogs.cmd`. The scripts never kill unrelated Node processes or remove volumes. `YUKARI_NODE_AUTOPLAY` remains `0`.

The browser test scripts now use `scripts/run-web-e2e.mjs`: it starts an exact Vite child on `E2E_WEB_PORT` (default 5173/5174), runs Playwright against that server, and reaps only that child before exiting. This avoids the Playwright-managed Windows `webServer` teardown hang. If `E2E_BASE_URL` is supplied, the runner does not start Vite and uses the external built/static server instead.

If the Docker CLI cannot load the standard per-user Compose plugin, the launcher checks for the ignored local CLI plugin at `.local/empty-docker-config`. It uses that fallback only when no explicit `DOCKER_CONFIG` or `DOCKER_CONTEXT` is set and `docker compose version` fails; it never persists a change to the user's Docker configuration.
