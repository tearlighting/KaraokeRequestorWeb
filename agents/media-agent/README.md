# Media Agent module

This folder owns the Windows-local media search adapter, currently Everything 1.4 HTTP integration (`src/everything.ts`). It is a module hosted inside the single `agents/player-agent` process, not a second daemon: Player Agent polls Fastify, runs bounded searches here, validates results against the configured media root, and reports them back. This keeps Everything unavailable to Docker and browsers while making media search ownership visible in the repository layout.

Build, configuration, credentials, startup and lifecycle remain owned by `agents/player-agent`; see its README. Do not add another polling process or expose Windows paths to clients.
