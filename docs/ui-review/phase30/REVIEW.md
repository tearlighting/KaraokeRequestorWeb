# Phase 30 User Web 视觉与交互审计

## 测试环境与数据来源

- 测试地址：`https://yukari.tearlighting.com/user/`（Cloudflare Tunnel 公网入口）。截图由本机 Microsoft Edge + Playwright 实际渲染；不是 HTML mock 或设计稿。
- 测试日期：2026-10-30（本机时区 Asia/Tokyo）。进入页面后等待 React 页面、网络请求和 `document.fonts.ready`。Playwright 视口：iPhone 仿真 440×956、Android 仿真 412×915、桌面 1440×900 CSS px。
- 页面内容使用现场 API 数据。搜索 `DanMachi` 得到 5 条 Everything 结果；空结果页使用一个真实无匹配关键词；队列当时为 0 条活动预约；我的页面使用全新隔离浏览器上下文，没有昵称/个人预约。歌曲详情通过真实搜索结果点击进入，只查看表单，没有提交预约。播放器未发送控制命令。
- `iphone-player-agent-offline-simulated.png` 仅模拟只读 Agent 状态 API 的离线响应，用来查看错误态；不是生产 Agent 离线状态。
- 所有截图生成时字体状态为 `loaded`，各视口均未检测到横向溢出。浏览器设备仿真不等于真实 iPhone Safari / Android Chrome。
- 后续补测时公网域名出现 `ERR_NAME_NOT_RESOLVED`，系统 DNS 查询也未返回记录。已有截图是在这一故障前通过公网真实页面生成的。故未能补得真正聚焦输入框的截图；现有首页截图不应被当作键盘弹出画面。

## 截图索引

所有文件位于 `docs/ui-review/phase30/`：

| 截图 | 视口 / 主题 | 页面与状态 |
|---|---|---|
| [iphone-home-sakura.png](./iphone-home-sakura.png) | 440×956，Sakura | 首页搜索，真实线上页面 |
| [iphone-search-sakura.png](./iphone-search-sakura.png) | 440×956，Sakura | `DanMachi` 搜索结果，5 条真实结果 |
| [iphone-detail-sakura.png](./iphone-detail-sakura.png) | 440×956，Sakura | 从搜索结果进入的歌曲详情及预约表单；未提交 |
| [iphone-detail-bottom-sakura.png](./iphone-detail-bottom-sakura.png) | 440×956，Sakura | 同一详情页滚到底部，检查预约主按钮与 Tab 遮挡 |
| [iphone-player-sakura.png](./iphone-player-sakura.png) | 440×956，Sakura | Player 当前无活动播放任务 |
| [iphone-player-agent-offline-simulated.png](./iphone-player-agent-offline-simulated.png) | 440×956，Sakura | 仅 Agent 离线响应被安全模拟 |
| [iphone-queue-sakura.png](./iphone-queue-sakura.png) | 440×956，Sakura | 线上活动队列为空 |
| [iphone-my-sakura.png](./iphone-my-sakura.png) | 440×956，Sakura | 新隔离浏览器，无参与者身份/个人记录 |
| [iphone-search-empty-sakura.png](./iphone-search-empty-sakura.png) | 440×956，Sakura | 真实零结果状态 |
| [android-player-sakura.png](./android-player-sakura.png) | 412×915，Sakura | Android Chrome 设备参数仿真，Player 空闲状态 |
| [desktop-home-sakura.png](./desktop-home-sakura.png) | 1440×900，Sakura | 桌面首页 |
| [desktop-player-aurora.png](./desktop-player-aurora.png) | 1440×900，Aurora | 桌面深色 Player 空闲状态 |
| [metrics.json](./metrics.json) | — | DOM bounding box、文档尺寸、字体和溢出测量 |

## 页面结构与测量

- **Home**：顶部 56px 品牌栏；移动主内容从 y=56 开始，首页标题位于 y=86，搜索框 x=16、y=144、宽 408、高 58。Sakura 首页的主要内容到 y≈392 即结束，440×956 视口下其后有约 501px 空白至底部 Tab。
- **Search Results**：顶部保留可编辑搜索框；结果表面含标题/结果数、歌曲列表和“修改搜索”入口。5 条结果紧凑排列，无横向溢出。但在 440px 下标题“検索結果”宽约 72px、高 56px，实际折成两行；右侧关键词和“5件中5件”说明挤在同一标题行。
- **Song Detail**：显示弱化后的媒体标题、可展开原文件名、昵称/评论/升调/隐私选项和预约按钮。长原文件名在展开区可读。通过实际 DOM 测得初始滚动位置主按钮 y=872…917，而固定 Tab 从 y=893 开始，按钮约 24px 被 Tab 覆盖；页面滚动到底（scrollY=78）后按钮落在 y=794…839，完全可见。`iphone-detail-bottom-sakura.png` 是滚动后的证据。
- **Player**：移动端播放器面板 x=16、y=128、宽 408、高 178；操作面板 `.user-player-controls` x=16、y≈322、宽 408、高 178。实时线上状态当时没有活动任务，所以没有可用音轨/字幕选择和真实播放控制状态；空闲页不会证明播放中的控件效果。Agent 离线画面是单独模拟态。
- **Queue**：页面明确展示房间活动队列，但当时真实活动记录数为 0，因此只能审计空态，不能评估长队列密度或定位某位参与者预约的效率。
- **My Page**：显示昵称/参与者和语言、主题设置区域。截图是新浏览器会话，昵称和个人预约为空；不代表已有用户资料丢失。
- **桌面**：导航移至顶部右侧，底部 Tab 隐藏；内容最大宽度约 1024px 并居中（x=208）。桌面首页主要内容到 y≈380，900px 视口下仍有约 520px 空白。桌面 Player 空闲卡片宽约 968px。

## UX 问题与建议

### P0

目前没有发现会阻断页面访问或导致横向溢出的 P0 问题。此项只针对本次真实空闲/搜索场景，不代表预约写入、真实播放或真实设备已验收。

### P1

1. **歌曲详情的预约按钮被底部导航遮挡**：见 `iphone-detail-sakura.png` 和滚到底部的 `iphone-detail-bottom-sakura.png`。iPhone 仿真 440×956 下主按钮初始底边 y≈917，底部 Tab 顶边 y=893，覆盖约 24px；用户刚进入详情时不能完整看到主操作。建议增加详情表单底部滚动空间，或调整页面滚动定位，使提交按钮默认完全位于 Tab 上方。滚到底部可以操作，但这增加了误触/找按钮成本。
2. **搜索结果标题与结果摘要在窄屏互相挤压**：`iphone-search-sakura.png`、`iphone-search-empty-sakura.png`。在 440px 宽视口标题都折成两行，右侧查询词/结果数显示成小而密的文字。建议窄屏改为标题和摘要上下排列，或让结果数独立成短徽标；保留查询词完整可读。

### P2

1. **首页垂直空间利用率低**：`iphone-home-sakura.png` 与 `desktop-home-sakura.png`。移动主内容 y≈392 后到 Tab 前剩约 501px 空白，桌面主内容到 y≈380 后还剩约 520px。可以收紧首屏高度，或仅放置真实有用的房间/当前播放信息；不要填入虚构排行榜。
2. **未匹配的长搜索词在输入框中被截断**：`iphone-search-empty-sakura.png`。空结果态保留输入框和修改搜索入口，但长词单行显示时末尾不可见，用户难以快速确认当前查询。建议焦点时确保光标和末尾可见，或者在结果摘要提供可换行的完整关键词。
3. **Queue 与 My Page 当前截图不足以评估有数据时的密度**：`iphone-queue-sakura.png`、`iphone-my-sakura.png` 分别是空活动队列和新用户会话。这是数据条件限制，不应据空态得出列表设计结论。后续可用隔离测试实例/数据补测有预约、有个人历史的状态；不要向正式队列插入测试记录。
4. **Player 控件的关键状态缺少真实活跃任务画面**：`iphone-player-sakura.png` 和 `desktop-player-aurora.png` 均为空闲；离线图是模拟。需要在隔离环境或专用测试 Agent 有安全播放任务时再审计音量、暂停、轨道、字幕、进度和弹幕的可见性，不在正式实例制造播放状态。

## 未验证项目

- 真实 iPhone Safari 与 Android Chrome；尤其软键盘弹出、视觉视口变化、safe-area 实际 inset 和 PWA standalone 模式。
- 输入框真实聚焦状态的截图。本轮首页截图不显示系统键盘；公网 DNS 在补拍时失败，不能把桌面设备仿真当作软键盘验收。
- 带真实播放任务时的 mpv 音轨、字幕、音量、进度及弹幕控件；没有操作 Agent 或 mpv。
- 有多条活动预约时的 Queue 密度、筛选/分页和个人预约定位；正式队列当时为空。
- 有昵称及历史的 My Page 状态；截图使用空会话。
- 公网入口当前可用性在最后补测时受 DNS 解析失败影响；本报告中的已有页面截图和数据来自此前成功的公网访问时段。
