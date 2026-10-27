# Yukari admin-web

Phase 4：Legacy PHP 已移动至 `legacy/php/`，本应用 API URL、端口和管理会话不变；真实测试从新位置瞬时读取配置。参见 [兼容性记录](../../docs/LEGACY_COMPATIBILITY.md)。

React + TypeScript + Vite + Tailwind 独立管理端。Phase 3 已迁移到统一 Node `/api/v1`；不再把管理密码保存到 React 状态或向 PHP 发送 Basic。

## 启动

仓库根目录执行 `docker compose -f docker/compose.yaml up --build -d`，然后在本目录执行：

```powershell
npm.cmd ci
npm.cmd run dev
```

管理端 http://127.0.0.1:5174/，用户端仍为 5173，Node API 为 3000，原 PHP 为 8180。可通过 `.env.local` 中的 `API_PROXY_TARGET` 修改 Node 开发代理目标。正式静态部署及 HTTPS 不在本阶段。

## 认证和功能

用原版 admin 账号和**非空** `configpass` 登录；需要时填写原 EasyAuth 访问口令。空管理密码会被新 API 拒绝，即使从 localhost 访问。密码只用于一次登录验证，随后使用 Node 的 HttpOnly、SameSite=Strict 会话，退出会撤销服务端 token。修改原密码使旧会话证明失效。不要在聊天、提交文件或日志中提供密码。

保留队列读取、删除确认、上移/下移/下一首、系统状态、原三个设置字段保存、MPC-BE/foobar 控制子集。队列由 Node-native SQLite 读取，顺序写入仍由 PHP 决定，Node 不写数据库。播放器失败明确提示；接口应答不等于已经播放。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

E2E 使用 Edge，连接真实 Node → PHP，验证登录/退出、越权与 CSRF 拒绝、队列管理、设置无变化保存和播放器失败。测试只瞬时读取本机原配置密码；远端可用 `E2E_ADMIN_PASSWORD`、`E2E_EASY_PASS`、`E2E_API_BASE`、`E2E_PHP_BASE`。trace 关闭，不落盘认证信息。

专用预约最终清理并比对原队列；有活动播放器或原队列非连续时不执行写测试。设置测试不为通过而改变现场设置。单实例内存会话、历史 PHP 直接入口和原密码策略的边界详见 [API Server](../api-server/README.md) 与 [重构进度](../../docs/REFACTOR_PROGRESS.md)。
