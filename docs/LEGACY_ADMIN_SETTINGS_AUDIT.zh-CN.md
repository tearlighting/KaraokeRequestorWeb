# Legacy PHP Admin 设置审计（Phase 19）

审计依据：`legacy/php/init.php`、`api/admin.php`、`api/node_bridge.php`、`commonfunc.php`、`manage-mpc.php`、Fastify `mysql-domain.ts` / `app.ts`、React Admin Settings / Playback Console，以及 MySQL migrations。MySQL 模式下 Legacy Admin 页面由入口守卫禁用；React Admin 是正式管理入口。密码与 EasyAuth 的验证仍由 PHP 兼容层执行，MySQL 不保存管理员密码。

| 设置/操作 | Legacy 页面与代码 | 原存储/用途 | 当前 Owner 与实际效果 | 处理 |
|---|---|---|---|---|
| `playmode`（1–5） | `init.php:586-591`; `manage-mpc.php`; `commonfunc.php:1832+` | `config.ini`；自动 FIFO、人工启动、手动播放器列表、两类随机 BGM | `app_setting`；Fastify 从 MySQL 读取。MySQL 播放调度器只执行 mode 1；mode 2–5 保留显示但不能启动。部署开关只限制可用性，不改写保存值 | React 可设置 mode 1；未实现模式不能切换启用。正式 autoplay 默认关闭并须管理员显式启动 |
| 自动预约歌手轮换 `request_automove` | `init.php:1948-1968`; `node_bridge.php:106-114` | `config.ini`；新预约按歌手历史轮次安放 | 新增 MySQL `app_setting` 项；创建/替换请求中 Node 读取 MySQL 策略。PHP Bridge 仍提供身份、历史权限和元数据，不再决定 MySQL 队列顺序 | 已迁移；只影响新预约，不重排现有预约 |
| 轮换在小休止后重置 `request_automove_reset` | `init.php:1974-1994`; `request-order.ts` | `config.ini`；决定小休止是否作为歌手轮次边界 | MySQL `app_setting`；Node `automaticOrder` 按已验证的 PHP 对照实现消费 | 已迁移 |
| 中途加入优先 `request_automove_midjoin_first` | `init.php:2000-2020`; `request-order.ts` | `config.ini`；决定新歌手在既有轮次中的插入位置 | MySQL `app_setting`；Node 预约事务中消费 | 已迁移 |
| 队列排序、单项删除、批量拖动 | Legacy `init.php:392-405`、`request_move.php`、`request_delete.php` | SQLite `reqorder` 与旧 PHP 函数 | Fastify/MySQL `reservation`；Node 事务管理；React Admin 队列页 | 单项及批量排序已迁移；清空、导入/恢复、旧状态重置入口仍禁用 |
| Pause / Resume / Stop / Skip | Legacy `api/player.php`、`manage-mpc.php` | Windows MPC-BE/foobar 命令和旧播放状态 | Node/MySQL `playback_task` + `playback_event`，Windows Media Agent/mpv 回报实际状态；React Playback Console 发命令 | 新 mpv 流程支持并要求 Agent 实际确认；MPC-BE/foobar 兼容控制不属于 MySQL 产品 |
| 播放历史、播放次数与状态 | Legacy `manage-mpc.php`、`requesttable` | SQLite 预约字段、旧播放日志 | MySQL `reservation` 的兼容状态投影、`playback_task`、追加式 `playback_event`；React Admin 可查历史 | 已迁移至 MySQL 播放任务。未重做旧评论/音轨/调键等副作用 |
| `startvolume` / `startvolume50` | `init.php:1307-1336`; `function_playeradjust.php` | `config.ini` + MPC 控制音量 | `startvolume` 值导入 MySQL，但 mpv Agent 当前不应用初始音量；Legacy 播放控制在 MySQL 模式禁用 | 只读保留。React 明示当前无效，API 拒绝修改，待 mpv 音量行为单独迁移 |
| `requestlistactivereload` / `reloadtime` | `init.php:736-763`; `requestlist_event.php`; `requestlist_swipe.php` | `config.ini` + PHP SSE/定时刷新 | `requestlistactivereload` 值保留在 MySQL；React 自己刷新，不读取该项；Legacy SSE 在 MySQL 模式禁用 | 只读保留，API 拒绝修改；可随 Legacy Admin 一并废弃 |
| `requestlist_num` | `init.php:773-780` | `config.ini`；旧页面每页显示数，不是预约数量限制 | 新 React 队列分页由 API 参数控制；MySQL 没有请求总量上限设置 | Legacy-only，React 当前无对应业务需要，不迁移 |
| `autoplay_exec` / `autoplay_show` | `init.php:614-640`; `autoplayctrl.php` | `config.ini` 中的 Windows 命令/显示项 | MySQL 模式不允许 Legacy 任意命令播放；新播放由固定 Media Agent 接口执行 | 高风险旧命令设置废弃，不迁移 |
| 管理密码、EasyAuth | `init.php:559`, `2120-2132`; `api/_admin_auth.php` | `config.ini`；原管理密码与访问口令策略 | Fastify 管理会话仍向 PHP Bridge 验证现有凭据与策略；React Admin 不直接读写密码 | 兼容保留。没有复制、显示或重置密码 |
| 个人页历史开关、收藏、配对、Bingo、评论等 | Legacy Admin 表单及旧 PHP 页面 | 旧配置/SQLite；MySQL 有部分空的兼容表 | MySQL 模式入口守卫禁用；没有 React/Fastify 业务实现 | 暂缓或废弃；Schema 表存在不代表功能已迁移 |

## MySQL 设置契约

`app_setting` 是单一持久设置 Owner。首次/显式 setup bootstrap 从配置白名单导入初始值；之后 React Admin 通过 Fastify GET/PUT 读写。更新在 MySQL 事务中检查 revision 并统一递增，Fastify 重启后从数据库重读。新增的三项预约排序策略仅由 Node 预约事务读取；Bridge 返回的同名旧字段不覆盖 MySQL。

Legacy `init.php` 单选框用 `2` 表示关闭，而新的 MySQL/API 语义为 `0`。导入时会归一化；若旧 MySQL 行已存 `2`，Fastify 读取为关闭但不自动改写数据库。无变化保存不会触发隐式归一化写入；下次真实设置变更才会把白名单布尔项写成 `0/1`。其他非 `0/1/2` 值会明确报错。

目前只有 Node FIFO mode 1 是 MySQL 播放调度器支持的模式。即使 mode 1 已保存，`YUKARI_NODE_AUTOPLAY=0`、Agent 凭据/任务表缺失或 Agent 离线时，Admin 会显示阻碍；保存模式不会自动启动播放。mode 2 人工调度与 mode 3–5 未迁移。`startvolume` 与旧 SSE 刷新设置显示为兼容值，不冒充已生效。

没有修改正式预约、播放模式或自动播放运行开关，没有运行 MySQL bootstrap，也没有触碰数据库数据。设置数据补齐需要在显式 MySQL setup/bootstrap 后才能由当前新 Admin 读取；启动过程不会自动迁移。
