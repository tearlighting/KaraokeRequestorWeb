# Windows Player Agent

The host Agent is deliberately outside Docker: it owns the Windows GUI player process. Phase 9 targets mpv's Windows named-pipe JSON IPC. PotPlayer 26.06.22.0 was inspected on the development host; its installed `CmdLine64.txt` documents opening a supplied file and playlist switches, but no supported status, pause/resume API, or end-of-file event. No PotPlayer compatibility is claimed.

## Host setup

1. Install an official Windows mpv build and keep its `mpv.exe` path. The development host has mpv `v0.41.0-244-gaf9c81fa1` at `C:\Program Files\MPV Player\mpv.exe`; it is intentionally not added to global `PATH`.
2. Place a short test video below a media directory, for example `D:\KaraokeMedia\agent-test.mp4`. The current acceptance clip is `D:\project\yukari\test-media\agent-test.mp4`, outside the repository.
3. From the repository root run `node docker/prepare-player-agent-token.mjs`, then start Compose. The generated token is ignored under `.local/`; never copy it into Git or chat.
4. For guided local setup, run `scripts/windows/Configure-PlayerAgent.cmd`. It opens a folder picker for the allowed media root, a file picker for `mpv.exe`, and an optional test-video picker constrained to that root. It asks for an exact Legacy POSIX source prefix; leave this blank to keep queue paths unmapped. The settings file is `%LOCALAPPDATA%\YukariPlayerAgent\agent-config.json`; it contains local paths only, never the Agent credential. To edit mappings later, rerun the wizard or edit that local file. Do not enter a guessed POSIX source path.

   In PowerShell, launch the Agent manually if desired:

```powershell
$env:YUKARI_API_URL = 'http://127.0.0.1:3000'
$env:YUKARI_PLAYER_AGENT_TOKEN = (Get-Content .local/player-agent-token -Raw).Trim()
$env:MPV_PATH = 'C:\Program Files\MPV Player\mpv.exe'
$env:PLAYER_MEDIA_ROOT = 'D:\project\yukari\test-media'
$env:PLAYER_TEST_VIDEO = 'agent-test.mp4'
# Queue paths stored by PHP may be POSIX paths from the Docker mount. Map only
# known Legacy roots to directories beneath PLAYER_MEDIA_ROOT; never guess.
$env:PLAYER_PATH_MAPPINGS = '[{"source":"/verified/posix/library","target":"D:\\KaraokeMedia"}]' # replace both with verified paths
# Optional: keep the single-instance lock in a chosen writable directory.
# Defaults to %LOCALAPPDATA%\YukariPlayerAgent.
# $env:YUKARI_PLAYER_AGENT_LOCK_DIR = 'D:\YukariPlayerAgent'
npm.cmd --prefix apps/player-agent ci
npm.cmd --prefix apps/player-agent run build
npm.cmd --prefix apps/player-agent start
```

For an idle connectivity check before a video is available, omit `PLAYER_TEST_VIDEO`. The Agent can authenticate and report connected/idle; Fastify and admin-web disable test-task creation until the Agent reports a valid video configuration. After placing `agent-test.mp4` in the configured media root, restart the Agent with `PLAYER_TEST_VIDEO='agent-test.mp4'`.

Only the relative test-video path is accepted. Queue media paths may be relative/Windows absolute paths already below the root, or POSIX absolute paths covered by `PLAYER_PATH_MAPPINGS`. Each mapping is an explicit JSON `{source,target}` entry: `source` is a normalized Legacy POSIX directory and `target` must resolve beneath `PLAYER_MEDIA_ROOT`. The Agent rejects unmapped paths, traversal, missing files, and symlinks whose real target escapes the allowed root. The mapping is local Agent configuration; clients cannot supply or override it. The Agent starts mpv with a fixed argument vector (`shell:false`). The Windows launcher reads local settings automatically, keeps credentials in `.local/player-agent-token`, logs to `%LOCALAPPDATA%\YukariPlayerAgent\logs`, and stops only the recorded Agent via its local named pipe.

In admin-web → System, use “Start local test video”, then Pause, Resume or Stop. The task reaches `playing` only after mpv JSON IPC reports that exact path loaded, non-idle and unpaused. `completed` is reported only on mpv's `end-file` event with reason `eof`. Stop is a distinct failed/stopped outcome, never a completed song. The public playback view reveals only connected/playback/active booleans.

## Scope and recovery

Phase 9 test-video tasks and Agent heartbeat remain in the separate `player_agent_state` volume. Formal queue tasks and their append-only history are owned by Fastify in the existing queue SQLite database. A single Agent process is enforced per Windows profile. Formal tasks are fenced by unique IDs, Agent IDs and leases; transient commands remain queued until an Agent reports the observed result. If the API is unreachable during an active task, the Agent stops rather than continue without an authoritative task, then reconnects. After an uncertain server restart, the task is not replayed automatically. Re-claimed tasks are checked against mpv's actual path/status before opening again.

Formal queue playback is opt-in. Legacy `playmode=1` uses FIFO auto-advance. In Legacy `playmode=2`, Fastify can be armed in manual mode and an administrator must click **Start next request** for every song; after real EOF it waits for the next click. This runtime strategy never writes the saved Legacy `playmode`. Mode 3 playlist registration and modes 4/5 random selection remain unsupported. The Agent validates mapped host paths and reports actual mpv state; it does not choose queue order or update `requesttable` directly. Fastify owns claiming and status projection. Legacy search still supplies `fullpath`, and no concrete production mapping has been configured or inferred. Admin **Check media** asks the authenticated Agent to resolve the database path, then returns only `playable`, `path_unmapped`, `file_missing`, or `invalid_path`; an offline Agent is shown separately. Path existence does not migrate karaoke-specific track/key/volume/delay/comment/progress behavior. Do not enable production autoplay until the host mapping is reviewed and the separate Windows Legacy playback manager cannot compete with Fastify.

mpv's JSON IPC provides command replies, observable properties and end-file events over a local Windows named pipe. Keep that pipe local; mpv documents that IPC is unauthenticated and insecure by design. Fastify is the only network boundary and the Agent authenticates every poll/report with its independent bearer credential.
