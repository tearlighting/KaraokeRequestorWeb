# 渐进式重构进度

当前阶段：Phase 3 已建立 Fastify + TypeScript 统一 API Server。两个 Web 只经 `/api/v1` 调用 Node，再通过内部 Legacy PHP Adapter 复用原业务。user-web `http://127.0.0.1:5173/`、admin-web `http://127.0.0.1:5174/`、Node `http://127.0.0.1:3000/health`、原 PHP `http://127.0.0.1:8080/`。下方 Phase 1/2 是历史记录，其空密码与直连 PHP 描述不再代表新 API 的当前行为。

## Phase 1 记录

日期：2026-10-19（Asia/Tokyo）。本阶段已建立独立用户端并运行真实浏览器到原 PHP 的预约链路；真实歌曲搜索命中和播放仍受外部组件缺失阻碍。

## 访问与启动

- 新用户端：http://127.0.0.1:5173/ （本次已启动 Vite）
- 原 PHP：http://localhost:8080/ （原 `docker-web-1` 保持 healthy）
- 原搜索：http://localhost:8080/search.php
- 原队列：http://localhost:8080/requestlist_top.php
- 原管理设置：http://localhost:8080/init.php （需要现有管理员认证）

重启用户端：在 `apps/user-web` 执行 `npm.cmd ci`、`npm.cmd run dev`。Node 要求 >=22.12，当前验证为 24.18.0。非 Windows 可使用 npm。未新增 Node 或 Laravel 业务服务，Node 仅运行 Vite 开发/构建工具。

## 原始状态与修改范围

开始时 Git 已有未提交修改：`README.md`、`commonfunc.php`、`exec.php`、`ini.ini`、`kara_config.php`；未跟踪项包括 `docker/`、`List.sqlite3`、`NUL` 和一个名称包含反斜杠映射字符的 List.sqlite3 文件。以上均未编辑、重置或删除。Git 所有权检查通过命令级 `-c safe.directory=...` 读取，未修改全局 Git 配置。

本次只新增 `apps/user-web/` 和本文件。没有修改原版 PHP 代码、已有数据库结构、Docker Compose、admin 页面或播放程序；没有提交或 push。

当前 Compose 将项目目录绑定挂载到 `/var/www/html`、8080 映射到 Apache 80。原首页 `index.php` → `requestlist_top.php` → `requestlist_swipe.php`；原搜索 `search.php` → `search_bs5.php`。新版文件名搜索是在 PHP 中访问 Everything；不是所有搜索都由浏览器直接请求 JSON。Lister 文件列表页在服务端请求 `search_listerdb_filelist_json.php`。确认预约表单最终 POST 到 `exec.php`。

## 新用户端结构

```text
apps/user-web/
  src/
    App.tsx
    lib/php.ts
    features/
      search/           # 两种真实搜索接口与结果选择
      reservations/     # 原 exec.php 表单提交，歌曲/小休止
      queue/            # 服务端顺序、状态与播放信息
  tests/live-php.spec.ts # 真实 Edge + PHP，测试后清理预约
  vite.config.ts        # 固定路径/方法白名单的开发代理
  package-lock.json     # 精确依赖版本
```

使用 React 19.3.1、TypeScript 7.0.2、Vite 8.3.4、Tailwind 4.3.3。没有路由框架、全局状态库或额外业务后端。搜索、确认预约和队列在同一响应式页面完成。

## 真实 PHP 接口契约

以下 PHP URL 为现有接口，浏览器调用时统一加 `/php` 前缀，由 Vite 去掉前缀后转发到 Docker。原接口仍可按原 URL 访问。原 `/api/` 通用参数读取器接受 GET/POST，本阶段只为读取接口放行 GET。

| PHP URL | 新 UI 使用的方法和参数 | 原始响应 | 权限与依赖 |
| --- | --- | --- | --- |
| `/api/capabilities.php` | GET，无参数 | `{ok:true,data:{features,player,request,server}}` | `_common.php` EasyAuth；检查 Everything 81 端口与配置的 Lister 文件是否存在，文件存在不保证 schema 有效 |
| `/api/search.php` | GET，必需 `keyword`；原接口另支持 `order`、`path` | `{ok:true,data:{keyword,total,count,items:[{name,path,fullpath,size,priority,worker}]}}` | EasyAuth；调用原 `searchlocalfilename()`，依赖 Everything HTTP。上游不可用时可能仍返回成功的空数组 |
| `/api/lister_index.php` | GET，`mode=songs&anyword=关键词&flat=1`；原端点还支持其他 mode/筛选，本代理不放行其他 mode | `{ok:true,data:{total,files_total,items:[{song_name,song_artist,...,files:[{found_path,found_file_size,...}]}]}}` | EasyAuth；`listerDBPATH` 或默认 `list\\List.sqlite3`，需要有效 t_found 及相应元数据列；原 PHP 内部实现模糊搜索和年龄过滤 |
| `/exec.php` | POST，URL encoded；始终提交 `filename,singer,freesinger,comment,kind,fullpath`；带 `X-Requested-With: XMLHttpRequest` | 前后可能有空白的 `{"newid":整数}`，没有 `{ok,data}` 包装；非 XHR 返回 HTML | 该文件本身未调用 EasyAuth/ConfigAuth，无管理员条件；复用现有插入事务、reqorder/自动排序、历史与更新通知。依赖 request.db 可写，不验证实际文件存在 |
| `/api/requests.php` | GET；当前 UI 无参数读取全列表。原端点支持 `limit,offset`，0/省略 limit 表示全量 | `{ok:true,data:{items,total,has_more,remaining_count,remaining_seconds}}` | EasyAuth；共用 `build_requestlist_data()`，SQLite。实际代码包含 fullpath，尽管该文件头注释写“不包含”，契约以运行代码为准 |
| `/api/nowplaying.php` | GET，无参数 | 未播放 `{ok:true,data:{playing:false}}`；有状态时返回 `playing:true` 及 playingtitle、playingsinger、status、player 等 | EasyAuth；读取原 PlayerProgress 数据，不由 React 推测播放状态 |

预约 `kind` 本阶段固定为原合法值 `動画`（歌曲）或 `小休止`（休息）。freesinger 提交空字符串；singer 必填为本 UI 的选择，原代码允许为空。原约束是 comment <=512、filename <=2048、singer/freesinger <=256 个字符，非法 kind/超限可直接 die，导致 HTTP 200 + 空响应。新 UI 对空正文、HTML、非法 JSON 或缺少合法 newid 均报错，不显示预约成功，也不自动重试写入。

原接口还有升降调、音轨、保密、差替 selectid 等参数，本阶段 UI 不发送这些参数。原接口行为保持原样；Vite 白名单不是原 PHP 的完整权限模型，也不改变原 exec.php 的参数能力。

`/api/` 使用 `_common.php` → 原 EasyAuth，启用时按原请求/cookie 规则认证，原实现另有 localhost 例外。本环境 `easyauth=false`；本次未验证开启 EasyAuth 后的登录流程。代理保留用户 Cookie，并重写响应 Cookie Path；只转发 YkariEasyPass、YkariUsername、YkariUserID，不转发 Basic Authorization 或管理设置 Cookie。不注入管理员凭据，也没有开放式 CORS。

## 状态与错误处理

- 队列按 `reqorder DESC` 的原 API 顺序渲染，位置使用原 `position`。不在 React 排序、插队或推算新位置。
- 显示原 `display_name`，保密遮罩由后端负责；不根据完整路径在前端重新生成保密曲名。
- 预约收到有效 newid 后显示“已保存”，立即重新查询队列；没有乐观插入假队列项。
- 页面每 5 秒查询队列及播放状态，隐藏页面暂停定时查询，重新显示时刷新。队列和播放状态分别处理错误；刷新失败会提示旧数据。
- 当前原 SSE 前后端默认值不一致，本阶段使用轮询，没有修改旧逻辑。
- 非 JSON 的 PHP Fatal error/认证 HTML 直接呈现为接口失败提示，不渲染服务端 HTML，不伪造空列表或成功状态。
- Vite 仅监听 127.0.0.1:5173；只允许上表路径和对应方法。管理、删除、排序、播放器控制及 Lister rules 等非 songs 模式均不代理。构建预览没有 PHP 代理，正式部署反向代理尚未配置。

## 执行与验证结果

1. `npm.cmd run typecheck`：通过。
2. `npm.cmd run build`：通过，生成独立 `dist/`。依赖安装审计为 0 vulnerabilities；锁文件已生成。
3. 启动 Vite，HTTP 首页、代理队列和播放状态正常。当前播放接口真实返回 `playing:false`。
4. `npm.cmd run test:e2e`：真实本机 Edge，3 passed、1 skipped，无 HTTP mock 或浏览器路由拦截。
   - 代理返回队列与直连 PHP 一致，原 API 的记录顺序/位置保留。
   - `/php/init.php`、`/php/api/player.php`、`/php/api/request_delete.php`、Lister rules 返回 403；预约 GET 和队列 POST 也返回 403。
   - 原首页、搜索、队列仍可访问，管理设置仍返回未认证 401。
   - 390×844 手机视口无横向页面溢出，无 pageerror；真实 Everything 查询返回空结果，Lister HTML Fatal error 显示明确错误。
   - 真实点击 React“提交休息预约” → Vite → 原 exec.php → 返回 newid → 原队列 API 回读记录，kind=小休止、nowplaying=未再生，位置与后端一致。
5. E2E 在 finally 中通过原 PHP 删除接口清理自身测试预约，使用独立 UUID 清理对应历史，确认测试前已有预约 ID 仍存在。删除接口不放入产品代理。自增序号、更新通知计数和测试匿名用户等运行痕迹可能保留，避免整库回滚覆盖并发活动。

浏览器截图在被忽略的 `apps/user-web/test-results/` 中，包括手机页面和提交后的队列截图。`node_modules/`、`dist/`、截图和测试运行产物均未纳入 Git。

**未验证为通过：真实歌曲命中 → 选择文件 → 歌曲预约的完整链路。** 两种曲库当前均不可用，不能把小休止预约或空搜索当作这条链路通过。该链路代码已接入真实接口，并提供 `E2E_SONG_KEYWORD`、`E2E_SEARCH_BACKEND` 可选 E2E；当前明确跳过，未建假歌曲、未改现有库结构或预约规则。

## 下一阶段阻碍

1. 提供真实 Everything 服务或生成有效 YukaLister 曲库，配置容器可访问的路径；当前 capabilities 为 everything_search=false、lister_search=false。
2. 当前 Lister songs 请求返回 HTTP 200 + `no such table: t_found` 的 HTML Fatal error；Everything 上游不可用仍可能返回 ok=true、0 条。需要后续明确修复错误契约，不以空结果掩盖连接故障。
3. 既有 PHP 错误日志未启用；原 SSE 配置默认值不一致仍保留。原播放守护程序还有 locale 与 Windows 组件依赖。
4. 开启认证环境的用户登录、部署后的受限反向代理/静态托管及更完整的分页尚未验证。本阶段不更改原 PHP 权限和身份规则。
5. 外部播放器未接入，PotPlayer 未实现；保存预约不等于实际播放。Windows 执行端、媒体路径映射、播放控制、结束检测和失败回写仍需独立阶段处理。

参考本次采用的官方构建方式：[Vite Getting Started](https://vite.dev/guide/)、[Tailwind Vite 集成](https://tailwindcss.com/docs/installation/using-vite)。

## Phase 2：独立管理端与真实管理操作

日期：2026-10-19（Asia/Tokyo）。本阶段新增 `apps/admin-web/`、`api/admin.php`、`api/_admin_auth.php`，更新本进度文档。没有覆盖 Phase 1 源码或原有未提交修改，没有删除旧页面、迁移 SQLite schema、重建 Docker 或 push。

### 原管理功能与权限审计

| 原入口/业务实现 | 权限与实际行为 | 本阶段迁移 |
| --- | --- | --- |
| `init.php`、`ConfigAuth` | Basic 账号必须为 admin，再校验 configpass；存在 localhost 免检和原 master-password 策略；部分 POST 合并配置，调用 writeconfig2ini | 管理登录；三个设置字段的 JSON 读取/保存；密码策略复用，省略 localhost 免检 |
| `requestlist_swipe.php`、`function_requestlist_json.php` | 队列按 reqorder DESC；管理员是否可见保密曲由服务端 `$user` 决定 | 管理队列读取，服务端在认证后设置真实 admin 身份 |
| `api/request_delete.php`、`delete.php` | 删除、归一化顺序、通知更新；原 JSON 入口仅 EasyAuth，没有 ConfigAuth | 在新管理入口的认证之后 include 原删除 JSON 代码 |
| `api/request_move.php`、`function_requestops.php` | up/down/warikomi；原 JSON 入口仅 EasyAuth，函数自带顺序规则及事务 | 在新管理入口认证后 include 原代码，捕捉原响应；不在前端自行调序 |
| `requestlist_reorder.php` | JSON 全列表顺序提交，未再生记录重排；不是管理员专用验证 | 暂不迁移拖拽/全量重排，优先单条移动 |
| `api/playstatus.php`、`changeplaystatus.php` | 修改队列状态，原 JSON 入口仅 EasyAuth | 尚未迁移，避免把手动标记状态当作实际播放器反馈 |
| `api/player.php`、mpcctrl_func/foobar_func | 原统一 API 多数控制命令未检查函数返回值；部分动作会改 DB | 迁移纯播放器 HTTP 控制子集，直接复用原函数并检查 false；不复制命令发送或预约状态规则 |
| `manage-mpc.php`、autoplayctrl、yklister_exec | CLI 守护、Windows 批处理/进程控制；部分入口具有启动副作用 | 未迁移，不自动启动主机程序 |
| 上传、备份还原、在线更新、背景/主题、房间配置、优先级等 | 文件写入、外部组件或更广配置范围 | 本阶段未迁移，保留原 UI |

**权限范围说明：** 新 admin-web 的所有管理写入统一经新 PHP 入口校验，不能通过移除 Vite 白名单绕过。原版历史路由保留原规则，部分旧写接口仍只有 EasyAuth；本阶段没有声称整个旧应用已完成权限加固，也没有将旧写接口直接代理到 admin-web 或 user-web。全面统一旧入口权限需要后续兼容迁移，避免破坏旧用户页面。

### 服务端认证兼容方案

新 `api/admin.php` 每次请求先读取配置，再调用原 `ConfigAuth::check_configpassword()`，同时要求显式 Basic 账号为 admin。认证通过前不加载队列/设置业务代码。不调用存在 localhost 免检的 `check_auth()`，不接受查询参数中的账号、不接受管理 Cookie 代替管理凭据。

原版当前没有 configpass，`ConfigAuth` 的既有策略是缺失/空密码接受 admin。新管理端保留并醒目提示此真实状态；没有禁用密码校验、植入密码或向前端返回配置密码。若原版设置密码，新入口立即按新密码校验。隔离测试使用原认证函数和内存密码证明错误密码在 localhost 下也被拒绝；不将当前空密码环境的测试冒称为真实强密码环境测试。原 master-password 行为也未更改。

所有请求需 `X-Yukari-Admin: 1`；写操作只接受 POST form-urlencoded。携带 Origin 时必须和当前请求 Host 一致；不配置开放 CORS。Basic Header 手动由 React 内存凭据生成，不进行浏览器 Basic challenge，不将凭据存入 URL、localStorage 或网络 trace。若原 EasyAuth 开启，还要通过原 `check_auth()` 校验访问口令；可在登录表单提供原口令。当前未在实际启用 EasyAuth 的配置下验证，以免影响用户现有设置。

Apache 对空 Basic 密码可能不提供 `PHP_AUTH_PW`，新入口将“已有 Basic 用户、未提供密码字段”按空密码交由原密码策略校验，而非直接免检。配置非空密码时仍拒绝空密码。

### 新 JSON 入口契约

浏览器 URL `/php/api/admin.php?operation=...`，Vite 5174 去掉 `/php` 后转发原 Docker。直连 PHP 使用 `/api/admin.php?operation=...`。所有操作均要求上述管理认证和请求标记。成功 `{ok:true,data:...}`，失败非 2xx + `{ok:false,error}`。

| operation | Method / 参数 | 业务复用和响应 |
| --- | --- | --- |
| session | GET | 原 ConfigAuth，返回 username、password_configured，不返回密码 |
| queue | GET | include 原 api/requests.php，完整队列和服务端顺序/状态 |
| delete | POST，id | include 原 api/request_delete.php，原删除、归一化、通知逻辑 |
| move | POST，id、action=up/down/warikomi | include 原 api/request_move.php，复用 dbup/dbdown/warikomi |
| status | GET | 原 build_playingstatus_data/getcurrentplayer，另有 PHP/OS、固定 MPC/foobar 地址的只读探测；探测不可达不影响队列管理 |
| settings | GET | 只返回 playmode、startvolume、requestlistactivereload 和文件 SHA256 revision；不暴露账号、路径或命令配置 |
| settings-save | POST，上述三项值及 revision | 值范围为 1–5、0–100、0/1；过期 revision 409，无变化不写；合并原始配置后调用原 writeconfig2ini，再回读校验。该原函数也会更新 ini.ini/弹幕房间配置 |
| player | POST，player=mpc/foobar、action=play/pause/playpause/stop | 调用原 command_mpc 或 foobar_song_play/pause。foobar 的独立 pause/stop 返回 501；连接失败 502。响应成功仅表示接口应答，不代表实际播放 |

控制子集没有使用原 `api/player.php` 中可能忽略返回值的成功包装，也没有实现新的播放协议。未接 PotPlayer。未开放任意 command、任意 URL、可执行路径、上传、整库清空或批处理启动。

### UI 与目录

`apps/admin-web/src/features/{auth,queue,system,settings}`，统一技术栈 React 19.3.1 / TypeScript 7.0.2 / Vite 8.3.4 / Tailwind 4.3.3，精确依赖与锁文件。独立侧栏/手机导航、登录和退出、删除确认、操作失败提示、重新查询队列、设置版本冲突处理。源数据不使用 mock。

两个应用暂不提取共享包：普通用户 API 不应继承管理凭据，管理请求又有独立错误、认证和写入规则。各自的 `src/lib` 是轻量 API 边界，后续统一 api-server 时可迁移契约；本阶段未新建空服务或为共享而增加运行时依赖。原用户代理未扩大权限。

### 验证结果

- PHP `api/admin.php`、`api/_admin_auth.php` 语法检查通过。
- 容器内 `apps/admin-web/tests/php/admin-auth-check.php`：正确凭据、错误密码、普通账号、缺密码、缺账号五项通过。只用内存配置，没有更改实际密码。
- admin-web typecheck、build 通过；真实 PHP + Edge E2E 三项通过。
- 直接请求 PHP 绕过 Vite，验证所有新读写操作无管理凭据均返回 401；普通账号、只有旧管理 Cookie 被拒绝。认证后缺请求标记/跨站请求返回 403；写操作 GET 返回 405。
- user-web 即使附带有效管理凭据，也无法代理新管理路径（403）。admin-web 只代理新认证入口，不能直接代理旧删除路径。
- 已认证队列读取、状态读取、设置读取通过；原始配置 SHA256 在无变化保存和过期版本拒绝后保持相同，没有为测试改动配置。
- 浏览器真实登录后，创建两条独立 UUID/专用歌手的小休止预约，只在它们相邻时调整它们的顺序，再通过管理 UI 删除，最终清理全部测试预约和对应历史；原队列记录完整比较保持相同。拒绝路径使用不存在 ID，即使权限代码回归也不会删原用户记录。
- 测试在活动播放器或非连续现有 reqorder 时会跳过写入部分，避免干扰现场；本次条件允许，实际执行通过，没有 skip。
- 浏览器在 390×844 下无横向溢出、无 pageerror。访问系统页点击播放，当前 MPC 不可达，界面显示明确失败而非成功；没有启动外部播放器。
- user-web 回归：typecheck/build 通过，原三项 E2E 通过，歌曲命中测试仍因没有真实曲库明确跳过。原首页/搜索/队列 HTTP 访问保持正常，管理页保持原认证，Docker 保持 healthy。

测试预约、对应历史已清理；自增序号、通知计数和专用匿名用户等运行痕迹可能保留，不回滚整个数据库覆盖其他活动。截图保存在被忽略的 admin-web/test-results；不保存含认证信息的 trace。

### 未迁移与下一阶段

1. 继续按页面迁移保密/升降调等预约详情、批量重排和更完整的现有管理设置；优先共享原业务函数，不重写预约规则。
2. 设置真实变更的保存路径已实现，但本次只验证无变化保存、输入/版本边界；未为了测试改动现场配置。真实设置变更及原配置写入函数的 ini.ini 副作用需在隔离运行配置下进一步验证。
3. 可达播放器的控制结果、真实播放反馈和启用 EasyAuth 的双重认证尚未实测；当前验证的是不可达时如实返回失败。默认播放器地址仍是原代码的容器 localhost，未改成 Windows 主机地址。
4. 历史 PHP 写入口的统一权限加固、配置保存的原子性/跨旧入口并发，以及正式 HTTPS/同源代理部署是后续兼容工作；新管理入口不把 Vite 白名单当作认证。
5. 原版当前未设管理密码，属于真实权限配置限制，需在原设置中配置。本阶段没有自动设置密码或改变旧密码策略。
6. Everything/YukaLister 继续复用，曲库不可用不阻碍管理端迁移；不重写搜索、不修数据库。暂不创建 api-server、不引入新业务后端、不接 PotPlayer。

## Phase 3：统一 Node API 边界（已实现）

日期：2026-10-19（Asia/Tokyo）。新增 `apps/api-server`，采用 Fastify 5.12.7 + TypeScript 7.0.2 + Zod 4.6.7，Node 24。Fastify 提供小型 HTTP 服务、生命周期和错误处理；Zod 校验入站参数与关键 Legacy 响应，没有引入 ORM、DI 容器或新的预约业务层。

### 本阶段审计结论与职责

| 领域 | Node 当前负责 | PHP 继续独占 |
| --- | --- | --- |
| 会话/权限 | 会话生成、有效期、角色校验、退出撤销、登录限速、Origin/CSRF 检查 | 原 ConfigAuth/EasyAuth 实际密码验证、认证配置版本证明 |
| 队列/播放/能力 | 统一只读路由、Legacy 调用、Zod 响应校验 | 原队列组装、保密遮罩、播放状态/元数据、能力探测 |
| 搜索 | 选择固定 Legacy 搜索入口、参数校验、错误规范化；Everything 不可达明确 503 | Everything/YukaLister 检索、排序、年龄过滤等全部规则 |
| 预约 | 严格白名单输入、单次转发、201 与 id 契约 | exec.php 的 INSERT/事务、reqorder、自动排序、历史、更新通知 |
| 删除/调序 | 管理会话检查、路径参数与操作校验、单次转发 | 原 request_delete/request_move 和 dbup/dbdown/warikomi |
| 设置 | 管理鉴权、输入校验、统一版本冲突错误 | 原设置适配器和 writeconfig2ini 的配置/ini.ini 写入 |
| 播放器 | 管理鉴权、控制子集校验、保留错误 | 原 MPC/foobar 控制函数及实际应答判断 |

没有 Node SQLite 驱动，没有把数据库挂载给 Node，也没有直接读取 SQLite。旧 GET 路径的初始化/补元数据可能隐含写入，因此本阶段全部通过 PHP，避免引入 WAL、只读快照和锁一致性问题。PHP 仍是唯一数据写入方；Node 不镜像预约、不开第二事务、不自动重试写操作。

### 统一接口与契约

所有新前端请求统一前缀 `/api/v1`；共享类型、错误类及浏览器请求函数在 `packages/contracts/src/index.ts`。生产依赖不包含测试凭据工具；`packages/test-support` 只供真实测试复用。

| 路由 | Method / 输入 | 会话 |
| --- | --- | --- |
| /user/session | POST，`{easypass?}` | 验证原访问口令（若启用）并创建普通会话 |
| /admin/session | POST，`{username:'admin',password:非空,easyPass?}` | 验证原非空管理密码，创建管理会话 |
| /admin/session | GET / DELETE | 验证 / 撤销当前管理会话 |
| /capabilities、/queue、/playback | GET | user |
| /search | GET，backend=everything/lister、keyword | user |
| /requests | POST，filename/fullpath/singer/comment/kind，secret 可选 | user |
| /admin/queue、/admin/status | GET | admin |
| /admin/requests/:id | DELETE | admin |
| /admin/requests/:id/move | POST，action=up/down/warikomi | admin |
| /settings | GET / PUT（原三个字段 + revision） | admin |
| /playback/control | POST，player/action | admin |

成功统一 `{ok:true,data}`；失败统一 `{ok:false,error:{code,message,requestId?,legacyStatus?,legacyReason?}}`。预约返回 `201` 与 `data.id`。旧非 2xx、HTML、空响应及不符合字段契约均作为错误处理，保留原原因；不将缺库错误包装成空数组。实际只读和写入入口由 Adapter 固定，客户端不能指定任意 PHP URL、命令或待 include 文件。

### 认证语义变化与信任边界（经用户确认）

用户选择沿用原 PHP 管理密码，并自行在原设置中保存了非空密码。初次确认时配置尚未实际保存，新 API 返回 503；再次保存后实际登录验证通过。代理没有替用户设置、重置或把密码复制到新配置文件。

新 API 明确拒绝原配置缺失、空字符串和 PHP 原策略视为空值的 `0`；不因 localhost 放行。密码仅在登录请求中短暂传递给原验证函数，不使用 Basic、不进入日志、会话、localStorage 或新的持久化存储。原 ConfigAuth 的其余验证规则（含历史 master-password）仍由 PHP 拥有，未在 Node 重写；若要废除这些旧规则需单独迁移决定。

Node 只保存随机 token 的哈希、角色、UUID、有效期和 HMAC 配置绑定证明。浏览器使用 HttpOnly、SameSite=Strict、Path=/api/v1 Cookie。管理会话一小时、普通会话十二小时，退出删除服务端 token，Node 重启清空会话。证明绑定管理密码、UUID 及访问口令策略；PHP 每次管理操作重新计算比较，密码或策略变化拒绝旧会话。Node 未缓存密码以便后续 Basic 转发。

内部 `api/node_bridge.php` 必须验证 Compose 私有 volume 中的随机服务凭据，再检查角色及配置证明；未经校验的 HTTP 角色头不能设置 PHP 的 `YUKARI_NODE_VERIFIED` 常量。`api/admin.php` 和 `_common.php` 只对这个受信 PHP include 上下文接受已验证身份。原浏览器 Basic/旧 Cookie 不透传，不能靠把 `admin` 名称或角色头传给 PHP 获得权限。

每个用户的 Legacy User-Agent 使用 Node 分配的独立 UUID，PHP Cookie 也只使用该 UUID，防止多个用户经同一 Node IP 导致保密预约 owner 判定串号。用户端路由始终使用 user 会话，不因浏览器同时拥有管理 Cookie 就提升角色。管理路由检查 admin 会话，并拒绝 user-web Origin；两端 Vite 仅作为额外路径过滤。

写入要求 JSON 和 `X-Yukari-Client: 1`；检查 Origin，不配置开放 CORS。登录请求有限速。测试 trace 关闭，服务端关闭请求/body 日志，Bridge 凭据和证明不返回浏览器。当前是本机 HTTP 开发模式，正式环境需 HTTPS/Secure Cookie；单实例内存会话不适合直接横向扩展。

### Docker 与目录

一键启动：仓库根目录 `docker compose -f docker/compose.yaml up --build -d`。Compose 包含一次性 Bridge 凭据初始化、原 PHP 和 Node API。凭据 volume 只被这两个后端只读挂载；Node 容器以 node 用户运行，没有数据库挂载。

- user-web：http://127.0.0.1:5173/（独立 Vite）
- admin-web：http://127.0.0.1:5174/（独立 Vite）
- Node：http://127.0.0.1:3000/health
- 原 PHP：http://127.0.0.1:8080/

PHP 与 API 只发布到 127.0.0.1，避免把历史弱权限写入口暴露给非可信网络。Apache 禁止直接下载 INI、数据库、开发源目录，旧 PHP 页面仍可访问。没有执行删除数据库、清卷或 push。原工作区已有修改以及用户本次保存的非空管理密码均保留，未替用户重置凭据。

新增核心文件：`apps/api-server/src/{app,legacy,sessions,errors,main}.ts`、`api/node_bridge.php`、`api/_node_auth.php`、共享契约/测试工具、Node Dockerfile、Bridge 初始化脚本及 Apache 私有文件规则。修改两端 API Client/Vite/E2E 以及 PHP 的最小受信入口检查，业务规则仍在旧函数中。

### 验证结果

- 三个项目 typecheck/build 全部通过；Compose 实际构建启动成功，PHP 和 Node 均 healthy。
- API Server 真实集成测试：3 项通过，0 跳过。覆盖非空原密码认证、空密码拒绝、未登录/普通用户越权拒绝、Basic 拒绝、跨站和缺请求标记拒绝、Bridge 伪造拒绝、无效 JSON 400、退出撤销、只读接口及原错误原因。
- PHP 内存认证不变量测试：13 项通过，覆盖缺失/空/0 密码拒绝、正确/错误身份、localhost 不免检、密码/UUID/访问策略改变时证明失效。未改真实配置来测试撤销。
- 实际预约测试：每个 Node POST 仅新增一条原 PHP 记录；使用原合法的小休止/保密选项验证会话隔离，陌生会话看不到真实标题，伪造旧 Cookie/角色头不能解除遮罩；管理调序与删除结果由服务端回读确认。
- user-web 完整真实 Edge E2E：3 通过、1 跳过（真实曲库命中），预约链为 React → Node → PHP → Node 队列回读。
- admin-web 完整真实 Edge E2E：3 全部通过，覆盖 UI 登录、专用测试记录调序/删除、设置无变化保存、播放器不可达提示和退出后的 401。
- 写测试先检查无活动播放器、原顺序连续；只在相邻测试记录间移动，最后删除测试预约/历史，并比较完整原队列相同。计数/自增序号及专用匿名用户可能保留，不整库回滚并发数据。
- 设置无变化保存及过期 revision 409 的最终测试确认 config.ini SHA256 不变。联调初次发现 Phase 2 布尔值比较问题，曾误触发原序列化重写；已按读取时的有效整数统一比较和回读校验，没有人为改设置值，修复后不再重写无变化配置。

### 保留的问题与后续迁移

1. 原曲库仍不可用；新 API 保留错误并不阻塞本阶段。原 exec.php 可能先提交预约，再因附加曲库元数据查询失败；本次确认了这种“可能已入库但返回错误”的旧行为。Node 提示结果未知、不重试、不补写。后续需单独处理 Legacy 部分提交和跨请求幂等性，不借本阶段修库或重写业务。
2. 真实媒体播放、可达播放器执行结果、实际设置值变化保存及启用 EasyAuth 的现场双重认证尚未完整实测；没有为验收更改曲库、播放器、实际设置或 SQLite schema。
3. 历史 PHP 路由保留原访问规则，只限制在本机；新 Node 权限边界不能被解释为所有旧路由都已统一加固。后续按兼容策略逐步收敛旧写入口。
4. 生产 HTTPS、持久共享会话、跨实例限速、原配置写入原子性和 Legacy 错误事务边界仍待独立阶段。当前 Node 会话重启失效是明确的开发期行为。
5. 后续先迁移更多只读契约和管理详情，再评估可安全迁移的业务模块；预约/调序/设置写入仍由 PHP 独占。未实现新搜索引擎、Laravel、PotPlayer 或第二套数据库。

框架依据：[Fastify 官方验证文档](https://fastify.dev/docs/latest/Reference/Validation-and-Serialization/)、[Zod 官方文档](https://zod.dev/)。运行、领域路由和认证细节另见 [API Server README](../apps/api-server/README.md)。
