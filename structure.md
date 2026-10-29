``` 
flowchart TB
    subgraph Clients["① Web 客户端"]
        USER["React User Web<br/>搜索 · 预约 · 弹幕"]
        ADMIN["React Admin Web<br/>队列 · 播放控制 · 设置"]
        LEGACY["Legacy PHP User<br/>旧版页面兼容"]
    end

    subgraph Gateway["② Web 接入层 · Docker"]
        LAN["User Gateway / user-lan<br/>局域网 / 未来公网入口"]
        LOCAL["Admin Gateway<br/>本机管理入口"]
    end

    subgraph Backend["③ Node Backend · Docker"]
        API["Fastify API<br/>认证 · 请求校验 · API"]
        QUEUE["Queue Service<br/>预约 · 排序 · 调度 · 状态恢复"]
        SETTINGS["Settings / Participant<br/>播放模式 · 参与者 · 房间配置"]
        DB[("MySQL<br/>业务数据与历史")]
    end

    subgraph Host["④ Windows Host"]
        LAUNCHER["Agent Launcher<br/>启动 · 复用 · 停止"]

        subgraph Agents["Windows Agents"]
            MEDIA["Media Agent<br/>文件搜索 · 媒体路径解析"]
            PLAYER["Player Agent<br/>播放 · 暂停 · 音轨 · EOF"]
            DANMAKU["Danmaku Renderer<br/>弹幕显示 · 覆盖层"]
        end

        EVERYTHING["Everything<br/>Windows 文件索引"]
        MPV["mpv<br/>实际播放器"]
        FILES[("本地视频文件")]
    end

    USER --> LAN
    LEGACY --> LAN
    ADMIN --> LOCAL
    LAN --> API
    LOCAL --> API

    API --> QUEUE
    API --> SETTINGS
    QUEUE <--> DB
    SETTINGS <--> DB

    API <-->|"搜索请求 / 搜索结果"| MEDIA
    QUEUE <-->|"任务领取 / 播放事件"| PLAYER
    API <-->|"实时弹幕消息"| DANMAKU
    API <-->|"管理控制"| LAUNCHER

    LAUNCHER --> MEDIA
    LAUNCHER --> PLAYER
    LAUNCHER --> DANMAKU

    MEDIA --> EVERYTHING
    MEDIA --> FILES
    PLAYER --> MPV
    MPV --> FILES

    classDef client fill:#dbeafe,stroke:#2563eb,color:#1e40af
    classDef gateway fill:#e0e7ff,stroke:#6366f1,color:#3730a3
    classDef backend fill:#dcfce7,stroke:#16a34a,color:#166534
    classDef agent fill:#fef3c7,stroke:#d97706,color:#92400e

    class USER,ADMIN,LEGACY client
    class LAN,LOCAL gateway
    class API,QUEUE,SETTINGS,DB backend
    class LAUNCHER,MEDIA,PLAYER,DANMAKU agent
    ```