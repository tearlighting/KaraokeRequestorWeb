# Yukari API Server — Phase 6

Phase 4 路径：PHP 源码和本机运行文件现位于 `legacy/php/`，URL 保持原样。测试瞬时读取 `legacy/php/config.ini`。旧 swipe 队列页通过专用票据同源访问 Native 队列；未迁移的写业务不绕经 Node。详见 [Legacy 兼容性](../../docs/LEGACY_COMPATIBILITY.md)。

Fastify + TypeScript + Zod，为两个 React 应用提供 `/api/v1`。Fastify 提供轻量路由、生命周期与可测试的服务；Zod 校验输入和 Legacy 响应。使用 Node 24 内置只读 SQLite，不引入 ORM 或第二套预约规则。

## 一键运行后端

在项目根目录执行：

```powershell
docker compose up -d --build
```

- Node API：http://127.0.0.1:3000/health
- 原 PHP：http://127.0.0.1:8180/
- 在 `apps/user-web` 执行 `npm.cmd ci`、`npm.cmd run dev`：http://127.0.0.1:5173/
- 在 `apps/admin-web` 执行 `npm.cmd ci`、`npm.cmd run dev`：http://127.0.0.1:5174/

Compose 自动初始化内部 Bridge 随机凭据，保存在专用 volume，仅 PHP/Node 挂载，不放入环境变量、源码、浏览器或日志。两个后端端口只发布到 127.0.0.1。Apache 拒绝直接下载数据库、INI、开发源码等文件；旧页面仍可本地访问。

## 身份边界

1. 用户通过 POST `/user/session` 获取随机 HttpOnly、SameSite=Strict 会话；若旧 EasyAuth 开启，会验证原访问口令。管理登录 POST `/admin/session` 必须验证原 `admin` 的**非空**配置密码，缺失、空值及 PHP 视为空的 `0` 均拒绝。无 localhost 例外。
2. 登录密码只在请求处理期间传给 PHP 原验证函数，不发送 Basic、不记录或缓存密码。Node 后续只保存角色、随机用户 ID、过期时间及不可逆的配置绑定证明。管理会话 1 小时，用户会话 12 小时；退出撤销服务端 token。Node 重启后会话失效。
3. 每次管理调用由 PHP 验证证明仍与当前管理密码/访问口令策略一致。改变密码会拒绝旧管理会话。原 ConfigAuth 的其他密码校验规则（包括既有 master-password）仍由 PHP 拥有，未在 Node 重写。
4. Node → PHP 仅向固定 `node_bridge.php` 发送服务凭据、校验后的角色和会话身份。浏览器 Basic、旧 Cookie、角色、clientip/clientua 不透传。不同用户使用不同 Legacy User-Agent，防止 Node 共用 IP 导致保密预约误判归属。
5. 除公开 `/health` 和 `/api/v1/meta/health` 外，请求要求 `X-Yukari-Client: 1`，写入只接受 JSON；检查 Origin，管理路由拒绝 user-web 的 Origin。没有开放 CORS。Vite 白名单是额外限制，不承担服务端认证职责。

会话暂存在内存，适用于单实例开发；正式部署需 HTTPS（`COOKIE_SECURE=1`）、明确可信来源及共享会话方案。本阶段不宣称这是生产部署。

## 领域路由

| 路由（统一前缀 /api/v1） | 方法 | 身份 |
| --- | --- | --- |
| /meta/health | GET | 公开基础设施状态 |
| /legacy/queue?limit&offset | GET | 独立 30 秒 Legacy 读取票据，不是 Node admin 会话 |
| /user/session | POST | 创建普通用户会话，支持 easypass |
| /admin/session | POST / GET / DELETE | 登录 / 验证当前管理会话 / 撤销会话 |
| /capabilities、/queue、/playback | GET | user |
| /search?backend=everything或lister&keyword=... | GET | user |
| /requests | POST | user；filename/fullpath/singer/comment/kind，secret 可选 |
| /admin/queue、/admin/status | GET | admin |
| /admin/requests/:id | DELETE | admin |
| /admin/requests/:id/move | POST | admin；action=up/down/warikomi |
| /settings | GET / PUT | admin；原三个字段和 revision；GET Node-native，PUT PHP |
| /playback/control | POST | admin；原 MPC/foobar 控制子集 |

响应统一为 `{ok:true,data}` 或 `{ok:false,error:{code,message,requestId?,legacyStatus?,legacyReason?}}`。原错误原因保留；Everything 不可达时明确 503，不再当作空搜索成功。Legacy HTML/空响应为错误，写操作不会自动重试。预约统一返回 `201 {ok:true,data:{id}}`，而不是原 newid 格式。

## 写入与一致性

Phase 5 的 `GET /api/v1/settings` 由 Node `SettingsService`/`SettingsRepository` 独立读取三个设置，PHP 仅执行前后管理会话/配置版本校验；不调用 PHP settings 业务、不初始化 SQLite。PUT 继续只转发一次给 PHP。Compose 只读挂载现有 `legacy/php/config.ini`；Phase 6 另只读挂载专用队列目录；原始配置包含秘密，禁止日志、静态服务或诊断返回。路径可用服务端 `LEGACY_SETTINGS_PATH` 设置为绝对路径。

该读取支持原 serializer 的单行标量设置格式。PHP 常量、插值、数组等未支持格式明确 503，不假装完整兼容 PHP INI。config.ini 若被手工重命名替换，旧单文件 mount 会触发版本不匹配；重建 api-server 恢复。原 writer 的非原子写入窗口仍是限制。全新工作区无 config.ini 时先启动 `web` 并在原设置页保存配置，再完整启动 Compose；不自动生成密码或配置副本。详见 [对照测试与 Owner](../../docs/LEGACY_COMPATIBILITY.md#phase-5node-native-管理设置读取)。

所有写入只调用 PHP 一次：`exec.php` 负责预约事务/排序/历史，原请求操作负责删除/调序，原配置函数负责设置保存，原播放器函数负责命令。Node 直接只读查询原队列 SQLite；WAL/SHM 可用性由 PHP 生命周期连接维护，所有业务写入仍归 PHP。PHP 某些 GET 本身可能初始化数据/补元数据，仍由原 PHP 管理。

旧代码可能在预约已提交后因附加曲库查询失败；这时 API 会保留错误并提示写入结果未知，不能认为未入库或盲目重试。Node 不通过二次插入“补救”。没有实现跨服务的幂等写入账本。

## 验证

在本目录执行：

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
docker exec docker-web-1 php /workspace/apps/api-server/tests/php/auth-check.php
```

集成测试连接真实 Compose 服务，用本机原配置的非空密码（仅瞬时读取、不打印）；远端可用 `E2E_ADMIN_PASSWORD`、`E2E_EASY_PASS`、`E2E_API_BASE`、`E2E_PHP_BASE`。不应把实际凭据写进提交文件。两个 Web 的 `test:e2e` 也已迁移到 Node。写测试只操作独立测试记录，活动播放器或非连续队列时跳过，最后比较原队列并清理。

详见 [重构进度](../../docs/REFACTOR_PROGRESS.md)。


## Phase 6 队列运行边界

Node 从 `LEGACY_DATABASE_ROOT`（默认 `/run/legacy-db`）直接只读查询原库，PHP 仅提供原认证与配置/身份上下文；队列数据不通过 PHP Adapter 返回。宿主目录为 `legacy/php/runtime/queue/`，与原 `config.ini` 中 dbname 对应，不能挂整个 Legacy 源码目录。已有旧库需经确认停服移动并校验哈希，不创建第二个队列；当前工作区已完成。

WAL/SHM 与 DB 同目录只读挂载，PHP `queue-wal-anchor.php` 以 www-data 保持已存在库连接，负责 SQLite 旁文件生命周期，无 Schema/队列写入或长期读事务。不可读/锁/缺表返回错误，不使用 immutable 或忽略 WAL。`/health` 是进程检查，不代表库 readiness。

旧 swipe 页面受 `YUKARI_NODE_QUEUE=1` 控制：原浏览器同源向 PHP 请求专用票据，再 JS 请求 `/api/v1/legacy/queue`。Basic/Cookie 不进入 Node，票据不能用于管理写 API；旧写操作仍 PHP。旧部署可不启用该标志，其他旧队列页面未切换。详见 [Phase 6 Owner/权限矩阵](../../docs/LEGACY_COMPATIBILITY.md#phase-6已部署的-node-native-队列)。


Phase 7: admin DELETE/move now execute native SQLite transactions. Only the dedicated queue directory is RW; PHP retains creation and notification-only reuse. Legacy delete/reorder entries are closed (410) in Compose. API write tests and both browser suites now require the synthetic isolated deployment, **not real runtime data**: [runbook and Owner matrix](../../docs/LEGACY_COMPATIBILITY.md#phase-7-isolated-test-runbook). Normal application ports and production Compose startup remain unchanged.
