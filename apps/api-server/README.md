# Yukari API Server — Phase 3

Fastify + TypeScript + Zod，为两个 React 应用提供 `/api/v1`。Fastify 提供轻量路由、生命周期与可测试的服务；Zod 校验输入和 Legacy 响应。没有 ORM、SQLite 驱动或第二套预约规则。

## 一键运行后端

在项目根目录执行：

```powershell
docker compose -f docker/compose.yaml up --build -d
```

- Node API：http://127.0.0.1:3000/health
- 原 PHP：http://127.0.0.1:8080/
- 在 `apps/user-web` 执行 `npm.cmd ci`、`npm.cmd run dev`：http://127.0.0.1:5173/
- 在 `apps/admin-web` 执行 `npm.cmd ci`、`npm.cmd run dev`：http://127.0.0.1:5174/

Compose 自动初始化内部 Bridge 随机凭据，保存在专用 volume，仅 PHP/Node 挂载，不放入环境变量、源码、浏览器或日志。两个后端端口只发布到 127.0.0.1。Apache 拒绝直接下载数据库、INI、开发源码等文件；旧页面仍可本地访问。

## 身份边界

1. 用户通过 POST `/user/session` 获取随机 HttpOnly、SameSite=Strict 会话；若旧 EasyAuth 开启，会验证原访问口令。管理登录 POST `/admin/session` 必须验证原 `admin` 的**非空**配置密码，缺失、空值及 PHP 视为空的 `0` 均拒绝。无 localhost 例外。
2. 登录密码只在请求处理期间传给 PHP 原验证函数，不发送 Basic、不记录或缓存密码。Node 后续只保存角色、随机用户 ID、过期时间及不可逆的配置绑定证明。管理会话 1 小时，用户会话 12 小时；退出撤销服务端 token。Node 重启后会话失效。
3. 每次管理调用由 PHP 验证证明仍与当前管理密码/访问口令策略一致。改变密码会拒绝旧管理会话。原 ConfigAuth 的其他密码校验规则（包括既有 master-password）仍由 PHP 拥有，未在 Node 重写。
4. Node → PHP 仅向固定 `node_bridge.php` 发送服务凭据、校验后的角色和会话身份。浏览器 Basic、旧 Cookie、角色、clientip/clientua 不透传。不同用户使用不同 Legacy User-Agent，防止 Node 共用 IP 导致保密预约误判归属。
5. 请求要求 `X-Yukari-Client: 1`，写入只接受 JSON；检查 Origin，管理路由拒绝 user-web 的 Origin。没有开放 CORS。Vite 白名单是额外限制，不承担服务端认证职责。

会话暂存在内存，适用于单实例开发；正式部署需 HTTPS（`COOKIE_SECURE=1`）、明确可信来源及共享会话方案。本阶段不宣称这是生产部署。

## 领域路由

| 路由（统一前缀 /api/v1） | 方法 | 身份 |
| --- | --- | --- |
| /user/session | POST | 创建普通用户会话，支持 easypass |
| /admin/session | POST / GET / DELETE | 登录 / 验证当前管理会话 / 撤销会话 |
| /capabilities、/queue、/playback | GET | user |
| /search?backend=everything或lister&keyword=... | GET | user |
| /requests | POST | user；filename/fullpath/singer/comment/kind，secret 可选 |
| /admin/queue、/admin/status | GET | admin |
| /admin/requests/:id | DELETE | admin |
| /admin/requests/:id/move | POST | admin；action=up/down/warikomi |
| /settings | GET / PUT | admin；原三个字段和 revision |
| /playback/control | POST | admin；原 MPC/foobar 控制子集 |

响应统一为 `{ok:true,data}` 或 `{ok:false,error:{code,message,requestId?,legacyStatus?,legacyReason?}}`。原错误原因保留；Everything 不可达时明确 503，不再当作空搜索成功。Legacy HTML/空响应为错误，写操作不会自动重试。预约统一返回 `201 {ok:true,data:{id}}`，而不是原 newid 格式。

## 写入与一致性

所有写入只调用 PHP 一次：`exec.php` 负责预约事务/排序/历史，原请求操作负责删除/调序，原配置函数负责设置保存，原播放器函数负责命令。Node 不挂载数据库、不直接读写 SQLite，因此没有新增 WAL、锁或双写问题。PHP 某些 GET 本身可能初始化数据/补元数据，仍由原 PHP 管理。

旧代码可能在预约已提交后因附加曲库查询失败；这时 API 会保留错误并提示写入结果未知，不能认为未入库或盲目重试。Node 不通过二次插入“补救”。没有实现跨服务的幂等写入账本。

## 验证

在本目录执行：

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd test
docker exec docker-web-1 php apps/api-server/tests/php/auth-check.php
```

集成测试连接真实 Compose 服务，用本机原配置的非空密码（仅瞬时读取、不打印）；远端可用 `E2E_ADMIN_PASSWORD`、`E2E_EASY_PASS`、`E2E_API_BASE`、`E2E_PHP_BASE`。不应把实际凭据写进提交文件。两个 Web 的 `test:e2e` 也已迁移到 Node。写测试只操作独立测试记录，活动播放器或非连续队列时跳过，最后比较原队列并清理。

详见 [重构进度](../../docs/REFACTOR_PROGRESS.md)。
