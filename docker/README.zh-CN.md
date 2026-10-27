# Docker 本地开发环境

MySQL 主运行模式下，预约、队列、设置和正式播放任务由 Fastify 写入 MySQL。旧 SQLite 文件、旧 Volume 和备份保留，但不会挂载给正常 PHP/Node 服务；PHP 不再初始化 request.db，也不启动 queue-wal-anchor。唯一保留的 SQLite 例外是只读 YukaLister `List.sqlite3` 搜索索引。隔离 SQLite 兼容测试仍单独使用其合成数据库。

## Phase 6 当前入口

在项目根目录执行 `docker compose up -d --build`，同一 Compose 项目会启动 PHP/Apache、Fastify、user-web Vite 和 admin-web Vite。根目录 `compose.yaml` 引入 `docker/compose.yaml` 并固定既有项目名，避免新建第二套容器和数据卷。正式构建页面仍由 Apache 提供：`/user/`、`/admin/`；开发页面由 Vite 提供：5173（用户端）、5174（管理端），源码通过 bind mount 热更新。统一入口是 http://127.0.0.1:8180/app/，API health 是 http://127.0.0.1:3000/health。内部 Bridge 凭据由初始化容器创建；所有服务端口只绑定本机。

`mysql-bootstrap` 是 Compose 管理的一次性初始化服务：普通启动会在 MySQL 健康后运行它，Fastify 等它成功后才启动。迁移和设置初始化是幂等的，不要求手动准备密码文件。MySQL root、应用和只读账号使用本机开发默认值；可在被 Git 忽略的项目根 `.env` 中覆盖。默认端口只绑定 `127.0.0.1`，这些默认值只适用于个人本机开发，不可用于公开部署。Windows 启动器不再读取 `.local` 下的 MySQL 凭证。

从仓库根目录只需运行 `docker compose up -d --build`。初始化服务负责应用表迁移、应用/只读账号授权及首次设置导入；不会清空或重建 MySQL volume。可复制 `.env.example` 为 `.env` 并按需设置覆盖值；不复制也能启动。环境变量可从 Docker inspect 查看，因此此配置仅用于受信任的本机开发环境。Bridge 初始化容器仍是普通启动依赖。

Vite 已纳入 Compose，通常无需手动运行 `npm run dev`。直接访问 http://127.0.0.1:5173/（用户端）和 http://127.0.0.1:5174/（管理端）；两端代理 Node `/api/v1`，不再代理 PHP。新管理登录必须使用原配置的非空管理密码。详见 [API Server](../apps/api-server/README.md) 和 [重构进度](../docs/REFACTOR_PROGRESS.md)。

此配置用于在 Windows 11 和 Docker Desktop 上本地开发及验证ゆかり Web UI。PHP/Apache 在 Linux 容器中运行；此环境不包含 Windows 播放器，也不适用于生产部署。

## 环境要求

- Windows 11，已安装并启动 Docker Desktop。
- Docker Desktop 使用 Linux containers（推荐 WSL 2 后端）。
- 在仓库根目录 `KaraokeRequestorWeb` 执行下列命令。

## 启动

```powershell
docker compose -f docker/compose.yaml up --build
```

首次启动会构建 PHP 8.2 + Apache 镜像并安装所需 PHP 扩展。Apache 启动后访问 <http://localhost:8180>。后台运行：

```powershell
docker compose -f docker/compose.yaml up --build -d
```

查看日志：

```powershell
docker compose -f docker/compose.yaml logs -f web
```

停止并移除容器：

```powershell
docker compose -f docker/compose.yaml down
```

## 开发与限制

- 正常 MySQL Compose 将 PHP 源码构建进 Apache 镜像，不挂载整个仓库或业务 SQLite。运行时只挂载只读 `config.ini`、只读 `List.sqlite3` 搜索索引位置和独立 Owner fence Volume。修改 PHP/CSS/JavaScript/图片后需重新构建镜像。
- 配置文件、SQLite 数据库、上传图片和其他运行时文件保存在仓库工作区中。停止或重建容器不会删除这些数据。
- 容器启动脚本会为本地开发开放工作区写权限。只应在可信任的本机开发环境使用，不要将此设置用于生产或公开服务。
- 已启用 SQLite/PDO SQLite、mbstring、cURL、GD 和 ZIP 等 PHP 扩展，默认时区为 `Asia/Tokyo`。
- MPC-BE、foobar2000 等 Windows 播放器、Windows 歌曲目录、播放器控制和依赖本机设备/权限的功能未接入。没有媒体库时，搜索与请求页面可用于 UI 开发，但无法播放真实曲目。
- Google Drive 等外部集成需要自行配置凭据；外部 CDN 和在线服务需要网络连接。

## 故障排查

- 若 8180 端口被占用，请先停止占用端口的程序。
- 若无法识别 `docker` 命令，请安装并启动 Docker Desktop，然后重新打开 PowerShell。
- PHP 页面报错时查看 `docker compose -f docker/compose.yaml logs web`。常见原因包括镜像构建失败、工作区写入权限问题，或访问了依赖 Windows 播放器的功能。
- `docker compose ... down` 不会删除工作区数据；除非确实要重置本地状态，否则不要手动删除配置文件或 SQLite 数据库。

## Windows 11 本地启动器

一键启动、停止、状态、日志和本机媒体目录配置见[Windows 本地运行手册](../docs/WINDOWS_LOCAL_RUNBOOK.zh-CN.md)。正式 React 页面由 Apache 在 `/user/`、`/admin/` 提供，Vite 开发页面使用独立端口 5173/5174，统一入口 `/app/`；原 PHP URL 保持可用。停止脚本只停止指定 Agent 和 Compose 服务，不删除容器卷。

## MySQL 模式的 Legacy 边界

PHP 镜像内含 Legacy 源码；运行时只读挂载认证所需 `config.ini`、专用 YukaLister 索引文件，以及与 Fastify 共用的独立 Owner fence Volume。未迁移的 Legacy MyPage、收藏、配对、评论、Bingo、旧队列/播放器/设置/更新等 PHP 入口返回 410。Everything 搜索与 Legacy 认证兼容仍由 PHP 提供，旧 `exec.php` 提交通过签名兼容层转到 Fastify/MySQL。当前本机 `List.sqlite3` 是空文件，YukaLister 会报告不可用；Everything 则仍需在 Windows 启用 HTTP Server 并确认本机端口 81 可达。详见[Legacy 兼容矩阵](../docs/LEGACY_COMPATIBILITY.md)。
