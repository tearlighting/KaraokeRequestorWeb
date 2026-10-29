# Yukari user-web

Phase 4：Legacy PHP 已移动至 `legacy/php/`，本应用 API URL 和端口不变。新增旧页面真实 Edge 回归，仅接入 Node-native 健康状态。参见 [兼容性记录](../../docs/LEGACY_COMPATIBILITY.md)。

第一阶段独立用户端：React + TypeScript + Vite + Tailwind CSS。只连接现有 PHP 服务，不提供新的业务后端。

## 本地开发

先在仓库根目录执行 `docker compose -f docker/compose.yaml up --build -d`，启动 PHP 和统一 Node API，然后在本目录执行：

```powershell
npm.cmd ci
npm.cmd run dev
```

访问 http://127.0.0.1:5173/。默认仅监听本机。Linux/macOS 使用 `npm` 即可。

## ホーム画面に追加 / PWA

本番 User Web は `/user/` を scope にした standalone manifest を配信します。iPhone は Safari の共有メニューから「ホーム画面に追加」、Android は Chrome のメニューから「アプリをインストール」または「ホーム画面に追加」を選択してください。アイコンは Yukari のロゴで、曲のジャケット画像は使用しません。通常のブラウザーでもそのまま利用できます。

検索・予約・セッション・再生状態を Service Worker やアプリ独自のキャッシュには保存しません。オフラインでの予約機能はありません。端末がオンラインの状態でアプリを起動してください。

Node 地址不同，可复制 `.env.example` 为 `.env.local` 修改 `API_PROXY_TARGET` 并重启 Vite。默认连接 http://127.0.0.1:3000；浏览器只调用 `/api/v1`，不再直连 PHP。

## 验证

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run test:e2e
```

E2E 使用本机 Edge，无 mock，真实经过 Node → PHP，并创建、删除专用“小休止”预约及对应历史。管理清理步骤需要原配置的非空管理密码，测试只瞬时读取本机配置，不打印凭据；远端可提供 `E2E_ADMIN_PASSWORD`。若没有 Edge，可使用 Playwright Chromium 并设置 `PLAYWRIGHT_CHANNEL=chromium`，或使用已安装的 `chrome`。

真实歌曲命中测试默认跳过，只有接入真实曲库后才执行：

```powershell
$env:E2E_SONG_KEYWORD = '曲库中已存在的歌曲关键词'
$env:E2E_SEARCH_BACKEND = 'lister' # 或 everything
npm.cmd run test:e2e
```

测试会预约首个实际搜索结果，并清理该测试预约。它不验证播放器播放。测试后保留数据库序号、通知计数和可能生成的匿名用户，不回滚整个数据库。

## 边界

- 搜索调用 Node `/api/v1/search`，继续由原 Everything/YukaLister 搜索；连接不可用明确报错。
- 预约调用 Node `/api/v1/requests`，收到合法 `data.id` 才显示保存成功。原 exec.php 仍独占实际入库。
- 队列由 Node-native SQLite 读取，播放状态仍经 Node 调原 PHP；每 5 秒轮询，不自行排序或推断播放成功。
- 会话身份由 Node 分配，浏览器旧 PHP Cookie 和角色头不传入 Legacy；用户代理不开放管理接口。
- `npm run preview` 仅预览构建产物，不提供后端代理。生产部署留待后续阶段。

完整接口契约、验证记录和阻碍见 [重构进度](../../docs/REFACTOR_PROGRESS.md)。
