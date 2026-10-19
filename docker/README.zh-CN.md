# Docker 本地开发环境

## Phase 3 当前入口

在项目根目录执行 `docker compose -f docker/compose.yaml up --build -d`，同时启动原 PHP（http://127.0.0.1:8080）和统一 Node API（http://127.0.0.1:3000/health）。内部 Bridge 凭据由初始化容器自动创建；数据库仍留在原目录，仅 PHP 写入。两个端口仅绑定本机。

两个 React 开发端分别在 `apps/user-web` 和 `apps/admin-web` 执行 `npm.cmd ci`、`npm.cmd run dev`，访问 5173 和 5174。两端现在代理 Node `/api/v1`，不再代理 PHP；新管理登录必须使用原配置的非空管理密码。详见 [API Server](../apps/api-server/README.md) 和 [重构进度](../docs/REFACTOR_PROGRESS.md)。

此配置用于在 Windows 11 和 Docker Desktop 上本地开发及验证ゆかり Web UI。PHP/Apache 在 Linux 容器中运行；此环境不包含 Windows 播放器，也不适用于生产部署。

## 环境要求

- Windows 11，已安装并启动 Docker Desktop。
- Docker Desktop 使用 Linux containers（推荐 WSL 2 后端）。
- 在仓库根目录 `KaraokeRequestorWeb` 执行下列命令。

## 启动

```powershell
docker compose -f docker/compose.yaml up --build
```

首次启动会构建 PHP 8.2 + Apache 镜像并安装所需 PHP 扩展。Apache 启动后访问 <http://localhost:8080>。后台运行：

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

- Compose 将仓库根目录以读写 Bind Mount 挂载到容器的 `/var/www/html`。修改 PHP、CSS、JavaScript 或图片后刷新浏览器即可，无需重建镜像。
- 配置文件、SQLite 数据库、上传图片和其他运行时文件保存在仓库工作区中。停止或重建容器不会删除这些数据。
- 容器启动脚本会为本地开发开放工作区写权限。只应在可信任的本机开发环境使用，不要将此设置用于生产或公开服务。
- 已启用 SQLite/PDO SQLite、mbstring、cURL、GD 和 ZIP 等 PHP 扩展，默认时区为 `Asia/Tokyo`。
- MPC-BE、foobar2000 等 Windows 播放器、Windows 歌曲目录、播放器控制和依赖本机设备/权限的功能未接入。没有媒体库时，搜索与请求页面可用于 UI 开发，但无法播放真实曲目。
- Google Drive 等外部集成需要自行配置凭据；外部 CDN 和在线服务需要网络连接。

## 故障排查

- 若 8080 端口被占用，请先停止占用端口的程序。
- 若无法识别 `docker` 命令，请安装并启动 Docker Desktop，然后重新打开 PowerShell。
- PHP 页面报错时查看 `docker compose -f docker/compose.yaml logs web`。常见原因包括镜像构建失败、工作区写入权限问题，或访问了依赖 Windows 播放器的功能。
- `docker compose ... down` 不会删除工作区数据；除非确实要重置本地状态，否则不要手动删除配置文件或 SQLite 数据库。
