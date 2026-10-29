# Phase 31 — User Web 视觉重设计评审

## 测试环境与数据来源

- 页面由仓库当前 `apps/user-web` 源码通过本地 Vite、Microsoft Edge 和 Playwright 渲染；没有访问或截图公网/正式部署页面。
- 所有业务 API 都由本测试中的隔离 mock 响应。歌曲名、参与者、队列和播放状态都是专为截图准备的示例数据；媒体路径使用 `MOCK:`，没有发起真实预约、播放器控制或数据库写入。
- 视口覆盖 440×956、390×844、360×780 CSS px 和桌面 1440×900。字体加载后截图。Sakura 使用现有 `default` 主题，Aurora 使用现有 `anisong-dark` 主题。
- 这些是桌面 Edge 的响应式视口截图，不等于真实 iPhone Safari、Android Chrome、PWA standalone 或软键盘验收。

## 截图索引

每张 PNG 和 `metrics.json` 均在本目录中。

| 页面 | 设备 / 主题 | 截图 |
|---|---|---|
| Home | 440×956 Sakura | [iphone-home-sakura.png](./iphone-home-sakura.png) |
| 搜索结果 | 440×956 Sakura | [iphone-search-sakura.png](./iphone-search-sakura.png) |
| 空搜索结果 | 440×956 Sakura，隔离 mock | [iphone-search-empty-sakura.png](./iphone-search-empty-sakura.png) |
| 歌曲详情 / 预约 | 440×956 Sakura | [iphone-detail-sakura.png](./iphone-detail-sakura.png) |
| Player 首屏 | 440×956 Sakura | [iphone-player-sakura.png](./iphone-player-sakura.png) |
| Player 音量、音轨及字幕 | 440×956 Sakura | [iphone-player-controls-sakura.png](./iphone-player-controls-sakura.png) |
| Player 弹幕输入 | 440×956 Sakura | [iphone-player-danmaku-sakura.png](./iphone-player-danmaku-sakura.png) |
| Agent 离线 | 440×956 Sakura，隔离 mock 503 | [iphone-player-agent-offline-mock-sakura.png](./iphone-player-agent-offline-mock-sakura.png) |
| 活动队列 | 440×956 Sakura，隔离 mock | [iphone-queue-sakura.png](./iphone-queue-sakura.png) |
| My Page | 440×956 Sakura，隔离 mock | [iphone-my-sakura.png](./iphone-my-sakura.png) |
| 搜索结果窄屏 | 390×844 Sakura | [iphone-search-390-sakura.png](./iphone-search-390-sakura.png) |
| 详情窄屏 / CTA | 360×780 Sakura | [iphone-detail-360-sakura.png](./iphone-detail-360-sakura.png) |
| Home | 1440×900 Sakura | [desktop-home-sakura.png](./desktop-home-sakura.png) |
| Player | 1440×900 Sakura | [desktop-player-sakura.png](./desktop-player-sakura.png) |
| Player | 1440×900 Aurora | [desktop-player-aurora.png](./desktop-player-aurora.png) |

## 页面结构和实测结果

- **Home**：搜索框是主入口；桌面布局将搜索区与真实状态区域分栏，只有接口返回正在播放时才显示 Now Playing。440px mock 截图中搜索框为 408×68px，主内容高度 539px；桌面 Home 主内容宽 1024px。无真实最近搜索时不补造推荐内容。
- **Search**：顶部只有一个可编辑搜索框，摘要压缩为“DanMachi · 3件”，标题在 440px 和 390px 下保持单行。长媒体技术标签在列表中弱化，结果原始 `Song` 数据不变。返回滚动位置逻辑保留。
- **Detail**：原始文件名折叠；昵称提示紧邻点歌人输入框；评论和调音以轻量输入/选择控件呈现。提交按钮 sticky 在底部 Tab 上方。滚动至提交操作时，440px CTA 底边 y=880、Tab 顶边 y=893；360px CTA 底边 y=704、Tab 顶边 y=717；点歌人提示在 CTA 上方，不再被其覆盖。两种尺寸均保留 13px 间距。
- **Player**：Now Playing 和播放器控制合成一个主舞台；播放控制、进度、音量和轨道在首屏形成主要层级；字幕、音频延迟、升降 key 和弹幕向下展开。mock 的音轨/进度只是 UI 示例，不代表当前运行中的播放器。Agent 503 画面保留错误反馈，不把它显示为可控成功状态。
- **Queue**：用紧凑行展示顺序、歌曲、点歌人和状态；播放中与待播采用不同状态色；当前浏览器拥有的预约显示“你的预约”标记。历史不混入活动队列。截图中的两条记录为隔离 mock。
- **My Page**：参与者名称优先，昵称保存与设置入口紧凑化；预约/历史是主体内容，语言和主题保留在应用设置中。记录是隔离 mock，不涉及正式身份。
- **主题**：Sakura 使用粉色作为局部交互强调，不给每块内容重复描边；Aurora 通过背景、表面层次和蓝色强调区分播放器控制。
- **尺寸检查**：`metrics.json` 中全部截图均为 `horizontalOverflow: false`。360px 详情和 390px 搜索也没有横向溢出。Playwright 对 CTA 和底部导航分别断言，且检查点歌人提示与 CTA 不重叠。

## 优先级建议

### P0

未发现页面阻断、横向溢出或 CTA 被底部导航遮住的问题。此结论只覆盖本地隔离 mock 截图和自动化断言。

### P1

1. **iPhone 软键盘与预约 CTA**：本轮只验证静态视口。详情页使用 sticky CTA，在真实 Safari 键盘改变 visual viewport 时需要实机确认按钮仍可见、输入框仍可滚动；对应 [iphone-detail-sakura.png](./iphone-detail-sakura.png)。
2. **Player 长页的单手可达性**：音量、音轨和字幕接近首屏，延迟、升降 key 与弹幕需要向下滚动；对应 [iphone-player-controls-sakura.png](./iphone-player-controls-sakura.png)、[iphone-player-danmaku-sakura.png](./iphone-player-danmaku-sakura.png)。若现场常用延迟/调 key，可再考虑将这些控制收进可折叠的“音频调整”区域，但应以实际使用频率决定。
3. **实际播放错误状态**：离线画面来自隔离 mock 503，只能评估错误文案和控件禁用外观；部署环境的 Agent/mpv 错误码、恢复及命令结果需另行验证，见 [iphone-player-agent-offline-mock-sakura.png](./iphone-player-agent-offline-mock-sakura.png)。

### P2

1. **空闲 Home 的垂直空白**：没有真实 Now Playing 和最近搜索时，页面应保持干净，但在高屏手机和桌面仍会留下较多空白。不要用假榜单填充；可评估将房间/搜索连接状态收成一行，或保持克制空状态。对应 [iphone-home-sakura.png](./iphone-home-sakura.png)、[desktop-home-sakura.png](./desktop-home-sakura.png)。
2. **Queue 长列表定位**：本截图只含两条 mock 活动记录，尚未评估数十条记录时查找自己预约的速度和分页视觉。对应 [iphone-queue-sakura.png](./iphone-queue-sakura.png)。
3. **搜索空态长查询词**：空态保留完整查询词和零结果数，长关键词仍受单行输入框宽度约束；可后续检查输入聚焦后的末尾可见性。对应 [iphone-search-empty-sakura.png](./iphone-search-empty-sakura.png)。

## 未验证

- 真实公网或 LAN 部署页面及其缓存版本；本轮没有部署或重启任何服务。
- 真实 iPhone Safari / Android Chrome、safe-area 实际 inset、软键盘、PWA standalone、浏览器前进返回及设备字体差异。
- 正式 Agent/mpv 实时状态和播放命令；正式预约、Queue、数据库均未读取或写入。
- 长 Queue、真实多音轨媒体及有实际参与者历史的正式数据布局。
