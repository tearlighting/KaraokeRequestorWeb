# Docker 功能验证记录

验证日期：2026-10-19（Asia/Tokyo）。目标：当前运行中的 `docker-web-1`，入口 `http://localhost:8080`。

结论：页面、预约入库及队列读取可用；当前没有可用的真实曲库和播放器，尚未形成搜索到实际播放的闭环。另有 SSE 默认值不一致、缺库接口报错和 PHP 日志配置问题。本次未修改业务逻辑、UI 或播放器实现。

## 页面与资源

| 检查项 | 实测结果 |
| --- | --- |
| 首页 `/` | 302 → `requestlist_top.php` → `requestlist_swipe.php`，最终 200 |
| 搜索 `/search.php` | 跳转 `search_bs5.php`，200；带搜索词也可返回页面 |
| 点歌入口 `/searchreserve.php` | 200 |
| 队列 `/requestlist_top.php` | 跳转新版队列，200；队列 JSON 可解析 |
| 设置 `/init.php` | 未认证 401；容器内 localhost 按现有认证规则携带 admin Basic 认证后返回设置表单，无 Fatal error。未验证外部浏览器输入实际管理密码的登录流程 |
| 播放守护脚本 `/manage-mpc.php` | HTTP 200，但正文仅为 `Locale not found: ja_JP.UTF-8`；它不是管理 UI |

首页/队列和搜索页 HTML 中引用的 14 次 JS/CSS 资源请求全部为 200，Content-Type 正常。覆盖 Bootstrap 5、jQuery、Sortable、主题样式与主题脚本。这是 HTTP 资源检查，未执行真实浏览器 JS，不能据此保证所有按钮、动态资源、布局和控制台无异常。

容器 locale 只有 C、C.utf8、POSIX。PHP `display_errors=STDOUT`、`log_errors=Off`、`error_log` 未设置。Apache error.log 链接到 stderr；检查期间 Docker 日志未检出对应 PHP 错误记录，但 HTTP 正文已出现致命错误，日志无错误不能作为通过依据。

## 实际业务流程

1. **曲库来源**：本地媒体文件，而非 Docker 自动提供的歌曲。Everything 路线由 Windows Everything 索引文件名，通过 HTTP 81 端口提供 JSON；无需先把所有歌曲导入 request.db。另一条路线使用ゆかりすたー（YukaLister）生成的 SQLite 曲库，包含 `t_found` 表及曲名、歌手、作品、文件路径等元数据。应在 Windows 建立真实曲库后将数据库挂载进容器，并在设置页配置 `listerDBPATH` 为容器内路径；媒体本身需另行提供，复制数据库不等于复制歌曲。
2. **搜索**：新版 `search_bs5.php?searchword=...` 在 PHP 服务端调用 `searchlocalfilename_part()`，访问 Everything，不是所有搜索都由浏览器调用 `/api/search.php`。`/api/search.php?keyword=...` 为独立 JSON 接口，调用 `searchlocalfilename()`。Lister 新版文件列表通过服务端 HTTP 请求 `http://localhost/search_listerdb_filelist_json.php`；另有 `search_listerdb_json.php`、歌曲/作品等分类 JSON 接口，以及 `/api/lister_index.php`。
3. **预约**：搜索结果进入 `request_confirm_bs5.php`，表单 POST 到 `exec.php`。后者验证输入并写入 `request.db` 的 `requesttable`，保存 songfile、fullpath、singer、comment、kind、nowplaying、reqorder，以及音轨、升降调等选项。新增预约初始为“未再生”；INSERT 和顺序分配在事务内执行。启用 MyPage 时也写历史记录。预约接口并不保证文件真实存在或可播放。
4. **队列**：页面 fetch `requestlist_swipe_json.php`，按队列顺序显示。预约及状态改变调用 `notify_requestlist_update()`，递增 `updatenotice.db` 的更新计数；前端可用 `requestlist_event.php` 的 SSE 通知重新获取队列，另有定时刷新分支。
5. **开始播放**：预约不是直接向桌面播放器推送命令。Windows 批处理启动 PHP CLI 的 `manage-mpc.php` 常驻循环，按 reqorder 读取未再生预约、解析路径、调用 `start_song()`，再启动/控制 MPC-BE 或 foobar2000，等待结束并回写状态。MPC-BE 使用 localhost:13579 的 Web 控制接口，包括 browser.html 和 command.html；foobar 使用 82 端口。网页控制接口是另一条控制路径。
6. **系统依赖**：Windows 进程启动、tasklist/taskkill、批处理、PowerShell、盘符及反斜杠路径均无法直接套用到 Linux 容器。MPC-BE、foobar2000、YukaLister 的生成/启动、采集切换和部分升降调工具依赖主机组件。SQLite 查询、预约保存与队列 JSON 本身可在 Linux 运行。容器 localhost 指向容器，不是 Windows 主机。

## 已执行的业务测试

| 测试 | 结果与边界 |
| --- | --- |
| 当前 `/api/capabilities.php` | `lister_search=false`、`everything_search=false`、`autoplay=false` |
| 当前 Everything 搜索 API | HTTP 200，返回 0 条；没有验证到真实 Everything 命中 |
| 无库访问 `search_listerdb_json.php` | HTTP 200，正文 PDO Fatal error：`no such table: t_found` |
| 无库访问 `/api/lister_index.php?mode=years` | 同样返回 HTTP 200 + PDO Fatal error，而非规范 JSON 错误 |
| 原 Lister 搜索代码正向测试 | 容器 /tmp 创建仅一首歌的隔离 SQLite，通过原 `search_listerdb_json.php` 代码按 song_name 查询，返回 1 条及正确路径 |
| 原 Lister 搜索代码反向测试 | 不存在曲名返回 recordsTotal=0、data=[] |
| 原预约接口 HTTP POST | `exec.php` 返回 `{"newid":4}`；SQLite 查到完整预约，状态“未再生”、reqorder=2 |
| 队列读取 | `requestlist_swipe_json.php` 返回新测试预约；通知计数 3 → 4 |
| 删除 | 原 `delete.php` 删除 ID 4，确认记录消失；原有预约 ID 集合保持不变 |
| SSE | 当前事件接口 HTTP 200，但正文为空，未通过实时通知验证 |

搜索正反向测试在 PHP CLI 中加载原端点，临时替换进程内曲库配置；没有修改 config.ini 或业务代码。这只覆盖该端点的 SQLite 查询与序列化，不代表新版模糊搜索、完整曲库构建、浏览器选择歌曲及实际播放全部通过。预约测试使用测试文件路径，无实际媒体文件。

测试预约与对应 MyPage 歌曲历史已删除，/tmp 测试曲库已清理。数据库自增序号、通知计数及自动生成的匿名用户等运行痕迹可能保留；未回滚整个数据库，以免覆盖其他会话活动。测试前已有 ID 3 的预约保留。本次没有处理工作区原有修改或原有 `List.sqlite3`、`NUL` 文件。

## 已确认的问题

- **SSE 默认配置不一致**：`requestlist_swipe.php` 使用 `configbool("requestlistactivereload", true)`，当前输出 USE_ACTIVE_RELOAD=true；但事件端点经 `ReadConfig` 读取原始 config.ini，仅在明确存在该键且值为 1 时进入事件循环。当前缺少该键，事件响应为空。前端虽有 20 秒刷新间隔，在 EventSource 可用且选择 SSE 分支时不会同时运行普通轮询，因此其他已打开页面可能不自动更新。
- **缺曲库错误处理不足**：部分接口在未验证数据库结构时查询 t_found，HTTP 200 包含 HTML Fatal error，破坏 JSON 协议。部分接口的默认路径也不同（`List.sqlite3` 与 `list\\List.sqlite3`），当前未显式配置有效曲库路径。
- **可观测性不足**：PHP 错误只显示在响应中，未配置日志记录。
- **播放环境未接入**：manage-mpc 在 locale 检查已退出；即便补齐 locale，Windows 命令、播放器和主机路径仍需处理。只补 locale 不足以获得播放能力。

## 从网页点歌到 PotPlayer 真正播放的剩余工作

1. 准备真实媒体和可用搜索后端，验证中文/日文、空结果、多结果、路径及元数据；修复缺库响应和日志配置。
2. 修复或明确配置队列更新方式，验证两个浏览器之间新增、删除、排序和状态实时同步。
3. 确定 Windows 播放执行端与 Docker Web 的通信方式；避免让 Linux 直接执行 Windows 播放命令。明确请求领取、重复执行防护、进程重启恢复和失败反馈。
4. 建立容器路径与 Windows 盘符/共享路径映射，确认 Windows 执行用户能访问媒体。
5. 实现 PotPlayer 控制适配及播放器选择：打开文件、播放/暂停/停止、下一首、音量、音轨、字幕等按需求逐项支持，不能直接复用 MPC-BE 的 HTTP 命令协议。
6. 实现实际播放状态反馈、结束检测、失败处理和队列推进；区分“预约成功”“播放器已打开”“实际播放中”。
7. 用真实媒体验证完整闭环，包括播放结束、跳过、文件缺失、播放器关闭与断线恢复。

本次仅记录这些待办，没有实现 PotPlayer，也没有重构 UI。
