# 渐进式重构进度

当前阶段：Phase 6 已将普通/管理预约队列读取迁到 Node-native SQLite，并让 Legacy swipe 队列页通过受限签名票据复用新读取。GET settings 仍为 Node-native；预约、调序、删除和设置保存继续 PHP 单写。目录、权限与验证以 Phase 6 及兼容性矩阵为准，Phase 1～5 为历史记录。

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


## Phase 4：Legacy 目录整理与有限兼容适配

日期：2026-10-20（Asia/Tokyo）。本阶段在 develop 直接执行源码移动、Docker 重建、真实 HTTP 及 Edge 回归。完整入口契约、权限、副作用及路径审计见 [LEGACY_COMPATIBILITY.md](LEGACY_COMPATIBILITY.md)。没有 commit/push，没有操作 master/refactor/web。

### 目录与数据保留

原 PHP 页面、API、旧 JS/CSS、字体图片、PHP modules、CMS、v2、播放器附属文件及打包脚本共 652 个已跟踪文件通过 `git mv` 迁到 `legacy/php/`。apps、packages、docs、docker、项目级 Git 配置及项目说明留在根目录。迁移前唯一未提交改动为 ini.ini，迁移后原内容仍为未暂存的运行修改。

停止 PHP/Node 后将本机配置、SQLite、缓存和日志随应用原样移动；661 个文件迁移前后逐一校验 SHA256 一致，未清卷、重建库或变更密码。测试结束后再次确认 config.ini、原 ini.ini、listerdb_config.ini 字节未变。忽略规则已覆盖新位置；git mv 暂存区仅含 R100 重命名，没有暂存真实 config.ini、数据库、日志或 Bridge 凭据。根目录异常 NUL 未动，两个原空曲库文件保留而未尝试修复。

Compose 将 `legacy/php/` 读写挂载到原 Apache DocumentRoot `/var/www/html`，仓库额外只读挂载到非公开 `/workspace` 供 PHP CLI 测试。原 `/search.php`、`/exec.php`、`/api/...` 无前缀变化，Bridge 固定 URL 不变，Node 没有数据库挂载。__DIR__/chdir/相对 include 与库文件的目录关系保留；TS/PHP 测试更新配置和认证源码路径，Inno Setup 的项目说明/许可证引用更新为上层路径。

旧 Git/ZIP 更新器假定单体工作区，可能覆盖新目录或 reset；在 monorepo 下明确拒绝更新、Git 初始化及 GC，显示部署说明。没有执行任何更新/恢复。旧 Windows BAT、XAMPP/nginx、绝对媒体路径依赖仍保留，未宣称 Linux Docker 可执行这些功能。

### 实际 Owner 与适配范围

| 模块 | 实际 Owner | 旧页状态 |
| --- | --- | --- |
| 健康 `/api/v1/meta/health` | Node-native，无 PHP 调用/用户数据/写入 | 已通过旧页 JS 同源请求，显示连接或不可达 |
| 会话生成、存储、角色/CSRF 校验、撤销 | Node-native；原密码/EasyAuth 验证仍由 PHP | 旧 Basic/EasyAuth 保持独立，未自动映射 Node 登录 |
| 搜索、预约、队列、删除、调序 | PHP 独占，Node 仅统一边界 | 旧 UI 仍直连原 PHP；没有 PHP → Node → PHP |
| 设置、播放器、元数据、用户历史/收藏、备份、导入导出等 | PHP | 保留，未改业务规则；未接 PotPlayer |

**Node-native 领域业务覆盖仍为 0**。React 已使用统一 API 不代表 PHP 业务已经迁移。当前没有适合无损切换的 Node-native 领域业务，因此仅接入真实原生健康状态，没有伪造业务迁移进度。

Apache 仅代理精确健康路径到固定 api-server，连接/总超时为 2/5 秒；剥离旧 Basic/Cookie，其他 `/api/v1` 在旧端口返回 403。旧 JS 请求 credentials:omit，不创建或复用 Node 身份。Fastify admin Origin 白名单不扩宽、管理会话和 Bridge 证明校验不变。INI、数据库及 WAL/SHM/journal、日志、PPK/PEM/KEY 下载禁止。

### 验证结果

- API Server、user-web、admin-web 的 typecheck/build 通过，Compose 实际重建启动成功，两个后端健康。
- PHP 300 文件全量语法通过；修复原 file_uploader.php 的 `<? php` 拼写错误。13 项 Node 证明/认证不变量与 5 项旧管理认证检查通过，均为内存测试。
- API 真实集成 4 项通过：原 URL、健康新旧响应一致、代理非白名单拒绝、私有文件拒绝、Node 管理认证/CSRF/角色伪造拒绝、原 Basic 管理队列读取、无双写及队列清理后完全一致；无变化设置保存不重写配置。
- user-web 真实 Edge 5 通过、1 跳过：新增旧页 JS/CSS/字体等本地资源无失败、无浏览器脚本错误；实际健康请求成功；断线提示测试只中止网络、不伪造成功。原 React 预约链仍到达 Node/PHP，最后清理测试记录。
- admin-web 真实 Edge 3 通过：UI 登录、测试队列调序/删除、设置无变化保存、播放器不可达及退出权限回归。
- 原 init.php 已登录 GET 本身可能调用旧配置序列化器，故不为了“只读验收”访问它而改写用户配置；使用原 admin.php 的 Basic 认证只读队列验证旧管理链。

访问地址保持：用户端 5173、管理端 5174、Node 3000、旧 PHP 8080，均为 127.0.0.1。启动命令与测试命令见兼容性文档及各应用 README。

### 保留问题与下一阶段

真实歌曲命中、实际播放、Windows 安装器、OAuth/Drive/DDNS、备份恢复、实际设置值变更未实测。原库缺表、预约可能先提交再在附加元数据查询失败、旧 SSE 配置不一致等历史问题不借本阶段改写。旧 PHP 历史宽松权限仍仅本机暴露；健康适配不等于已加固所有旧写入口。

历史已跟踪的 INI 与 pfwd 附带 PPK 保持原内容；HTTP 已禁止私钥下载，但历史密钥用途/轮换需要另行确认，不删除历史或擅自重置。后续先选择真正独立的只读领域模块及新旧行为对照，再讨论数据 Owner 迁移；预约、删除、调序和设置继续单写 PHP。生产 HTTPS、共享会话、幂等/部分提交和旧写入口收敛仍为后续工作。


## Phase 5：首项 Node-native 设置读取与 AGENTS.md

日期：2026-10-20（Asia/Tokyo）。保留全部 Phase 4 暂存/未暂存内容，在 develop 增量实现；没有 commit/push、重置、修改实际密码或真实 schema。新增根目录 [AGENTS.md](../AGENTS.md) 约束 TypeScript 优先、单一写 Owner、契约/权限、测试、秘密文件和 upstream 对照，链接详细文档而不复制报告。

### 审计选择与实现

队列有 owner 保密和多 SQL 顺序，状态有 Windows/player 依赖。原管理 settings GET 会经过公共启动器 initdb/updatedb，不能直接当作无副作用读取。选择只迁移统一 API 的三个设置读取，保持 `/api/v1/settings` 契约、默认值、范围、revision 和 React 调用地址不变。

新增 `apps/api-server/src/settings.ts`：SettingsRepository 只读现有配置单文件，SettingsService 独立执行 INI 白名单投影、PHP 常见标量转换与 Zod 输出校验。GET 不调用 admin-settings、不 include 原 PHP 业务；没有 SQLite 依赖、WAL 或数据库 mount。原 PHP session 在加载 commonfunc 前返回当前 config_revision，Node 前后验证管理证明和版本，维持密码/策略变更后的撤销语义。

| 范围 | 当前 Owner |
| --- | --- |
| GET /api/v1/settings（三项读取） | **Node-native**；17 组隔离输入与原 PHP 投影对照 |
| PUT /api/v1/settings | **PHP 唯一写入方**；原 writer、revision 冲突与 serializer 不变 |
| 会话/授权 | Node 会话，PHP 验证原凭据/证明；没有重写认证模型 |
| 队列/搜索/预约/删除/调序/播放器/其他设置 | PHP 原业务，Node 仅边界 |

按当前 7 类领域 GET 路由计数，1/7（约 14.3%）Node-native；排除 health/会话，不代表整个应用业务迁移比例。五类业务写路由仍 0/5 Node-native。详细分母、接口、副作用和限制见 [兼容性矩阵](LEGACY_COMPATIBILITY.md#phase-5node-native-管理设置读取)。

管理端现有 GET 自动进入新实现，真实 Edge 验证 node-settings-read 响应标记；保存仍经 PHP。user-web 不应访问管理设置，Vite/服务端拒绝保持。旧 PHP 设置页面不切换：Basic/EasyAuth 与 Node 身份独立，不新增旧页登录映射或 8080 admin Origin；旧端口只代理公开健康状态，无 PHP→Node→PHP 回环。

### 测试结果

- 三个应用 typecheck/build 通过，Compose 实际重建启动并 healthy。
- Legacy PHP 全量 300 文件语法通过；13 项 Node 证明/认证不变量 + 5 项旧管理认证检查通过；新增 CLI oracle 语法通过。
- API 测试 8 项全部通过（原有 4 + 设置专项 4）。17 组隔离配置覆盖默认/空值/布尔/引用数值/CRLF/注释/重复项/章节/字段顺序/范围错误；新增不支持语法拒绝。PHP oracle 执行原源码投影、不手写参考逻辑、不加载数据库；真实配置快照只经 stdin 处理，输出不含秘密。
- 隔离授权门不提供 PHP 设置业务仍能读取真实测试文件，且只调用 admin-auth/admin-session；验证撤销、前后版本变化、文件缺失、版本不匹配、白名单不泄露秘密和不写文件。授权替身仅用于隔离测试，真实 API/Edge 仍使用原 PHP 登录。
- user-web Edge 5 通过、1 跳过（曲库命中未配置）；admin-web Edge 3 通过，覆盖真实登录、Node-native GET、PHP 无变化保存、测试预约调序/删除、播放器失败及退出。
- 写测试清理后原队列相同，config.ini 和原用户 ini.ini 内容保持；没有重建或回滚真实数据库。

### 安全与兼容边界

Node 新增对完整现有 config.ini 的只读单文件权限，用于精确 revision；原始 Buffer 仅请求内处理，不解析/记录其他秘密，不复制到新配置或镜像。该路径不得静态暴露。常规 serializer 单行标量等价；目标数组、常量、环境插值、特殊转义/多行等明确 503，不回退 PHP 或伪装成功。

原 PHP writer 没有锁/原子性。版本前后检查可拒绝观察到的并发变化和单文件 bind 失效，但不能消除两次都读到同一暂停写入中间态的窗口；原子配置发布留待后续。手工重命名替换 config.ini 后需重建 api-server 挂载（会话随重启失效）。全新无 config.ini 工作区先启动 web、经原设置保存配置，再完整 Compose 启动；已有当前配置仍一条命令启动。未自动创建配置或更改密码。

访问保持：http://127.0.0.1:5173/（用户）、5174（管理）、3000/health（Node）、8080（Legacy）。下一阶段先处理配置原子发布/只读快照边界，再评估新的只读模块；搜索算法、真实曲库修复、PotPlayer、数据库 schema 和写业务迁移均未实施。


## Phase 6：Node-native 队列读取与 Legacy 实际接入

日期：2026-10-20（Asia/Tokyo）。已完成实际部署和真实回归，没有 commit/push。原工作区和暂存区保留；没有新建第二套生产队列、改变实际密码或迁移 Schema。

### Node-native 与业务 Owner

新增 QueueRepository/QueueService，直接查询原 SQLite；Node 24 内置 SQLite readOnly、query_only、250ms 锁超时，统计与全量排序记录在同一个 BEGIN/COMMIT 快照中读取，每次关闭连接、不缓存队列。PHP Bridge 的 queue-context 只验证当前原会话证明并提供路径/保密文案/真实身份上下文，不加载 commonfunc、不执行队列 SQL。

保持 reqorder DESC、position、limit=0 的历史 offset 行为、未再生/1 统计和 PHP empty('0') 回退。所有者判定完整保留 IP+UA，以及反转全量 DESC 队列后最早匹配身份的 singer 同名规则；不错误地从 UUID Cookie 或最近一首推断。保密数据差异在服务端生成。新 React API 保持原八字段契约，Legacy 专用契约补充在 packages/contracts。

| 模块 | 当前 Owner |
| --- | --- |
| GET /api/v1/queue、/api/v1/admin/queue | **Node-native**；PHP 仅授权/配置上下文 |
| GET /api/v1/legacy/queue | **Node-native**；仅短时签名队列票据，返回旧 UI 需要的完整字段 |
| GET /api/v1/settings | Node-native，保持 Phase 5 范围 |
| 预约、删除、调序、设置保存、播放控制 | **PHP 唯一写入方**；无双写 |
| 原 initdb/updatedb、元数据补写、WAL/SHM 生命周期 | PHP 生命周期/写链；Node GET 不暗中初始化或修复 |

既有 7 类领域 GET 中 3/7（约 42.9%）Node-native；分母仍为 capabilities、queue、playback、search、admin/queue、admin/status、settings，Legacy 兼容路由不重复计数。业务写路由仍 0/5 Native，不代表整个应用迁移比例。

### 经批准的数据库目录与 WAL

整 legacy/php 挂载曾被自动审批拒绝，因为含无关配置和私钥；没有执行或绕过。用户随后明确批准停服迁移原数据库及旁文件，并只调整真实 config.ini 的 dbname 路径。实际移动 1 个数据库文件至 legacy/php/runtime/queue/request.db（停服后没有遗留旁文件），移动前后 SHA256 一致；除 dbname 外每个配置字节不变。没有复制生产数据库。仅本机 .local 保存哈希清单，不含原配置内容。

Node 仅只读挂载专用 runtime/queue，保留 Phase 5 已有配置单文件与私有 Bridge volume，没有整 Legacy 目录或私钥挂载。路径 realpath 验证禁止逃逸，Apache 禁止 HTTP 访问整个 runtime 目录及 DB/WAL/SHM 文件。新的空 Docker 环境才使用专用目录默认值；有旧 request.db 时保留原路径，启动脚本不会擅自搬库。非 Docker Legacy 默认仍是 request.db。备份路径按原编码约定解码，避免子目录路径经设置页编码后无法识别。

现场确认原库已是 WAL。短 PHP 连接结束后会删除旁文件，Node 只读目录无法重新创建，初次联通因此正确失败 503。新增 docker/queue-wal-anchor.php：由 PHP 容器以 www-data 维持 mode=rw（不创建 DB）的已有库连接，只访问 sqlite_schema，不改 Schema/业务数据/journal mode，不持有长期事务或阻碍 checkpoint。SQLite 在 PHP 写挂载上维护 WAL/SHM；Node 不使用 immutable、不忽略 WAL、不复制活跃 DB，也不向只读目录写文件。连接不可用时读取明确失败，不假空成功。

### Legacy 逐步切换与权限

requestlist_swipe.php（首页队列目标页）在 YUKARI_NODE_QUEUE=1 下以 JS 调用统一只读 API，所有五处列表加载/刷新均切换。旧预约/删除/排序/评论等写操作仍走原 PHP。其他旧 JSON/XML 页面保留为兼容/行为参考，未全量替换。

PHP queue_ticket.php 在同源 JSON/请求标记、Origin/Host 范围内验证原 EasyAuth，管理员必须校验真实非空 Basic 密码，没有名称、角色头或 localhost 免检。签发 30 秒 HMAC、用途/角色/IP/UA/当前配置策略绑定票据，只放在请求内存和自定义头。Node 验签、到期和 UA，再经受信 PHP Bridge 校验当前策略，随后独立读取 SQLite。票据不生成 Node admin Cookie，也不能调用管理写 API。

Apache 只代理精确 health/legacy-queue，清除 Authorization/Cookie，JS 对 Node 使用 credentials:omit。只对专用 Legacy 读取路由配置旧页 Origin，普通管理 Origin 不扩宽。无 PHP → Node 服务端队列调用，无 Node → PHP 队列 SQL → Node 回环。失败明确显示旧页队列错误，不静默绕回 PHP；未开标志的独立 Legacy 部署沿用原读取。

### 验证结果

- 三个应用 typecheck/build 全通过；Compose 实际重建启动，PHP/Node healthy，专用数据库 mount 为只读。
- Legacy PHP 303 文件语法通过，13+5 项原认证检查通过，WAL helper PHP 语法通过。
- API 14 项通过：真实 PHP builder/helpers 的隔离内存库对照、空队列/排序/分页/同名 owner/管理员/秘密遮罩/异常标量，WAL 提交与未提交可见性，worker 并发快照和独占锁超时，缺失/坏库/缺表/越界/BLOB 失败关闭。隔离授权门不提供 PHP 队列业务仍能完成 Native 查询。
- 真实票据测试覆盖 PHP 签发 → Node 读取，错误 Basic、角色头伪造、跨站、缺标记、UA 错误、过期/用途/签名篡改、配置策略撤销。实际敏感文件及 runtime HTTP 路径为 403。
- user-web Edge **6 通过、1 跳过**（真实曲库命中未配置）；新增旧浏览器原 PHP 预约 → Native SQLite 即时显示，本人 songfile 不遮罩、不同 UA 陌生浏览器遮罩元数据，旧页没有调用原 swipe_json。
- admin-web Edge **3 通过**：管理登录、PHP 调序/删除 → Node 回读、设置无变化保存、播放器不可达与退出。
- 首次 WAL 故障留下两条专用测试记录，已经原 PHP 管理 API 精确清理；测试清理改为已知 ID 删除，不依赖成功的队列 GET。最终原队列回到唯一原记录 id=3、reqorder=1；历史仅清理本轮测试身份，不整库回滚。计数/匿名用户与自增序号遵循既有测试策略可能保留。

### 运行与保留限制

访问：用户端 http://127.0.0.1:5173/，管理端 5174，Node 3000/health，Legacy 8080/requestlist_swipe.php。已有工作区仍 docker compose -f docker/compose.yaml up --build -d 一键启动。新安装先 web 保存配置，再完整启动；已有旧路径数据必须经确认迁移，不能清库或创建替代队列。

SQLite 同步短事务未做大型队列压测。队列 Native 不负责 Schema/元数据准备，缺表应由既有 PHP 生命周期明确处理，不能在 Node 自动迁移真实库。PHP 旧构建器多次查询的并发非一致窗口改为 Node 单快照，这是明确改进；重复 reqorder 仍不发明新顺序。Legacy IP+UA/同名规则的既有限制保留。WAL anchor 是旁文件可用性依赖；若被终止且旁文件清除，队列 503，进程 health 不等同业务 readiness。未扩展 config.ini 原子性研究，未改搜索、播放器、真实数据库模型或写入规则。


## Phase 7：Node-native 管理删除与调序

日期：2026-10-20（Asia/Tokyo）。在 develop 增量实施；原 652 项暂存重命名和既有未提交内容保留，没有 commit/push、重置、清卷或真实 Schema/密码变更。详细规则、旧入口关闭范围及可复现测试命令见 [Phase 7 兼容矩阵](LEGACY_COMPATIBILITY.md#phase-7管理员队列写入-owner-切换)。

### 实现与单一 Owner

新增 `apps/api-server/src/queue-mutations.ts` 的 QueueMutationRepository/Service。DELETE `/api/v1/admin/requests/:id` 与 POST `.../:id/move` 不再调用 PHP admin-delete/admin-move：Node 直接对原专用 SQLite 执行存在性检查、删除或 up/down/warikomi、reqorder 归一化。整个操作使用 BEGIN IMMEDIATE/COMMIT、1 秒 busy_timeout、失败回滚、每次关闭连接，无 ORM、第二套生产队列或自动重试。接口、React 操作和原保密读取保持兼容，响应标记 node-queue-mutation。

保留原邻居查询、9999 临时交换值及其碰撞行为、normalize 的 reqorder ASC/id ASC、插队扫描的实际播放标记规则，不把 `1` 擅自当作 `未再生`。明确差异：原多个独立提交窗口改为单事务；异常数据若使插队状态循环，Node 409 回滚而非无限运行。缺失目标 404、不通知；非法输入 400。队列删除不删除历史、不控制播放器。

| 模块 | 当前 Owner |
| --- | --- |
| 管理删除、单项上下移/插队、其事务内归一化 | **Node-native** |
| 用户/管理/Legacy 队列读取、三个设置读取 | Node-native，保持 Phase 5/6 范围 |
| 更新通知计数、SSE | **PHP 独立通知 helper 复用**；不加载 commonfunc 或执行队列 SQL |
| 创建/替换、自动轮换、元数据/历史、播放标记/生命周期 | PHP，创建事务仍可调整 reqorder；不是第二个管理员调序 Owner |
| 设置保存、播放控制、搜索 | PHP |

五类领域写路由中 2/5 的主队列事务 Native，读仍为 3/7；不代表全应用迁移率，也不声称通知和全部 SQLite 写入已迁出 PHP。管理会话/角色、Origin/CSRF、配置撤销证明检查不变。Node 仅获得 runtime/queue 的 RW 目录，共享 gid 33、setgid 目录与组写权限；配置仍只读，不挂载通知 DB 或整个 Legacy。

### 通知与 Legacy 边界

Node 成功提交后通过已认证 queue-notify Bridge 单次调用原 UpdateNotice，保留计数阈值和 SSE 行为，无队列 SQL 回环。通知本来位于提交后且吞错；现失败显式返回 QUEUE_COMMITTED_NOTICE_FAILED，提示队列已提交、不要重试。若连 ROLLBACK 都无法确认，返回 QUEUE_WRITE_UNCERTAIN 而不宣称回滚成功。没有伪造跨两个数据库的原子性。

Compose 启用 YUKARI_NODE_QUEUE_MUTATIONS=1：delete.php、公开 request_delete/request_move、admin.php 对应操作、旧批量 reorder、清空/导入、update.php 的 reqorder 和勾选数据库的恢复均在业务启动前关闭（410）；HTTP 测试/race 目录禁止。旧 swipe/表格不会把关闭响应当成功，提示独立管理端登录。旧普通队列、创建和其他尚未迁移操作保留。**拖拽/Undo、批量清空/导入、原 delete.php 状态重置及 DB 恢复本阶段未迁移，当前旧入口不可执行**，并未用 read ticket 或 Basic 隐式创建 Node 写会话。

### 验证与现场数据

- 三个应用 typecheck/build 通过；最终 API 镜像构建通过；恢复后的 PHP/Node healthy。
- Legacy 304 个 PHP 源文件语法通过，6 个 PHP oracle/测试文件通过；既有 13 项 Node 认证不变量及 5 项旧管理认证检查通过。
- 完整 API 测试 **18/18 通过**。新增真实 PHP helpers/normalize 对照覆盖空队列、不存在 ID、边界、间隔/重复/9999、NULL/文本/小数异常排序、播放标记及历史/完整记录；触发器失败整体回滚、缺失/越界路径、锁超时、通知失败后不重写。
- 真实隔离部署覆盖 Node 写响应 Owner、通知精确递增、历史不变、无效参数无副作用、同 ID 并发删除只一次成功、旧写入口 410 且队列/通知不变。授权替身不提供 PHP 队列写业务也可完成 Native move；普通身份、伪造角色和撤销后写入被拒绝。
- 跨运行时用真实 Linux PHP 持有 WAL 写锁，Node 开始竞争后才握手允许延迟提交，验证 Node 确实等待且使用提交后快照。初次把 Windows Node 与 Linux PHP 同时开 WAL 时出现 I/O 错误；已改为与部署一致的两个 Linux 容器，未将它算作通过或忽略。
- Edge 用户端 **6 通过、1 跳过**（未配置真实曲库），管理端 **3 通过**。包含真实 UI 登录、PHP 创建 → Native SQLite 读取、Node 调序/删除、保密、无变化设置保存、播放器不可达和退出。
- 所有本轮业务写测试均在 `.local/phase7-test-legacy` 合成部署或内存/临时库完成，不复制生产 DB/INI。测试工具/浏览器启动要求合成 marker，避免误跑现场。首次权限失败只影响合成记录，修复共享组权限后重跑通过。
- 隔离结束恢复正常 Compose，原队列逻辑内容及真实 config.ini、ini.ini 指纹保持一致；没有对现场队列新增/删除测试记录。恢复后真实 user/admin 认证及 queue/settings GET 均 200，两个 Vite 与旧 search/swipe 页面 200。暂存区仍是原 652 项纯重命名，未暂存运行秘密或测试产物。

访问保持：http://127.0.0.1:5173/（用户）、http://127.0.0.1:5174/（管理）、http://127.0.0.1:3000/health、http://127.0.0.1:8080/requestlist_swipe.php。正常启动仍 `docker compose -f docker/compose.yaml up --build -d`。隔离测试会暂占相同端口，按兼容文档测试后恢复；不删除 volume。

### 下一阶段评估

创建预约比本阶段删/移复杂：输入默认值/替换/自动轮换、身份与历史、Lister 元数据、Cookie、通知均需等价覆盖。exec.php 已在主 INSERT/reqorder/自动轮换 COMMIT 后才执行元数据和历史等步骤，后续异常导致“已入库但返回错误”。下一阶段先在隔离环境对各提交点注入故障，再明确必需原子数据、可选副作用、提交结果查询与幂等策略；不通过重试或双写掩盖部分成功，本阶段未更改其预约规则。

queue-wal-anchor 保留。专用目录现为 RW，可能已允许只读 SQLite 自行创建旁文件，但尚未验证停 anchor 下全部重启/清理/readiness 场景；每次关闭的 Node 管理连接也不等于持久拥有整个 WAL 生命周期。可先做隔离生命周期验证再移除，不因路由 Native 化直接删除。大型队列同步事务性能、部分成功/跨请求幂等、旧批量管理功能迁移仍待后续；未改搜索算法、播放器或真实 Schema。

## Phase 8：Node-native 预约创建与替换

日期：2026-10-20（Asia/Tokyo）。在 Phase 7 工作区增量实施；未 commit/push。经用户明确批准后，仅在原 queue SQLite 添加 `request_submission` 幂等凭据表；不改现有列、密码、队列 Schema 或创建第二数据库。

### Owner 与业务等价

`POST /api/v1/requests` 与生产 Compose 的旧 `POST /exec.php` 兼容入口现由 Node 独占核心预约写入。React 继续使用原统一 API。Legacy 通过 request intent/短时签名上下文转交 Node，保留普通 Cookie 身份、singer/freesinger/comment、kind、小休止、secret、URL、替换/selectid、自动 reqorder、历史和通知语义；PHP 不再执行预约 INSERT。Node 预约、必要元数据、历史、身份更新和幂等结果在一个 `BEGIN IMMEDIATE` 事务提交；队列通知在 commit 后复用 PHP helper。通知失败明确返回“已提交但通知失败”，不自动重复写入。

替换保留既有记录状态、位置和身份属性。提交凭据只持久化随机 receipt 的哈希、输入哈希、owner、记录 ID、操作、时间及结果；重复相同 receipt 返回原结果，不重复插入/历史/通知，改输入冲突，另一用户不可查询。React 在网络结果未知后复用同一 receipt；不依赖内存 Map。原 PHP `exec.php` 在隔离库中作为行为 oracle；主要差异是历史/必要数据写失败时 Node 整体回滚，消除 PHP 主 INSERT 已提交、后续历史失败而响应错误的部分成功状态。

| 模块 | Phase 8 Owner |
| --- | --- |
| 预约创建/替换、顺序、历史、核心身份字段 | **Node-native**（同一 SQLite 事务） |
| 持久提交结果与重试去重 | **Node-native**（`request_submission` additive 表） |
| 预约后 SSE/更新通知 | PHP 通知 helper，仅提交后副作用；不拥有预约写入 |
| Everything/YukaLister 搜索与只读元数据 | PHP；搜索算法不变 |
| 管理删除、单项移动/归一化 | Node-native（Phase 7） |
| 管理批量拖拽/Undo、清空/导入/恢复/旧状态重置 | 批量 Node endpoint 已有隔离 API 测试；Legacy 页面经 exact-path Apache proxy 的 Edge 测试通过；清空/导入/恢复/重置保持关闭 |
| 设置写入、播放控制、播放器及媒体生命周期 | PHP |

### 迁移、验证与运行状态

显式 `node dist/migrate.js request.db` 在现有生产数据库运行一次。迁移前后只读摘要都是 `requesttable` 1 条记录、min/max id=3；新表列校验通过。未读取或输出真实标题、密码、INI 内容。正常 Compose 已设置 `YUKARI_NODE_REQUESTS=1`，未配置启动时 schema 迁移。`queue-wal-anchor` 继续保留；本阶段没有完成停用 anchor 的 WAL/重启/readiness 生命周期测试。

- API 集成套件 **26/26 通过**；包括真实 PHP exec 业务体 oracle、创建/替换、幂等并发、通知不重放、事务故障回滚，以及已有队列/认证/调序回归。
- API/user-web/admin-web typecheck 与 build 全通过。
- user-web/Legacy Edge **5 通过、1 跳过**（未设置真实曲库命中条件）；覆盖 React 经 Node 创建、Legacy v2 旧页经 Node 创建、队列回读和 Legacy 管理批量排序测试。admin-web Edge **3/3 通过**，覆盖认证边界和现有管理操作。
- PHP 原版预约 oracle 用临时数据库且配置快照在测试结束恢复；其他所有业务写回归继续只用带 marker 的合成 fixture。没有对生产队列做写测试。

访问地址不变：user 5173、admin 5174、Node 3000、Legacy 8080。`docker compose -f docker/compose.yaml up --build -d` 启动已启用 Node 预约 Owner 的服务。


### Phase 8 尚未完成

真实曲库搜索命中和播放器播放未验证。Legacy 批量排序最初的 regex 代理返回 403，改用单一路径固定 ProxyPass 后 Edge 回归通过；其他 `/api/v1` 路径继续默认拒绝。清空/导入/恢复/状态重置未迁移。SQLite 通知与队列是不同存储，跨库恰好一次通知未保证；预约不会因通知错误回滚/重放。Node 单一写入并不等于可移除 WAL anchor；后续先测试旁文件生命周期及 PHP 与 Node 重启。

## Phase 9：Windows Player Agent / mpv 测试播放链路

新增独立 `apps/player-agent`（Node.js + TypeScript），宿主机运行、不在 Docker。Fastify 添加管理员创建本地测试任务/暂停/继续/停止 API、Agent 独立 Bearer 认证轮询/状态回报，以及仅含连接与播放状态的普通用户只读视图。管理页 System 展示 Agent 实况。任务状态持久化在新 `player_agent_state` named volume，原子 JSON 更新；未改 SQLite Schema、预约 Owner、`nowplaying` 或 queue-wal-anchor。

PlayerAdapter 采用 mpv Windows named-pipe JSON IPC，Agent 仅启动固定 `MPV_PATH`、固定参数且 `shell:false`；测试视频路径必须在宿主机配置的媒体根目录下，校验 realpath 并拒绝 traversal/外部 symlink。进程启动不等于播放成功；只有 mpv 报告目标 path、非 idle 且非 paused 后显示 playing；只有真实 `end-file` reason=eof 才 completed。Agent 断线会停止播放器，任务 ID/Agent ID 防重复领取。Agent 使用说明在 [apps/player-agent/README.md](../apps/player-agent/README.md)。

本机核查结果：PotPlayer-64 bit 26.06.22.0 已安装，CmdLine64.txt 仅确认命令行打开/playlist 参数，不提供已确认的可靠状态/结束 API，因此未实现脆弱按键模拟。winget mpv 位于 `C:\Program Files\MPV Player\mpv.exe`，`--version` 为 `v0.41.0-244-gaf9c81fa1`；由 `MPV_PATH` 指定，不依赖 PATH 或重装。FFmpeg 9.0 在仓库外生成 `D:\project\yukari\test-media\agent-test.mp4`；ffprobe 验证 15.000 秒 H.264 640×360 画面与 AAC 48kHz 音轨。以真实管理员会话经 Fastify 创建两项测试任务：首项的服务端实况依次确认 playing、paused、playing、stop；停止后 Agent 没有重开过期任务。第二项完整播放，Fastify 只在 Agent 收到 mpv `end-file reason=eof` 后记为 completed。任务只写入专用 `player_agent_state` volume，未修改 queue SQLite。早期一次 UI 任务超时失败；修正空闲 mpv `path` 属性处理、为 API 超时错误添加路由上下文，并修复 stop 后同轮旧 assignment 可能重开的竞态后，API→Agent→mpv 闭环通过。桌面画面/声音仍需用户人工确认。

Validation: mpv `v0.41.0` is configured by explicit `MPV_PATH`; the user confirmed the generated 15-second color-bar video was visible, and audio was audible. Real task controls verified playing, pause, resume and stop; a separate run completed only after mpv `end-file reason=eof`. Phase 10 additionally exercised real isolated queue rows through mpv and Fastify.

Node 当前新增业务仅为受控测试任务协调；Legacy PHP 继续拥有生产预约播放生命周期与既有 MPC/foobar 实况控制。自动切歌的阻碍包括：实际媒体目录映射、mpv 对卡拉 OK 文件/音轨/字幕的现场验证、旧播放标记及曲目音量/键调/延时/进度通知等副作用等价，以及异常停止与用户手动切歌策略。详见 [Phase 9 兼容矩阵](LEGACY_COMPATIBILITY.md)。


Phase 9 admin proxy follow-up: admin-web Vite had omitted the exact Player Agent endpoints, making the UI report disconnected while Fastify heartbeat was healthy. Added exact GET status and POST test/control routes to the dev allowlist; Fastify admin session, Origin and CSRF checks remain authoritative. A no-cookie request now passes the proxy and receives Fastify 401 rather than Vite 403. Admin build/typecheck pass and an E2E response assertion was added; that E2E has not yet been rerun after the proxy fix.


## Phase 10：隔离队列自动播放最小闭环

本阶段遵守单一 Owner：Fastify 是 opt-in 自动播放的唯一队列协调者（Compose 默认关闭）；复用现有 request.db 和 player_agent_state volume，没有新表、Schema 修改或真实数据迁移。持久任务状态权威；SQLite 的 nowplaying 仅作旧 UI 投影。Node 原子领取 reqorder ASC/id ASC 的未播放记录并写“再生開始待ち”，只在 Agent/mpv 报告目标已实际 playing 后投影“再生中”并增加 playtimes；只有 mpv 的真实 EOF 事件投影“再生済”。失败/跳过投影“停止中”。标记更新有事务和 busy timeout。提交/报告重复安全，非 EOF completed 被拒绝。

自动播放仅支持 playmode=1、本地 kind=视频、常见视频扩展、所有原曲目控制项为零。Agent 用配置的 Windows 媒体根 realpath 校验数据库路径，不允许外部符号链接或任意命令。音轨、调键、音量、延时、循环、小休止、URL/直播、视频别播、评论叠加、capture/progress 等明确不支持，不会被悄悄忽略。遇到不支持项会 fail-closed 并保留 Node owner fence；管理员须显式 Stop autoplay 才释放给旧播放路径。Legacy 播放/状态入口在共享 owner fence 存在时拒绝写入；Node 运行态不转发到 PHP 播放队列，通知只在真实状态变更后调用旧通知 helper。

隔离真实实播顺序：三条合成队列记录（reqorder -2/-1/0）均指向项目外 15 秒视频。第一条真实 playing、pause、resume 后管理员 skip，记录变为停止中，Agent 随即领取第二条；第二、第三条都收到真实 mpv EOF 后才变为再生済。服务端状态回读确认三条各自 playtimes=1，跳过项状态正确。其后两条合成基线“小休止”保持未播放；Node 报告不支持并停下，不改写行。管理员 Stop 确认 Agent idle、autoplay false 并释放 owner marker；仅按明确 singer/kind/path 删除三条合成记录。未读取或写入真实用户队列。

验证：API + PHP oracle **35/35**；user-web Edge **8 passed / 1 skipped**（真实曲库命中未配置）；admin-web Edge **3/3**；Player Agent **3/3**；API/user/admin/Agent typecheck 与 build 通过。初次并行启动两个浏览器套件导致它们共享合成 DB 的测试行互相可见，已确认仅合成记录、基线未变，随后改为串行重跑并通过；管理 E2E 需 Agent 离线，故回归期间短暂停止空闲 Agent。完整 PHP lint/正常 Compose 健康检查见本阶段最终验证。

目前不启用生产自动播放（docker/compose.yaml 默认 YUKARI_NODE_AUTOPLAY=0）。真实自动切歌证明仅限隔离视频 fixture；不得把旧 PHP Windows manager 与 Node 同时指向同一队列。切换前仍须验证生产媒体映射、现场 queue-owner fence 共享、Legacy Windows 进程停用/围栏、故障恢复和小休止人工流程。队列历史的 songstart/songnext、音轨/调键/音量、评论/进度及其他 karaoke 行为未迁移；PotPlayer 无可靠控制接口。没有自动 commit/push。

Phase 10 stop-control follow-up: on a second isolated synthetic request, Fastify claimed the real mpv video, observed playing, then an admin Stop caused mpv to report stopped; the request moved to 停止中/playback failed, autoplay disabled, no next task was claimed, and the owner fence was released. The exact synthetic queue row and its one history entry were removed; the two isolated baseline 小休止 rows remained unchanged.

## Phase 10 durable SQLite task/history follow-up

日期：2026-10-21（Asia/Tokyo）。正式自动播放任务从 JSON `player_agent_state` 移至同一 `request.db`，新增 `apps/api-server/migrations/002-playback-task.sql`：`playback_task` 保存唯一任务 ID、request ID、状态、Agent、15 秒续租、命令序号、实测播放态、时间和脱敏错误码；`playback_event` 追加领取、开始、暂停/恢复、管理命令、跳过、停止、失败、EOF 与恢复事件。partial unique indexes 阻止同一预约被并行活动任务消费，以及同一时刻有多个正式活动任务。JSON volume 保留、不删除、不负责正式队列任务，只承载 Phase 9 测试任务与 Agent heartbeat。

Fastify 是唯一正式队列协调者。队列领取、任务插入、事件插入和 `requesttable` 的“再生開始待ち”投影同属 `BEGIN IMMEDIATE`；报告播放、完成/失败及兼容投影也同事务提交。实播确认后才将 `再生中`、`playtimes + 1` 和开始事件一起落库；实际 mpv `end-file reason=eof` 才将任务/事件和 `再生済` 一起提交。重复 EOF/状态报告不重复计数或写重复事件。admin-only `GET /api/v1/admin/playback/history` 返回任务和事件分页，不存放或返回媒体路径/认证凭据。

Agent 15 秒 lease 在轮询中续租。Fastify 重启时未决 `claimed/playing` 转 `uncertain` 并保留 owner fence；lease 过期同样转 uncertain。Agent 仅被要求停止；确认 mpv 已停止后才以 failed/停止中终结，不重播、不猜测完成。Node 启动时若正式 autoplay 配置开启而 DDL 不存在会 fail-fast；正常 Compose 仍是 `YUKARI_NODE_AUTOPLAY=0`。旧 JSON 队列任务会被忽略，但卷和旧记录保留。

隔离 SQLite 验证：自动领取顺序/Agent 单一归属、task+event+状态投影事务、playtimes 只增加一次、暂停/恢复命令需实测回报后清除、真实 EOF 契约与重复回报、媒体路径不进入历史、触发器注入时事务完整回滚、Fastify 重启/租约超时转 uncertain 且需确认停止。新增仓储与 API 回归 **5/5 通过**；API typecheck/build 通过。完整 `apps/api-server` suite 在此 Windows 执行环境无法成功：多个既有测试需要 Docker synthetic compose，Docker Engine pipe 返回 `permission denied`，本机运行也未设置受保护的 `E2E_CONFIG_PATH`；不能把这些失败记作通过。新 schema 下真实 Windows Agent→mpv 的端到端回归、完整 Docker Compose 和两套 Edge E2E 尚未重跑。Phase 9/10 先前在 JSON task store 上的真实 mpv 画面/声音、控制与 EOF 验证仍有效，但不能替代本次 SQLite task store + mpv 的联调。

真实 `request.db` **未迁移 Schema**；已将停服后的数据库及 SQLite sidecar 快照保存在被 Git 忽略的 `.local/phase10-playback-backup/`，`integrity_check`、队列/回执行数及 SHA256 均校验通过。实际 Schema 未改变；本轮曾写入的三条测试预约已按唯一标记清理，详见下文。迁移执行前仍须重新制作新鲜备份。虽然新 DDL 已在临时合成库执行，仍需在部署前停止所有 PHP/Node/Legacy 队列写者和 WAL anchor，制作并校验一致备份（DB 与 WAL/SHM 状态），再由用户批准后执行显式 `node dist/migrate.js request.db playback-task`。新迁移只增两张表和索引，不更改既有列或现有预约/幂等行；旧 JSON volume 不删除。只有真实库迁移后才可在该环境启用自动播放。详细契约/Owner 见 [兼容矩阵](LEGACY_COMPATIBILITY.md#phase-10-node-native-自动播放仅隔离验证)。

### Phase 10 follow-up validation and proxy safety

2026-10-21 follow-up: the full API/PHP oracle suite passed **40 tests, 0 failed, 1 optional real-mpv test skipped**. The separate Windows Agent + real mpv + temporary SQLite test passed **1/1**, verifying observed playing, pause, resume, and actual EOF. user-web Edge passed **8/8 runnable tests** with one real-search fixture skip; admin-web passed **3/3**. All four apps typechecked and built. Browser tests now use `API_PROXY_TARGET` from the process environment and `E2E_WEB_PORT` to avoid an already-running developer Vite server.

During the initial E2E attempt, the React proxy did not read the shell API target, so three uniquely marked `ReactNodeE2E_` small-rest requests went to the default API. The test was stopped; IDs 64–66 were verified by prefix and deleted through the authenticated Node admin endpoint. Their three distinct test-user history/user entries and submission receipts were then removed by exact owner/request IDs in one transaction. Read-only verification found no matching queue rows or receipts and a contiguous remaining queue. The API emitted normal reservation/cleanup notifications, whose counter side effects cannot be reversed. The proxy and E2E port fixes were applied before the passing rerun; all later browser writes targeted only the isolated 3100/8180 deployment.

The deployed `request.db` was **not migrated** and formal autoplay remains disabled. No database tables were added to it; the explicit migration and consistent backup procedure remain pending approval.

## Phase 11: playback-mode boundaries, explicit path mapping, and isolated two-song E2E

Phase 11 did not change the live queue, saved `playmode`, media configuration, Compose autoplay flag, or database schema. The existing configured mode remains outside this phase's test fixture; the synthetic E2E explicitly used `playmode=1`.

### Mode compatibility

PHP `init.php` exposes modes 1–5. Mode 1 automatically advances in queue order. Mode 2 requires a person to press the playback-start control. Mode 3 registers a manually maintained player playlist. Mode 4 is a jukebox mode selecting least-played eligible entries, randomizing equal-count choices, avoiding immediate repeats and sometimes balancing play counts. Mode 5 randomly selects from the list regardless of prior play count and excludes the Legacy karaoke-delivery kind. These modes do not share a safe FIFO rule. Fastify and `PlaybackTaskRepository` remain mode-1-only; modes 2–5 fail closed. In particular, mode 3 is not changed to mode 1 and no real config is touched.

### POSIX-to-Windows media mapping

The Player Agent now accepts `PLAYER_PATH_MAPPINGS` as a local JSON array of `{source,target}`. POSIX source roots must be normalized absolute directories; target directories must already exist beneath `PLAYER_MEDIA_ROOT`. A queue path must match an explicit source prefix and resolve to an existing file within both roots. `realpath` rejects traversal and symlinks escaping the allowed directory. Unmapped POSIX paths, malformed mappings and missing files fail closed. Existing Windows absolute or relative queue paths are still accepted only under the configured real media root. The mapping never comes from a browser or Fastify request.

PHP persists `fullpath` from its search result; the exact result path is environment dependent. Docker Compose does not mount the Windows media library into the PHP/Node containers. This phase validated mapping with synthetic `/synthetic-media` → temporary Windows media-root mapping and two copies of the external 15-second test clip. It did not derive or apply any production mapping. Before production use, the operator must inspect the local storage layout and set an explicit mapping that resolves each eligible database path to the intended host file.

### Two-song real-player verification

The isolated Windows real-mpv E2E used a fresh temporary SQLite database and two synthetic queue rows. Admin-authenticated Fastify started mode 1, claimed the first row, Agent mapped its POSIX path, mpv reported real playing, and pause/resume were observed. Only real `end-file reason=eof` completed that row and projected `再生済` with one play count. The scheduler then claimed the second row; its independently observed EOF completed it. Both rows have one EOF event and one play count, with no active task left. Admin history returned two tasks and omitted media paths; Stop disabled autoplay and released the isolated owner fence. This demonstrates an isolated real-player loop, not production autoplay.

The sequential test exposed globally colliding deterministic event keys (`claimed`, `playing`, `eof`). Later task transitions could commit while the `INSERT OR IGNORE` silently omitted their events. Keys are now namespaced by task ID. A repository regression test completes two tasks and checks that both retain EOF history. Admin System now displays sanitized playback history next to Agent/task status.

Validation: focused playback/API tests 13/13; Player Agent tests 4/4; real Windows mpv + mapped two-row temporary-SQLite E2E 1/1; typecheck/build passed for API, user-web, admin-web and Player Agent. Full API test command reported 25 passed, 15 prerequisite failures and 1 optional real-mpv skip: Docker Engine pipe access was denied, and protected isolated-write `E2E_CONFIG_PATH` was unavailable. User/admin browser E2E were not run without an isolated Compose deployment. Read-only HTTP checks to API health, admin-web and Legacy returned 200; production services were not used for writes. The actual host Agent process listing and Docker Compose process details could not be inspected due OS/Docker permissions.

### Owner and approval boundary

Fastify remains the sole formal queue scheduler/task owner; SQLite `playback_task`/`playback_event` and `requesttable` compatibility projections behave as in Phase 10. Player Agent only validates mapped host files, executes mpv, and reports observed playback/EOF. Legacy owns search path production and remaining karaoke-specific controls/side effects. Formal autoplay stays disabled. A future production activation still requires a reviewed real-path mapping, proof that no Windows Legacy manager can consume the queue concurrently, and an explicit approval to enable `YUKARI_NODE_AUTOPLAY`; mode 3 cannot be used until its playlist-registration semantics are migrated or a different owner is chosen.

| Module | Phase 11 owner | Boundary |
| --- | --- | --- |
| Queue selection/order and formal task lifecycle | Fastify + `request.db` | Mode 1 only; no Legacy queue polling while owner fence is held |
| Host file validation and mpv execution | Windows Player Agent | Explicit local mappings and real mpv feedback only |
| Search result path generation and unconverted karaoke controls | Legacy PHP | No Node search rewrite; manager must not compete with Fastify |
| User/admin presentation | React clients | Admin page reads authenticated current state/history; service still enforces role |

## Phase 12：实际使用准备与最终回归

日期：2026-10-21。Docker Engine 测试访问通过 ignored `.local/empty-docker-config` 下的临时 Compose CLI 插件恢复。正式 Compose 与 `phase12isolated` 合成栈均 healthy；正式配置仍为 `YUKARI_NODE_AUTOPLAY=0`。未修改正式 `request.db`、预约、playmode、媒体配置、密码或 schema。

完整 API/PHP oracle **43/43 通过**（完整套件中的可选真实 mpv 测试跳过，随后单独启用）；Player Agent **4/4**，PHP lint **305/305**，API、user-web、admin-web、Player Agent typecheck/build 全通过。独立真实 Windows mpv + 临时 SQLite 两首队列测试 **1/1 通过**：真实 playing、pause/resume、EOF、每行一次播放计数和 EOF 事件、EOF 后下一首。没有触碰正式预约。user Edge 报告 **8 通过、1 跳过**（测试曲库未配置真实搜索命中），admin Edge **3/3 通过**，均指向隔离 API。两个 Playwright 命令已输出全部通过项，但 Windows teardown 后进程未退出；收集结果后手动中断，故用例断言通过而命令退出状态不视为干净通过。第一次 API 测试的相对路径与 Compose marker 不匹配均已修正，最终完整套件成功。

播放策略按当前只读 Legacy `playmode` 显示，管理 UI 不修改此设置：模式 1 可选择 Node FIFO 自动播放；模式 2 可显式接管并逐首点击“开始下一首”，真实 EOF 后等待管理员下一次操作；模式 3 手动播放列表注册语义未迁移；模式 4/5 有不同的选曲、排除、随机及播放次数平衡规则，Node 不用 FIFO 冒充。模式 3–5 当前不可由 Node 接管。

管理端提供逐预约媒体可用性检查，结果为 `playable`、`path_unmapped`、`file_missing`、`invalid_path` 或 `agent_offline`，不向浏览器暴露实际路径。`playable` 仅表示 Windows Agent 在本地配置的 allowlist/root 下解析到现存文件，不代表编码格式及卡拉 OK 控制可用。Docker/Legacy 持久化路径格式来自实际搜索结果；本机没有确认正式曲库目录，所以没有配置或猜测真实映射。按 [Player Agent 路径说明](../apps/player-agent/README.md) 由管理员核对 Legacy POSIX 路径，再填写 `PLAYER_PATH_MAPPINGS` 的 source/target 和已有 Windows `PLAYER_MEDIA_ROOT`。

当前用户可见进程列表未发现 mpv、PHP 或 Legacy 管理播放器进程；受限权限无法检查其他用户/提升权限的 Windows 计划任务。容器 Legacy manager 启动及轮询时会检查共享 owner fence；但独立 Windows 安装/计划任务必须确认共用并遵守该 fence，或保持停止。正式启动仍有两个人工门槛：提供并核验正式媒体映射，确认所有外部 Legacy 调度器已停止/围栏，然后另行批准启用 `YUKARI_NODE_AUTOPLAY`。在此之前保持关闭，不使用真实预约做实播。

## Phase 13：Windows 本地启动、统一构建入口与开发回归

本阶段只整理本地运行体验，没有修改正式预约、`request.db`、Schema、`playmode`、管理凭据或正式媒体目录。正常 Compose 保持 `YUKARI_NODE_AUTOPLAY=0`；正式 PHP/Fastify 容器健康。隔离回归使用独立 `phase13isolated` synthetic SQLite 栈（API 3100、Legacy 8180），未清理任何 Docker volume。

Docker 镜像现通过独立构建阶段生成 user-web/admin-web，Apache 同源地址为 `http://127.0.0.1:8080/app/`（入口）、`/user/`（用户端）和 `/admin/`（管理端）；旧 PHP URL 保持原样。Apache 将 `/api/v1/` 同源转发给 Fastify，剥离 Authorization，鉴权和 CSRF 仍由 Fastify 执行。Vite 开发模式仍分别使用 5173/5174。

Windows 11 操作脚本位于 `scripts/windows/`：Start/Stop、状态、日志及 Agent 配置向导。配置向导使用 Windows 文件夹/文件选择器，只保存用户明确选中的媒体根、mpv 路径、可选根内测试视频和人工核实的 POSIX 映射；路径配置保存在 `%LOCALAPPDATA%\YukariPlayerAgent\agent-config.json`，Agent 凭据独立存放。Stop 通过 Agent 专属本地管道请求退出并验证 PID、启动时间和可执行文件，再停止当前 Compose 的 web/API 服务；不杀全部 node.exe、不删卷。配置向导默认定位 `%ProgramFiles%\MPV Player\mpv.exe`，仍允许手动选择安装位置。未配置任何真实曲库映射。

Playwright Windows teardown 改由 `scripts/run-web-e2e.mjs` 管理：用 `E2E_WEB_PORT` 启动明确的 Vite 子进程、运行 Playwright 后停止该进程；`E2E_BASE_URL` 可直接针对构建后的 Apache UI。实际验证该脚本的开发模式运行能在测试完成后退出，不遗留测试端口。UI 未引入新框架/全局状态库；管理 System 保留当前播放/Agent、错误状态、预约媒体检查与历史展示。

验证结果：API + PHP oracle **43 通过、0 失败、1 个可选真实 mpv 用例跳过**；user-web Edge **8 通过、1 跳过**（合成曲库无真实搜索命中）；admin-web Edge **3/3 通过**；Player Agent **6/6 通过**。API、user-web、admin-web、Agent typecheck/build 全通过。先前隔离 API 套件有一条旧测试仍期望 Apache 对 `/api/v1` 返回 403；统一代理后 Fastify 正确返回 401/404，已更新断言并通过完整重跑。静态 Docker 构建及真实 `/app/`、`/user/`、`/admin/` 和旧 PHP URL HTTP 回归通过。Phase 13 未重新执行实播；Phase 9/11 已有的本地 mpv 和两首隔离 EOF 验证仍是播放器实播证据，不能视作正式自动播放。

正式自动播放仍未启用。管理员仍需在本机运行 `Configure-PlayerAgent.cmd`，人工选择实际媒体根和 mpv.exe；POSIX → Windows 路径前缀必须对照真实预约 fullpath 后再填写。正式启用前还需确认独立 Windows Legacy 调度器停止或共享并遵守 owner fence，并单独批准开关。启动器首次启动需可用的 Docker Desktop、Node.js 24、原 PHP 配置；需要播放器时需先配置 Agent。命令与恢复说明见 [Windows 本地运行手册](WINDOWS_LOCAL_RUNBOOK.zh-CN.md)。

The launch scripts include a conditional Compose plugin fallback for installations where the default Docker CLI config is unreadable. It preserves any explicitly selected Docker config/context and does not alter Docker Desktop settings.
