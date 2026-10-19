# Windows Player Agent

The host Agent is deliberately outside Docker: it owns the Windows GUI player process. Phase 9 targets mpv's Windows named-pipe JSON IPC. PotPlayer 26.06.22.0 was inspected on the development host; its installed `CmdLine64.txt` documents opening a supplied file and playlist switches, but no supported status, pause/resume API, or end-of-file event. No PotPlayer compatibility is claimed.

## Host setup

1. Install an official Windows mpv build and keep its `mpv.exe` path. The development host has mpv `v0.41.0-244-gaf9c81fa1` at `C:\Program Files\MPV Player\mpv.exe`; it is intentionally not added to global `PATH`.
2. Place a short test video below a media directory, for example `D:\KaraokeMedia\agent-test.mp4`. The current acceptance clip is `D:\project\yukari\test-media\agent-test.mp4`, outside the repository.
3. From the repository root run `node docker/prepare-player-agent-token.mjs`, then start Compose. The generated token is ignored under `.local/`; never copy it into Git or chat.
4. In PowerShell, launch the Agent with the same token and explicit local paths:

```powershell
$env:YUKARI_API_URL = 'http://127.0.0.1:3000'
$env:YUKARI_PLAYER_AGENT_TOKEN = (Get-Content .local/player-agent-token -Raw).Trim()
$env:MPV_PATH = 'C:\Program Files\MPV Player\mpv.exe'
$env:PLAYER_MEDIA_ROOT = 'D:\project\yukari\test-media'
$env:PLAYER_TEST_VIDEO = 'agent-test.mp4'
# Optional: keep the single-instance lock in a chosen writable directory.
# Defaults to %LOCALAPPDATA%\YukariPlayerAgent.
# $env:YUKARI_PLAYER_AGENT_LOCK_DIR = 'D:\YukariPlayerAgent'
npm.cmd --prefix apps/player-agent ci
npm.cmd --prefix apps/player-agent run build
npm.cmd --prefix apps/player-agent start
```

For an idle connectivity check before a video is available, omit `PLAYER_TEST_VIDEO`. The Agent can authenticate and report connected/idle; Fastify and admin-web disable test-task creation until the Agent reports a valid video configuration. After placing `agent-test.mp4` in the configured media root, restart the Agent with `PLAYER_TEST_VIDEO='agent-test.mp4'`.

Only the relative test-video path is accepted. The Agent resolves the media root and target through filesystem real paths, rejects traversal/symlinks outside the root, and starts mpv with a fixed argument vector (`shell:false`). No browser input can choose a player executable or arbitrary absolute path. The API task contains only a test-task ID, never a host path.

In admin-web → System, use “Start local test video”, then Pause, Resume or Stop. The task reaches `playing` only after mpv JSON IPC reports that exact path loaded, non-idle and unpaused. `completed` is reported only on mpv's `end-file` event with reason `eof`. Stop is a distinct failed/stopped outcome, never a completed song. The public playback view reveals only connected/playback/active booleans.

## Scope and recovery

The API uses a separate `player_agent_state` Docker volume for atomic task/status snapshots; it does not add or migrate queue SQLite schema. A single Agent process is enforced per Windows profile. Tasks are fenced by unique IDs and assigned Agent IDs; transient commands remain queued until an Agent reports the resulting status. If the API is unreachable during an active task, the Agent stops rather than continue without an authoritative task, then reconnects. Re-claimed tasks are checked against mpv's actual path/status before opening again.

This is a controlled test-video task only. It does not read/modify queue records, set `requesttable.nowplaying`, or start the next reservation. Existing PHP/MPC-BE playback lifecycle and admin controls remain unchanged. Auto-cutover requires a real host video test plus explicit mapping of Legacy Windows media paths to the Agent media root, queue status transaction semantics, old playback-mark/volume/progress side effects, and confirmation that mpv EOF behavior is sound with the actual karaoke files.

mpv's JSON IPC provides command replies, observable properties and end-file events over a local Windows named pipe. Keep that pipe local; mpv documents that IPC is unauthenticated and insecure by design. Fastify is the only network boundary and the Agent authenticates every poll/report with its independent bearer credential.
