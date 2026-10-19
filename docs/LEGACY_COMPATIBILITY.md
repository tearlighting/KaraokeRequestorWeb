# Legacy PHP 兼容性与业务 Owner（Phase 6）

日期：2026-10-20。当前统一 API 的普通/管理队列及三个管理设置读取均为 Node-native；Legacy swipe 队列页也通过独立只读票据复用 Node。PHP 保留授权策略和全部尚未迁移写入。Phase 4/5 段落为历史审计，当前状态以 Phase 6 Owner 表为准。

## 目录与 URL

| 宿主机位置 | 容器位置 / 用途 |
| --- | --- |
| `legacy/php/` | PHP 容器 `/var/www/html`，Apache DocumentRoot，读写 bind mount |
| `legacy/php/api/` | 原 JSON API、管理适配器、受信 Node Bridge |
| `legacy/php/{js,css,fonts,images,modules,cms,...}` | 原资源、第三方 PHP 及原业务模块，内部相对关系不变 |
| `legacy/php/config.ini`（只读单文件挂载） | Node 容器 `/run/legacy-settings/config.ini`，只供已授权的设置读取；不挂载其他 INI |
| `legacy/php/runtime/queue/` | Node `/run/legacy-db`，内核只读 DB/WAL/SHM；PHP 仍写原数据库 |
| `legacy/php/config.ini`、其他运行文件 | 原本机运行文件随应用原样移动；不是新生成的默认库或配置，不纳入新增提交 |
| 仓库根目录 | 容器 `/workspace`，只读 CLI 检查挂载，在 DocumentRoot 外 |
| `apps/`、`packages/`、`docs/`、`docker/` | 保持项目级目录；Node 只挂上述专用队列目录 |

旧 URL `/`、`/search.php`、`/exec.php`、`/requestlist_top.php`、`/init.php`、`/api/*.php` 不增加 `/legacy/php` 前缀。内部 Node Adapter 的 `LEGACY_PHP_URL=http://web` 与 `/api/node_bridge.php` 不变。React 仍分别在 5173/5174，通过 3000 的 `/api/v1` 通信。

迁移前停止 PHP/Node，使用 `git mv` 移动已跟踪旧应用，忽略的运行文件随目录或单独原样移动。661 个文件迁移前后逐一 SHA256 相同；清单仅存本机忽略的 `.local/phase4-move-hashes.json`。没有删除/重建数据库、重置密码或修改 schema。根目录异常 `NUL` 保持原状且忽略。`ini.ini` 原有未提交内容保留；已跟踪的 INI 不会因 `.gitignore` 自动消失，不能用 `git add -A` 把运行修改一起提交。

## Phase 5：Node-native 管理设置读取

| 模块 | 当前统一 API Owner | Legacy 页面 Owner / 权威写入方 |
| --- | --- | --- |
| `GET /api/v1/settings` | **Node-native** `SettingsService` + `SettingsRepository`；读取 playmode/startvolume/requestlistactivereload 与整文件 SHA256 revision | 原 PHP GET 保留为兼容/行为参考；没有写入 |
| `PUT /api/v1/settings` | Node 校验/授权，Legacy Adapter 单次调用 | **PHP 唯一设置写入方**，原 revision 校验与 serializer 不变 |
| 管理授权及撤销检查 | Node 会话 + 原 PHP 认证证明检查 | PHP 验证当前 configpass/UUID/EasyAuth 策略；没有复制密码验证算法 |
| 队列、播放、搜索、状态、能力等其余领域 | Node 统一边界，PHP 业务实现 | PHP；未迁移/未新增写入方 |

覆盖计数固定按当前统一 API 的 7 类领域 GET 路由：capabilities、queue、playback、search、admin/queue、admin/status、settings。**1/7（约 14.3%）已 Node-native**；不将搜索两个 backend 分开计数，不包含登录/会话/health。业务写路由仍为 0/5 Node-native（预约、删除、调序、设置、播放控制），所有写入归 PHP。这是路由读取范围计数，不能解释为整个应用已迁移 14.3%。

### 选择与调用链

队列读取包含多次 SQL、顺序、保密 owner（IP/UA/用户名字）与历史初始化依赖；状态需要 Windows/player。旧设置 GET 也会经过 `_common.php` → `commonfunc.php` → `kara_config.php` → `initdb/updatedb`，并非无副作用读取。Node 读取三个设置的范围最小，不需要 SQLite。

新链路：管理会话检查 → PHP `admin-session` 仅验证当前证明并返回 config_revision → Node 只读单文件、校验该 revision、独立投影及范围校验 → 再次验证证明与 revision → 返回既有 Settings。PHP 的 session 分支在加载公共业务代码前退出，不初始化数据库；不调用 `admin-settings`、不从 PHP 取得设置字段。隔离测试的授权门没有设置业务实现，Node 仍返回真实文件投影，验证其独立性。

`SettingsRepository` 只提供只读快照，没有创建/写入/修复方法；路径由服务端 `LEGACY_SETTINGS_PATH` 固定且必须绝对，不接受浏览器路径。Node 没有 SQLite 驱动、数据库目录或 WAL mount。读取是单个 Buffer，revision 和字段来自相同字节，无缓存。Docker 仅将现有 `config.ini` 只读挂载到 `/run/legacy-settings/config.ini`；配置没有进入镜像、环境变量、测试文件或日志。Node 进程因此新增对整个原 INI 的读取权限，原始字节只在请求内处理，响应严格限制为三字段及哈希；不得将此目录做静态服务或把配置加入诊断输出。

### 等价范围与明确差异

- 保持原 `Settings` 契约、默认值 3/50/1、PHP 常见 INI 布尔与数值转换、缺省/空值、重复项最后值、非分节读取、CRLF、revision 字节哈希和原 API 范围约束。17 组隔离输入逐一与原 PHP 投影比较。
- PHP oracle 从现有 `api/admin.php` 提取实际投影语句执行，不手抄期望算法；只加载合成输入/请求内只读快照，不 include 公共启动器、不连接 SQLite、不触碰真实配置。测试中完整配置只经 stdin 瞬时传递，输出仅白名单字段与哈希，无凭据产物。
- 只支持当前 serializer 的单行标量设置格式；目标数组、单引号/引用 key、PHP 常量、表达式、环境插值、特殊转义/多行等不在等价声明内，明确返回 `503 SETTINGS_UNAVAILABLE`，不回退 PHP、不猜测成功。保留的原 PHP 可能接受这些格式；这是已记录的失败关闭差异，不宣称完整复刻 PHP INI 解释器。
- 旧 PHP 配置写入没有锁或原子替换。本次前后版本比较能拒绝观察到的变化和失效 inode 挂载，不能证明没有“写入暂停期间恰好两次读到相同中间文件”的窗口；没有借本阶段改写原配置 writer。后续原子配置发布/协作锁需独立改造。
- 手工 atomic replace/重命名替换 config.ini 可能令 Docker 单文件 bind 保留旧 inode；PHP revision 与 Node 文件不匹配即 503，执行 `docker compose -f docker/compose.yaml up -d --force-recreate api-server` 恢复挂载。不使用旧值继续成功响应。容器重建使原内存 Node 会话失效，需重新登录。
- 设置无排序或用户歌曲保密概念；相关对照验证配置重复项及字段顺序无关性、白名单输出不包含密码/额外字段。队列排序和保密测试继续由现有真实集成/E2E 回归覆盖，不声称已迁移队列。

管理端原 `/api/v1/settings` GET 已自动切换到 Node 实现，PUT 不变；Edge 额外验证 GET 的 `X-Yukari-Owner: node-settings-read` 标记。普通 user-web 没有管理设置功能，其代理及服务端权限维持拒绝。

旧 `/init.php` 与旧 JS 不切换：Basic/EasyAuth 身份不能安全自动映射到 Node 管理会话，且认证后的旧设置 GET 自身可能序列化配置。Apache 仍只代理公开健康状态，未开放旧端口 `/api/v1/settings`、未新增 8080 管理 Origin、未引入 PHP → Node 调用。旧只读实现为兼容保留，不引入第二个写入方。

### 本阶段验证结果

三个项目 typecheck/build 通过；Compose 实际重建启动；300 个 Legacy PHP 语法检查、13 + 5 项原认证检查及 oracle PHP 语法通过。API 测试共 8 项通过，覆盖上述 17 组投影、新增不支持格式、文件缺失/版本冲突、隔离授权门的撤销/并发变化、真实配置快照等价、权限/Origin 与原写操作回归。真实 Edge：user-web 5 通过、1 跳过（曲库命中未配置），admin-web 3 通过。原队列清理后回读一致，config.ini/ini.ini 的原字节保留。

全新工作区没有 config.ini 时，严格只读单文件 mount 不会替用户生成配置：先 `docker compose -f docker/compose.yaml up --build -d web`，在原设置页配置并保存管理密码，再执行完整 `up --build -d`。已有配置的当前工作区仍为一条 Compose 命令启动。本机 Node 开发必须将 `LEGACY_SETTINGS_PATH` 指向现有配置的绝对路径，不复制配置或把其内容放入 `.env`。

## 调用、契约与副作用

下表中的 Node 路径均以 `/api/v1` 为前缀。“边界已统一”表示 React 使用 Node 再由 Bridge 调用 PHP，不表示业务已改写为 Node。原 PHP 的权限描述是现状审计，不能当作新 API 的授权要求。

| 旧入口 / 调用者 | 原方法与参数、响应 | 业务 Owner / 副作用 | Node 接口与权限 | 旧页面迁移状态 |
| --- | --- | --- | --- | --- |
| `/index.php`、`/requestlist_top.php` | GET；跳转至原队列 HTML | PHP 页面与导航 | 无替代 | 保留 |
| `/search.php` → `/search_bs5.php` | GET `searchword`、`order`、`start`、`orderby`、`scending`、`selectid`；HTML | PHP Everything 排序/过滤；可写搜索历史日志 | `/search?backend=everything&keyword=...` GET，user 会话 | 原页面直连 PHP；React 边界已统一 |
| `/searchfilefromkeyword_json.php` | GET 查询参数；展示用 JSON 中含 HTML | PHP Everything 搜索、优先级及展示组装 | 同上；没有逐字段等价替换 | 保留，不将 HTML 当新契约 |
| `/api/search.php` | `api_param` 接受 GET/POST；`keyword` 必填，`order/path` 可选；`{ok,data:{keyword,total,count,items}}` | PHP 原 Everything 查询，可附加曲库 worker | `/search` GET；Everything 不可达 503 | 保留；Node Bridge 固定调用 |
| `/search_listerdb*.php` | 页面/JSON 子入口；`anyword` 等，详见文件注释 | PHP YukaLister 原查询，依赖现有库；可能缺表失败 | `/search?backend=lister&keyword=...` GET，user | 保留算法与旧查询，不修库 |
| `/request_confirm*.php`、`/request.php` | GET/POST 文件、歌手等；确认 HTML | PHP 预约确认，不等于已入库 | React 直接展示确认状态 | 保留 |
| `/exec.php` | 原表单链 POST（代码使用 `$_REQUEST`）；`filename/fullpath/singer/freesinger/comment/kind`，`secret` 可选；XHR `{newid}`，其他模式 HTML/跳转 | PHP 唯一预约写入方：requesttable、顺序、历史、通知；元数据查询可能在提交后失败 | `/requests` POST JSON，user；201 `{ok:true,data:{id}}`；不自动重试 | 旧表单仍直接 PHP，不经 Node 回环 |
| `/requestlist_swipe_json.php`、`/requestlist_table_json.php`、`/requestlist_json.php`、`/requestlist_xml.php` | GET；展示 JSON/XML，具体字段不同 | PHP 队列与保密遮罩 | `/queue` GET，user；统一 `QueueData` | 原端点保留；swipe 页由 Node 返回兼容格式 |
| `/api/requests.php` | GET/POST 参数 `limit/offset` 可选；`{ok,data:{items,total,has_more,remaining_count,remaining_seconds}}` | PHP `build_requestlist_data`，reqorder 降序，owner 遮罩 | `/queue`、`/admin/queue` GET，分别 user/admin | 原入口保留；React 队列已由 Node 直接查询 |
| `/requestlist_event.php`、`/updaterequestlist.php` | SSE / 原刷新入口 | PHP 更新通知和队列刷新 | 无 Node-native 事件流 | 保留；历史 SSE 配置问题未在本阶段改写 |
| `/delete.php`、`/api/request_delete.php` | 原 UI 参数分支；JSON 入口接受 `id`，成功 `{ok,data:{id,deleted:true}}` | PHP 删除、normalize_reqorder、通知 | `/admin/requests/:id` DELETE，admin；只调用 PHP 一次 | 保留旧访问规则；新边界强制 admin |
| `/api/request_move.php`、原 `/delete.php` 调序分支 | `id`、`action=up/down/warikomi`；`{ok,data:{id,action,message}}` | PHP `dbup/dbdown/warikomi`、归一化、通知 | `/admin/requests/:id/move` POST JSON，admin | 保留原 UI，不改排序规则 |
| `/requestlist_reorder.php` | 原拖拽排序表单参数及响应 | PHP 批量顺序写入 | 无批量 Node 路由 | 保留，尚未迁移 |
| `/init.php` | GET 管理 HTML；POST 完整原设置表单 | PHP 保留旧页/设置保存；Node 负责统一 API 三项读取。已认证 GET 也可能序列化配置及 ini.ini，因此未为验收执行该 GET | `/settings` GET/PUT，admin；仅 playmode/startvolume/requestlistactivereload + revision | 原完整设置保留，React 仅三个字段；GET 已 Node-native、PUT 仍 PHP |
| `/api/admin.php?operation=...` | session/queue/status/settings 为 GET；delete/move/settings-save/player 为 POST form-urlencoded；统一 PHP envelope | PHP 薄适配器复用原函数；写入仍归 PHP | `/admin/session`、`/admin/status`、管理队列、设置、播放器子集；admin | 旧 Phase 2 接口保留，未向普通用户代理 |
| `/get_playingstatus_json.php`、`/playingsong.php`、`/api/nowplaying.php`、`/api/playstatus.php` | GET 状态 JSON/HTML；不同旧格式 | PHP 原播放状态，依赖 Windows/播放器与元数据 | `/playback` GET，user；`/admin/status` GET，admin | 保留，不由前端推断当前曲目 |
| `/mpcctrl*.php`、`/foobarctl*.php`、`/api/player.php`、`/player_event.php` | 原 action/player/音量/命令等；旧 HTML/JSON | PHP MPC-BE/foobar 控制，可能实际影响播放或队列 | `/playback/control` POST，admin；只允许 mpc/foobar 与 play/pause/playpause/stop 子集 | 原兼容入口仍有效；Phase 9 新建独立 mpv Agent 测试链路，不替换这些旧接口 |
| `/api/capabilities.php` | GET；features 等能力 JSON | PHP 组件/服务能力探测 | `/capabilities` GET，user | 保留 |
| `/api/server_info.php` | GET；`{ok,data:{app,version,easyauth_required}}`，认证前可读 | PHP 应用版本与 EasyAuth 策略；并非纯 Node 状态 | 无等价 Node-native 替换 | 保留；不拿 Node 进程版本伪装应用版本 |
| `/mypage*.php`、`/api/mypage.php` | 多种 action、userid、收藏/历史/同步字段；HTML/JSON | PHP 用户、历史、收藏、OAuth/Drive；可能写库/外部服务 | 无对应统一 Node 路由 | 未迁移 |
| `/api/file_details.php`、`/api/song_metadata.php`、`/api/lister_index.php` | 见各端点注释的路径/索引参数；JSON | PHP 元数据/音轨/Lister 索引 | 无对应 Node-native 模块 | 未迁移 |
| `/listimport.php`、`/listexport*.php`、`/simplelist*.php` | 原上传/导入导出参数；HTML/文件 | PHP 曲库、队列导入导出，可能写真实数据 | 无新实现 | 保留；未执行真实导入 |
| `/edit_*.php`、`/song_metadata_edit_bs5.php`、`/metadata_correction_csv.php` | 原配置/元数据表单或 CSV | PHP 原 JSON/曲库/优先级写入 | 无新实现 | 保留，未测试真实配置变更 |
| `/backup_restore.php` | Basic 管理认证；action=download、db/bgimg 可选，恢复为上传表单 | PHP 备份/恢复可覆盖配置和库 | 无新实现 | 路径关系保留；未执行恢复 |
| `/online_update.php` | ACTION 或 UPDATEVERSION/METHOD | 原单体 Git/ZIP 更新可能覆盖源码或 reset | 无新实现 | monorepo 下明确拒绝 Git/ZIP/GC/初始化写入；改用仓库部署 |
| `/cms/`、`/notfoundrequest/`、`/ddns/`、下载上传、bingo、`/v2/` | 各原页面/JS 表单协议 | 全部 PHP/旧 JS；部分写库或依赖外部网络/Windows | 无新实现 | 整体保留，未宣称业务已迁移 |
| 新旧页 `/api/v1/meta/health` | GET，无参数；`{ok:true,data:{service:'yukari-api',version:'v1'}}` | **Node-native**；不调用 PHP、不读库、不创建会话 | 公开、只读、无凭据 | 旧页 JS 已切换；仅基础设施状态，不计业务覆盖 |

原 JSON 失败通常 `{ok:false,error:字符串}`，Node 则 `{ok:false,error:{code,message,requestId?,legacyStatus?,legacyReason?}}`。不得对旧页面全局替换 fetch URL，因为响应、状态码、owner 和写入语义并不等价。部分“只读” PHP include 会初始化库/补元数据；本阶段没有引入 Node SQLite 直读或新的 WAL/锁策略。

## 有限同源 Adapter 与身份隔离

`print_meta_header()` 在 Compose 的 `YUKARI_MONOREPO=1` 下加载 `/js/node-status.js`。脚本只请求固定 `/api/v1/meta/health`，超时 5 秒，`credentials: omit`；失败显示不可达，旧 PHP 搜索/队列仍可使用。没有 PHP 服务端 HTTP 请求 Node。

Apache 仅将**精确健康路径**代理到固定 `http://api-server:3000`（连接超时 2 秒、总超时 5 秒），主动去掉 Authorization/Cookie，其余 `/api/v1` 在旧端口返回 403。该公开端点没有身份或用户数据，因而无需内部用户身份映射。若未来需要代理有身份功能，须另行设计认证与 Origin 策略，不能扩宽此代理或添加可伪造角色 Header。

Fastify 的 admin Origin 白名单没有新增 8080，管理会话、密码证明、CSRF 标记、HttpOnly Cookie 和 Bridge 服务凭据校验全部保留。原 Basic 管理员不会自动获得 Node 会话；React 的 Node 会话不会被旧 UI 借用。健康请求不返回 Set-Cookie。Apache 同时禁止下载 INI/DB/WAL/SHM/journal/日志/私钥。

调用图只有三条：

```text
React UI -> Node /api/v1 -> trusted PHP Bridge -> PHP business
Legacy UI -> original PHP business
Legacy status JS -> Apache exact health proxy -> Node-native health
```

健康 handler 不引用 Legacy Adapter，无 PHP -> Node -> PHP 递归。旧写入口没有换路由，Node 也不重试/复制写入。

## 路径审计

| 模式 / 文件 | 处理与边界 |
| --- | --- |
| `api/{_common,admin,node_bridge,server_info}.php` 的 `chdir(dirname(__DIR__))` | 仍解析为完整 PHP 根目录；CLI 运行应用时也须以 `legacy/php/` 为 CWD |
| `__DIR__` / `dirname(__FILE__)`：背景图、缓存、补偿 JSON、优先级 JSON、备份、Google relay | 依赖文件随应用移动，内部层级不变；未改凭据或配置值 |
| 配置中的相对 SQLite 路径及 journal/WAL | 整个目录 bind mount，没有逐个数据库文件 mount；数据库与旁文件同目录。根目录已有两个空 List.sqlite3（含异常文件名）原样保留在新位置，没有修库 |
| `getcwd()` | manage-mpc 仅显示；原主入口在 DocumentRoot，子模块沿用原 chdir/include 关系 |
| `DOCUMENT_ROOT` | 本应用自有 PHP 未发现依赖该值的新硬编码；Apache 仍为 `/var/www/html`，只改变宿主挂载来源 |
| Windows 绝对路径、Everything、tasklist、MPC/foobar、BAT/VBS | 没有改写配置或搜索算法。cmd/l-smash/播放器附属文件相对层级保留；外部 C:\\、XAMPP/nginx 包布局仍需 Windows 现场配置，本 Linux Docker 不支持真实播放 |
| 旧 Git/ZIP updater 的 `.git` 和 archive-root 假设 | monorepo 下显式阻止执行，不能把 Git 根目录改到上层后继续运行旧 reset/checkout |
| Inno Setup | 脚本随旧应用移动；LICENSE/README 的 Source 改为 `../../` 项目文件。未在 Windows 打包或执行安装 |
| 测试中的配置/认证源路径 | TS 测试只从 `legacy/php/config.ini` 瞬时读取；PHP guard 测试从 `/workspace/apps/...` 加载 `legacy/php/api/...` |

已有运行配置/INI 和历史随仓库携带的 pfwd PPK 不新生成、不打印、不重置；PPK 不是新增的 Bridge 凭据，HTTP 下载已禁止。历史仓库携带密钥的问题需独立确认用途/轮换，不能以移动目录宣称已消除历史泄露。Bridge 凭据仍仅在原 Docker 私有 volume，未进入 Legacy 源码目录。

## 本次验证

- 三个项目 typecheck/build 通过；Compose 实际 build/up 成功。
- PHP 全量 300 文件语法通过；修复原上传页 `<? php` 错误；内存认证检查 13 + 5 项通过。
- 真实 API 4 项通过：原接口 URL、健康新旧响应一致、旧代理拒绝非白名单、敏感文件拒绝、认证/CSRF/伪造身份拒绝、无双写、调序删除、原队列回读一致、设置无变化保存。
- user-web Edge：5 通过、1 跳过（真实曲库命中未配置）。包含旧搜索页实际加载健康状态及 Node 状态请求失败提示；失败测试通过浏览器中止网络请求模拟断线，没有伪造成功响应。
- admin-web Edge：3 通过，覆盖真实登录、测试记录调序/删除、设置无变化保存和播放器不可达。
- 测试只新增独立测试预约，finally 清理并比较原队列；计数/匿名测试用户沿用 Phase 3 的非整库回滚策略。配置和原 ini.ini 内容哈希保持迁移前一致。

可重复命令（仓库根目录）：

```powershell
docker compose -f docker/compose.yaml up --build -d
docker compose -f docker/compose.yaml exec -T web php /workspace/docker/check-php.php
docker compose -f docker/compose.yaml exec -T web php /workspace/apps/api-server/tests/php/auth-check.php
docker compose -f docker/compose.yaml exec -T web php /workspace/apps/admin-web/tests/php/admin-auth-check.php
npm.cmd --prefix apps/api-server run build
npm.cmd --prefix apps/user-web run build
npm.cmd --prefix apps/admin-web run build
npm.cmd --prefix apps/api-server test
npm.cmd --prefix apps/user-web run test:e2e
npm.cmd --prefix apps/admin-web run test:e2e
```

尚未验证真实媒体播放、Windows 安装器、备份恢复、实际设置值变更和外部 OAuth/Drive/DDNS。旧 PHP 的宽松历史权限依然存在，仅本机暴露；没有把健康适配视为旧写接口安全加固。下一阶段应先选择真正可独立迁移的只读领域，再定义新旧契约与凭据边界；业务迁移前继续由 PHP 独占写入。


## Phase 6：已部署的 Node-native 队列

| 路由/模块 | 当前 Owner / 契约 | 权限与副作用 |
| --- | --- | --- |
| GET /api/v1/queue | Node SQLite + QueueService，保持 QueueData/八字段 QueueItem | user 会话；原受信证明验证，遮罩非 owner 秘密数据 |
| GET /api/v1/admin/queue | Node SQLite + QueueService，同一契约 | admin 会话，普通用户或角色头不能升级；原策略变化撤销 |
| GET /api/v1/legacy/queue?limit&offset | Node 同一 Service，LegacyQueueData 完整展示字段 | 仅专用 HMAC 读取票据，30 秒、IP/UA/角色/用途/配置策略绑定 |
| POST /api/queue_ticket.php | PHP 原 EasyAuth/非空 Basic 管理验证；无队列 SQL | 同源 JSON + X-Yukari-Client，Host/Origin 白名单；不接受角色/IP 参数 |
| Bridge queue-context / legacy-queue-context | PHP 认证/配置数据，不加载公共业务启动器 | 私有服务凭据 + 原会话证明或专用票据；不查询队列 |
| initdb/updatedb、元数据写、WAL/SHM 生命周期 | PHP 生命周期及原写链 | Native GET 不执行 DDL、repair、checkpoint 或补元数据 |
| 预约、删除、调序、设置保存、播放器 | PHP 唯一业务写入方 | Node 只单次转发，Legacy 仍原调用 |

沿用 Phase 5 的 7 类领域 GET 分母，3/7（42.9%）已 Native：queue、admin/queue、settings；兼容路由不重复计数。五类业务写仍 0/5 Native。旧 PHP 读取端点为兼容/行为参考保留，不等于新增写 Owner。

### 数据库与快照

经用户明确同意，停服将原 request.db 原样移到 legacy/php/runtime/queue/request.db，迁移前后 SHA256 相同，真实 config.ini 只修改 dbname 路径，未改密码或 Schema。未复制生产库。原整 Legacy 目录挂载被自动审批拒绝后没有执行；最终 Node 只挂专用 queue 目录（内核只读）、Phase 5 原有配置单文件（只读）和 Bridge 私有 volume。不挂载其他 Legacy 源码、私钥或运行目录。runtime 的 HTTP 访问整体禁止。

QueueRepository 配置绝对根目录并 realpath 防越界；readOnly/query_only、250ms busy timeout、单一 BEGIN/COMMIT，统计/全部排序行来自一致快照。数据库与 WAL/SHM 同目录可见，无 immutable、活跃库裸复制或第二数据模型。每次新连接，不缓存；路径从 PHP 真实配置得到且限于已挂载目录，不接受浏览器文件路径。缺表、损坏、BLOB、锁或不可读库明确失败，不冒充空结果。

原库持久启用 WAL，但短连接关闭可能移除旁文件。PHP 容器的 queue-wal-anchor.php 以 www-data、mode=rw 连接**已存在**的库，只读 sqlite_schema，维持 WAL/SHM，不持有长事务、不改 journal mode/Schema/业务数据。旁文件初始化明确由 PHP 生命周期负责；Node 只读挂载不获得写权限。若 anchor 不可用且旁文件清除，Native 队列报 503，不忽略 WAL。新 Docker 安装默认专用目录；已存在旧库不被启动脚本自动移动，非 Docker Legacy 仍保留原默认路径。

### 行为等价与区别

保留 reqorder DESC（相同顺序值不擅加次序）、position=total-offset-index、limit=0 忽略筛选但保留 offset 对 position 的历史作用。remaining_count/seconds 只统计未再生/1，duration>0，按 PHP 整数语义转换；empty('0')/空播放标记退回 '1'。这是数据库播放标记，不调用播放器或自行判定实际播放。

owner = 同一非空 clientip+clientua，或该身份从全量 DESC 反转后首条匹配记录 singer 的同名记录。React 使用 PHP 所见 Bridge IP + Node 为用户分配的唯一 UA；Legacy 使用签名的实际浏览器 IP/UA，不能拿 UUID Cookie 当老浏览器身份。未播放秘密的 display_name 保留占位，非本人非管理员还清除 songfile/元数据/fullpath；comment/singer 维持原 PHP 行为。Legacy 同 IP+UA 或同名的历史共享 owner 行为不改造为新账号模型。

PHP 实际 builder 和原 username helpers 在独立内存 SQLite 上执行，不加载真实配置/公共启动器。Node 等价测试覆盖空队列、排序/分页/重复 reqorder、本人/同名/陌生/admin、异常标量。原 PHP 多次 SQL 没有统一快照，Node 的并发一致性是明确改进；worker/WAL 测试保证 total、records、remaining 聚合同属一个快照。原读取入口附带的 initdb/updatedb 等写作用不假装消失：它们继续属于 PHP 生命周期/写链，Node 缺少准备好的库时失败，不自动改真实 Schema。

### Legacy 安全接入

已切换 requestlist_swipe.php 的五处列表加载/刷新，YUKARI_NODE_QUEUE=1 启用；其他 JSON/XML 旧页面仍保留原实现。浏览器先同源取得短时票据，再请求精确 /api/v1/legacy/queue。票据仅请求内存/自定义头，不存 Cookie/localStorage/URL，不缓存密码。普通角色头、PHP_AUTH_USER 名称或 Node Cookie 不能获得 admin；管理员签发必须校验原实际非空密码，无 localhost 免检。配置策略变化由 PHP 每次验证撤销。

Apache 仅代理 health/legacy-queue，去掉 Basic/Cookie；Node JS credentials:omit。仅专用 Legacy 读取路由接受旧页 Origin，React 管理路由白名单不扩宽。票据不创建 Node admin session，不可用于管理写 API。没有 PHP 服务端请求 Node，也没有 Node 调原 PHP 队列业务，因此无循环、无双写。新读取失败显示错误，不静默回退。未开启标志的独立 Legacy 部署仍原样运行。

### 验证与未覆盖

三个项目 typecheck/build、303 Legacy PHP 语法、13+5 原认证检查及 helper PHP 语法通过。API 14 项通过；user-web Edge 6 通过、1 跳过（真实曲库）；admin-web Edge 3 通过。真实 Legacy PHP 预约即时可见，owner/不同 UA 陌生人遮罩正确，原 swipe_json 不再请求；管理调序/删除仍 PHP 单写并由 Node回读。原队列已恢复原 id=3/reqorder=1，测试记录及专用历史清理；自增计数/匿名测试用户可能保留，不回滚整库。

大型队列性能、真实媒体播放和所有 Legacy 页面尚未覆盖；WAL helper 是运行依赖，/health 仅进程健康。原 config.ini 非原子写窗口仍是 Phase 5 限制，本阶段没有扩大研究。Windows、搜索和播放器仍原依赖。参考 [Node 24 SQLite API](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)。


## Phase 7：管理员队列写入 Owner 切换

日期：2026-10-20。以下为当前部署规则，覆盖前文 Phase 1–6 的历史 Owner 状态。

| 范围 | 当前 Owner / 路径 | 权限、副作用与兼容状态 |
| --- | --- | --- |
| DELETE `/api/v1/admin/requests/:id` | **Node-native** QueueMutationService/Repository | 原 Node admin 会话、Origin、JSON/CSRF、PHP 当前证明校验；仅删除 requesttable，不删历史，不停止播放器 |
| POST `/api/v1/admin/requests/:id/move` | **Node-native**；`{action:up/down/warikomi}` | 与删除相同权限；返回 `{id,action,message}`，保留边界日文提示 |
| 归一化 | Node 管理事务内部 | `reqorder ASC,id ASC` 从 1 编号；PHP 创建自动整列仍是创建事务的一部分，不是第二个管理员调序入口 |
| 更新通知 | PHP notification-only Bridge | queue-notify 验证 Bridge 凭据及当前 admin proof，只加载原 UpdateNotice；计数 `<50000` 加一，否则归零；不 include commonfunc/队列 SQL |
| 创建/替换、自动轮换、元数据、历史、播放标记 | PHP | 保留 exec.php 和生命周期；不存在“所有数据库写入均迁到 Node”的声明 |
| 设置 PUT / 播放控制 | PHP | 未迁移 |

读路由 Native 仍为 3/7。五类写路由（创建、删除、移动、设置、播放控制）中 **2/5 的队列主事务为 Node-native**；通知仍复用 PHP，不把此计数理解为完全摆脱 PHP。Native 写响应包含 `X-Yukari-Owner: node-queue-mutation`；React 请求路径和交互不变。

### 原行为与明确差异

原 API 删除：存在性检查 → DELETE（独立提交）→ normalize（另一事务）→ notify。原 move：查邻居 → 使用临时 reqorder=9999 的三次 UPDATE 事务，warikomi 可反复调用 → normalize 单独事务 → notify。Node 将查找、删除/全部交换、normalize 放在一个 `BEGIN IMMEDIATE`，busy_timeout=1000ms；失败整体 ROLLBACK，无自动重试。保留间隔查邻居、同值按原查询选择、原临时 9999 碰撞行为和 normalize 的 id 次序。

warikomi 仅把字符串 `未再生` 视作待播放，`1` 不算；扫描遇 `再生中` 停止，遇 `未再生` 却交换最近的较小 reqorder，跳过状态扫描与实际交换不是同一件事。保持真实实现，未改写成理想化“移至下一首”。异常数据若导致重复队列状态，Node 返回 409 QUEUE_ORDER_CYCLE 并回滚，替代 Legacy 可能无穷循环；这是明确安全差异。非法 HTTP ID/action 返回 400，不存在返回 404，不通知。

通知原本位于队列提交之后、且旧 helper 吞失败，两个 SQLite 文件之间没有原子事务。现在成功提交后仅通知一次，通知不可用返回 502 `QUEUE_COMMITTED_NOTICE_FAILED`，明确“队列已提交，不要重试”；不能声称通知失败会回滚已提交队列。队列事务失败不通知。SSE、其计数语义、历史与播放器状态保持；没有实现跨库 outbox 或幂等机制。

### Legacy 收敛及保留能力

在 Compose 的 YUKARI_NODE_QUEUE_MUTATIONS=1 下，以下入口在 bootstrap/数据库访问前返回 **410**，引导独立 admin-web 登录，不把 Basic 或 read ticket 映射到写会话：

- delete.php（包含旧状态重置）、api/request_delete.php、api/request_move.php。
- api/admin.php 的 delete/move；Bridge 旧 admin-delete/admin-move 也到该关闭检查。
- requestlist_reorder.php 批量拖拽/Undo、listclear.php、listimport.php，update.php 的 reqorder 参数。
- backup_restore.php 勾选数据库的 restore；HTTP fortest/test_race 目录禁止访问。

批量拖拽、清空、导入、状态重置与数据库恢复本阶段**未迁移且不可通过旧入口执行**；关闭是为阻止它们绕过新单一管理写 Owner，不伪称保持全部旧写功能。旧 swipe 对 410 明确提示、回读，不把失败当成功；旧表格按钮恢复可用状态并给管理端地址。旧队列读取、普通创建、字段编辑和播放标记入口仍保留。单独 Legacy 部署未开启标志时仍保留原实现，属于不同部署模式。

### SQLite 部署边界

Node 只增加专用 runtime/queue 目录读写权限，没有整 Legacy 挂载、通知库挂载、配置写权限或 Schema 变更。非 root Node 加入 gid 33；PHP 启动使用 umask 0002、专用目录 setgid/组写权限，DB/WAL/SHM 一起共享；不以全容器 root 解决权限。所有请求通过可信上下文得到数据库相对名，realpath 限制到配置的绝对目录；路径不存在不会主动初始化数据库。

Node 每次事务关闭连接，仍保留 queue-wal-anchor。本阶段 RW 目录可能已经满足 SQLite 创建 WAL/SHM 的权限条件，但没有删除 anchor 来宣称彻底收敛生命周期。下一阶段可先在停 anchor 的隔离环境验证只读连接、旁文件清理/重建、PHP/Node 重启与 readiness，再决定取消；仅把管理事务迁到 Node 不等于 Node 持久拥有全部写入或连接生命周期。现场未清卷、重建库或更改配置/密码。

### Phase 7 isolated test runbook

写测试使用 `.local/phase7-test-legacy` 的合成配置和由原 PHP 创建的隔离库，不复制生产 DB/INI/密钥。测试凭据是公开、仅用于此 fixture 的字符串，不是现场密码。准备脚本仅覆盖带固定合成 marker 的测试目录。两个 Compose 文件使用同一项目与本机端口，不能同时运行；测试结束恢复正常配置，无需删除任何 volume。

```powershell
node docker/prepare-isolated-tests.mjs
docker compose -f docker/compose.yaml stop api-server web
docker compose -f docker/compose.isolated.yaml up --build -d
$env:E2E_COMPOSE_FILE='docker/compose.isolated.yaml'
$env:E2E_CONFIG_PATH=(Join-Path (Get-Location) '.local/phase7-test-legacy/config.ini')
npm.cmd --prefix apps/api-server test
npm.cmd --prefix apps/user-web run test:e2e
npm.cmd --prefix apps/admin-web run test:e2e
# Also run each app's typecheck/build and existing PHP lint/auth commands.
docker compose -f docker/compose.isolated.yaml stop api-server web
docker compose -f docker/compose.yaml up --build -d
Remove-Item Env:E2E_COMPOSE_FILE, Env:E2E_CONFIG_PATH
```

测试辅助客户端对领域写操作要求隔离 marker；Playwright 在启动前也检查。跨运行时锁测试将两端均放 Linux 容器，避免 Windows/Linux 对 WAL shared-memory/锁格式的差异；通过握手让 PHP 持锁至 Node 开始竞争，再延迟提交，验证等待和新快照结果。PHP oracle 直接执行原 function_requestops.php 与抽取的原 normalize 函数，使用内存库对照完整队列字段与历史；不是手写 PHP 参考逻辑。测试 DB/runner/截图只留忽略的 `.local`/test-results。

### Phase 7 的创建预约迁移评估（已由 Phase 8 完成）

迁移成本明显高于管理删/移：需要迁移输入默认值、普通/小休止/替换差异、用户身份、自动轮换、元数据查询、history/Cookie、通知和错误契约。现 exec.php 在 INSERT/reqorder/自动轮换 COMMIT 后，才查 Lister 元数据、补写、更新通知、记录历史，最后输出 newid；后续异常会产生“已存在预约但响应失败”。不能以 Node 重试 PHP POST、第二次 INSERT 或失败即回滚前端显示解决。

上述隔离故障注入、事务边界和跨请求持久幂等设计已在下方 Phase 8 完成。Node 统一持有所有主写事务后，也仍需明确连接生命周期；可取消 anchor 的依据应是 WAL/readiness 回归结果，而不是 Native 路由计数。

## Phase 8：预约创建/替换 Owner 切换

### 业务 Owner 和调用链

| 操作 | Owner | 说明 |
| --- | --- | --- |
| `/api/v1/requests` 创建/替换 | **Node-native** | Node 在原 queue SQLite 执行单事务；PHP 只提供已认证的身份/只读元数据上下文及提交后的通知 helper，不执行 exec.php 写事务。 |
| Legacy `/exec.php` 创建/替换 | Node-native（兼容转发） | `YUKARI_NODE_REQUESTS=1` 时由 `_request_forward.php` 带原 Cookie/表单语义进入受限 Fastify 路由；关闭标志的独立旧部署仍使用旧 PHP 路径。 |
| 自动位置、替换、历史、预约身份字段 | Node-native | `requesttable` 变更、必要元数据和 history 与持久幂等凭据在 `BEGIN IMMEDIATE` 中共同提交。 |
| 通知/SSE | PHP 通知 helper | 仅在 Node commit 后调用；失败清楚标记已提交，不重试预约事务。 |
| 搜索、YukaLister/Everything、播放与元数据生命周期 | PHP | 搜索算法未迁移；Node 预约可在提交前请求只读曲库元数据。 |
| 管理删除、单项调序/归一化 | Node-native | Phase 7 已迁移。 |
| Legacy 批量排序/Undo | Node-native admin endpoint; Legacy uses an exact fixed-path ProxyPass | An exact fixed-path ProxyPass plus exact Location authorization now serves this route. Other `/api/v1` paths remain denied; Authorization is stripped and the Node admin cookie/session plus CSRF/Origin checks remain mandatory. |

### 参数、部分成功和幂等

Node 请求保留普通/小休止、singer/freesinger、comment、secret、replace/selectid、urlreq、kind、自动 reqorder 与旧 Cookie 身份语义。替换沿用目标记录的队列位置/播放状态/身份字段，避免把替换改成新建；必要元数据和历史已在同一队列事务内处理。Legacy PHP 的实际 exec.php 函数在隔离数据库作为 oracle；正常、替换、默认值、保密、历史、身份、自动位置和失败回滚均对照。Node 在历史写失败时整体回滚，PHP oracle 证明旧实现会在主预约 commit 后留下部分成功，这是本次明确修复的差异。

幂等表 `request_submission` 只在原 queue SQLite 中新增，不改现有表列；用户已批准该 additive schema。migration 是 CLI 显式执行、可重复验证，不在 Node 启动时自动执行。服务器发出随机提交 receipt，仅保存哈希、规范化输入哈希、用户 owner、预约 ID、操作、时间和有限结果。相同 receipt/输入回放同一结果；输入不同返回冲突，其他 owner 查不到结果。前端失败后复用相同 receipt 查询/回放，不得生成新的提交键重试不确定操作。通知失败不重写预约；跨库通知 exactly-once 未实现。

### 旧入口权限与管理功能

新 user-web 使用 user session、CSRF 和 `/api/v1/requests`；Legacy 页面先取 request intent，Node 所有权启用时获取一次性签名转发凭据，原 exec.php 只做兼容转交。Bridge 验证原 Cookie 身份；浏览器角色头不参与认证。Fastify 继续验证用户 session、Origin 和写请求标记。没有 Node→PHP→Node 预约写循环，Bridge 的只读身份/元数据及通知调用不是预约写入。

Phase 7 的常用旧版批量排序/Undo 已切至 admin-only `/api/v1/admin/queue/reorder`。初始 regex ProxyPass 浏览器回归返回 403；改为 exact-path ProxyPass 和 exact Location authorization 后 Legacy Edge 回归通过。其他 `/api/v1` 路径继续拒绝，浏览器 Basic 被剥离，Node 管理 Cookie/会话、Origin 和 CSRF 检查不变。清空、导入、恢复、旧 delete 状态重置仍关闭。

### 验证与当前部署

隔离真实 API suite 26/26 通过；PHP oracle 在每次运行创建独立 SQLite 并执行原 exec.php 业务体；Node/PHP 行为差异和主事务故障回滚已验证。API、user-web、admin-web typecheck/build 均通过。Legacy 用户预约浏览器链通过；user-web/Legacy Edge 5/5 通过，真实歌曲搜索按 fixture 未配置跳过；admin-web Edge 3/3 通过（两个 Vite 服务并行）。

真实数据库只执行经批准的 additive `request_submission` 表迁移；迁移前后 queue 记录摘要需一致。没有对真实预约进行写测试。跨 SQLite 通知恰好一次、曲库命中和播放器执行尚未验证；Legacy reorder exact-path Apache 映射已通过 Edge。queue-wal-anchor 暂留：本阶段没有完成其停机与旁文件生命周期测试，不能因 Node 预约化直接删除。

## Phase 9：Windows Player Agent（人工实播验收待完成）

### 播放业务审计与 Owner

| 功能 | 当前 Owner | Phase 9 状态 |
| --- | --- | --- |
| 原预约状态、nowplaying 标记、播放进度/音量偏移、next/start/stop | Legacy PHP + MPC-BE/foobar | 保留原入口和语义，未转接新 Agent |
| 播放任务、任务 ID/状态、Agent 心跳、管理员任务/控制命令 | Fastify + 单独 Player Agent JSON 状态卷 | Node 新增；只支持管理员发起本地测试视频，不读写 requesttable |
| 实际解码/暂停/继续/EOF 反馈 | Windows mpv 通过本机 JSON IPC | 已实现 Adapter；本机尚无 mpv、测试视频，因此未实播验收 |
| 用户公开 Agent 状态 | Fastify | 只暴露 connected/playback/active，不暴露文件名、绝对路径或 task ID |
| PotPlayer 控制 | 无新 Owner | 本机版本 26.06.22.0 的 CmdLine64.txt 确认命令行可指定 content、/current、/new 和 playlist；未发现支持的播放状态/结束事件或可靠无焦点 pause API，故不伪称支持 |

新增接口：POST /api/v1/admin/player-agent/test（管理员会话、Origin/CSRF；只创建配置好的测试视频任务）、GET /api/v1/admin/player-agent、POST /api/v1/admin/player-agent/control（pause/resume/stop）；Agent 以独立 Bearer token 调用 POST /api/v1/agent/next 与 /report。普通用户 GET /api/v1/playback/agent 仍需普通会话，只返回脱敏状态。Agent 路由不信任任何角色/IP Header；其 Bearer 不是浏览器会话。管理 API 不接受浏览器传入路径、命令或 exe。

任务状态 pending → claimed → playing → completed|failed，task ID 唯一；同一活动任务只分给一个 Agent ID，终态不可回退。状态快照通过原子 JSON 替换保存在独立 player_agent_state Docker volume，不改现有 SQLite Schema，不与 queue-wal-anchor 共享生命周期。pause/resume 是 Agent 控制指令，不把 task 状态改成“完成”。停止为 stopped/failed 结果；mpv EOF end-file 且 reason=eof 才标记 completed。任务/API 状态滞后或 IPC 断线时不能从进程创建推断实播；Agent 通过同 task ID 重连，并在 API 丢失活动任务时停止播放器。JSON 状态卷面向当前单个 Fastify 实例；部署多个 API 实例前需改为一致性任务协调。

Agent 的 PLAYER_MEDIA_ROOT 必须是绝对目录；PLAYER_TEST_VIDEO 只能是该目录下的相对文件名。双方 realpath 限制路径，拒绝目录穿越和根目录外 symlink。仅固定 MPV_PATH 可作为执行文件，spawn 使用 argv 且 shell:false。mpv 命名管道仅在宿主机本地使用，不映射到 Docker 网络。忽略的 .local/player-agent-token 是随机凭据，Compose API 只读挂载；Agent token 认证与原 Bridge/admin/session 凭据分开。Agent 每次 heartbeat/next 都报告 `testReady`；服务端及管理 UI 在缺少真实配置视频时拒绝创建测试任务。

### PotPlayer / mpv 核实与实播边界

宿主机已安装 PotPlayer 64-bit，版本 26.06.22.0，安装目录中的 CmdLine64.txt（1/19 更新）明确有文件 content 参数、/new、/current、/add、/insert、/seek。因此外部启动并打开文件已由发行包文档确认。没有发现该版本支持 HTTP API 或查询状态/可靠 EOF 消息；旧 MPC-BE HTTP 端口与 PotPlayer 不等价。暂停/停止可由播放器 UI 人工操作，但未接入脆弱键盘/窗口消息。

mpv 官方手册确认 Windows 的 input-ipc-server 使用 named pipe，JSON IPC 有命令响应、属性与事件；IPC 本身不安全，因此只保留在宿主本机，Fastify 凭据用于网络 Agent 边界。Agent 先连固定宿主 pipe，再按固定配置启动 mpv；实况来自 idle-active / pause / path 属性，结束只认 end-file reason eof。见 [mpv 官方 JSON IPC 手册](https://mpv.io/manual/stable/#json-ipc)。

本机已确认 winget 包 `shinchiro.mpv 0.41.0` 的可执行文件 `C:\Program Files\MPV Player\mpv.exe` 可直接运行 `--version`，输出版本 `v0.41.0-244-gaf9c81fa1`；Agent 经显式 `MPV_PATH` 使用该文件，不依赖 PATH。FFmpeg 9.0 生成了仓库外 `D:\project\yukari\test-media\agent-test.mp4`，时长 15 秒，含 H.264 视频与 AAC 音轨。唯一宿主 Agent 已连到 Docker Fastify，心跳 connected/testReady=true/playback=idle。尚未由管理员创建任务；管理员需在 System 页启动测试，并人工确认画面/声音、暂停/继续/停止，随后允许完整播放确认真实 EOF。PotPlayer 命令行打开未做实播验收，且状态/结束事件能力仍未确认。

当前只运行测试任务，不自动领取真实预约、不改变 nowplaying、不触发原 songstart/songnext、volume offset、progress SSE 或 update_playerprogress.php。自动切歌要先对真实媒体路径映射、当前 Legacy 再生中/停止中/再生済更新时机、MPC track/key/audiodelay/volume、异常结束/人工停止语义与通知做隔离等价测试；没有把“播放一定时长”当结束。原 /playback 与 /playback/control Legacy 实况/控制仍兼容。


Phase 9 admin Vite routes: the dev proxy permits only exact /api/v1/admin/player-agent GET and /test/control POST paths. This is a routing filter only; every request still requires the normal Fastify admin session and write CSRF/Origin validation. The no-session smoke check returns 401 from Fastify.
