# Windows agents

The Windows-host integration is organized by responsibility:

- `player-agent/` is the single long-running process. It authenticates to Fastify, runs mpv playback, reports status, and hosts local media-search jobs.
- `media-agent/` contains the Everything HTTP adapter and media-root/path validation used by that process.

Despite the two module directories, only one polling process is started. This avoids competing identities, heartbeats, and duplicate searches. See [Player Agent setup](player-agent/README.md).
