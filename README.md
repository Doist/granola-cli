# Granola CLI

CLI for the [Granola](https://granola.ai) public API.

This CLI is optimized for both humans and coding agents:

- official Granola API only
- local synced cache for fast repeated queries
- human-readable default output
- `--json` / `--ndjson` / `--full` for structured agent use
- installable agent skills

## Installation

Requires Node 20.18.1+.

```bash
npm install -g @doist/granola-cli
```

## Agent Skills

Install skills for your coding agent:

```bash
granola skill install claude-code
granola skill install codex
granola skill install cursor
granola skill install gemini
granola skill install pi
granola skill install universal
```

Skills are installed to `~/<agent-dir>/skills/granola-cli/SKILL.md`.
The `universal` agent is compatible with agents that read from `~/.agents/`.

```bash
granola skill list
granola skill uninstall <agent>
```

## Uninstallation

First remove any installed skills:

```bash
granola skill uninstall <agent>
```

Then uninstall the CLI:

```bash
npm uninstall -g @doist/granola-cli
```

## Local Setup

```bash
git clone https://github.com/Doist/granola-cli.git
cd granola-cli
npm install
npm run build
npm link
```

## Authentication

Create a personal API key in the Granola desktop app:

1. Open `Settings → API`
2. Create a key
3. Run `granola auth login`
4. Paste the key when prompted

You can also pass the key directly:

```bash
granola auth login --token <api-key>
```

### Resolution order

API key resolution order:

1. `GRANOLA_API_KEY`
2. system credential manager / keychain
3. `~/.config/granola-cli/config.json`

By default, `granola auth login` stores the key in the system credential manager, with fallback to the config file when secure storage is unavailable.

Useful commands:

```bash
granola auth status
granola auth logout
```

## Cache and Sync Model

The CLI maintains a local cache under:

- `~/.cache/granola-cli/state.json`
- `~/.cache/granola-cli/notes/*.json`

`list`, `folders`, `search`, and `show` will run an incremental sync first unless you pass `--no-sync`.
A full sync is also triggered automatically on first use and periodically after that.

You can sync explicitly:

```bash
granola sync
granola sync --full
granola sync --json
```

## Commands

### List notes

```bash
granola list
granola list --limit 10
granola list --person "Alice"
granola list --folder "Leadership"
granola list --after 2026-04-01 --before 2026-04-30
granola list --json
granola list --ndjson --full
```

### List folders

Folder information is derived from each note's `folder_membership` metadata in the cached note payloads.

```bash
granola folders
granola folders --person "Alice"
granola folders --after 2026-04-01
granola folders --json
granola folders --ndjson
```

### Search notes

```bash
granola search "roadmap"
granola search "roadmap hiring"
granola search "pricing" --person "Alice"
granola search "pricing" --folder "Leadership"
granola search "pricing" --after 2026-04-01
granola search "pricing" --json
granola search "pricing" --ndjson --full
```

Search results explain why each note matched (`title`, `people`, `folders`, `summary`, `transcript`).

### Show a note

```bash
granola show <note-id>
granola show <note-id> --transcript
granola show <note-id> --json
granola show <note-id> --json --full
```

## Output Modes

Default output is human-readable.

Structured output options:

- `--json` — pretty JSON
- `--ndjson` — newline-delimited JSON for list-like outputs
- `--full` — include richer fields in structured output

For coding agents, prefer `--json` or `--ndjson`.

## Update and Changelog

```bash
granola update
granola update --check
granola update --channel
granola update switch --stable
granola update switch --pre-release
granola changelog
granola changelog -n 3
```

## Capability Boundaries

The Granola public API is intentionally limited. This CLI works around some of those limitations locally, but not all of them.

### What the API supports

- list notes
- get note details
- note summaries
- attendees
- transcripts
- folder membership on note detail payloads

### What the API does not provide directly

- server-side full-text search
- documented server-side folder browsing endpoints
- server-side attendee filtering
- webhooks
- write/update/delete note APIs

Because of that:

- search is local-cache based
- folder browsing/filtering is local-cache based
- repeated queries are fast after sync

### Plan requirements

Personal API keys require a Granola Business or Enterprise workspace.

## Development

```bash
npm install
npm run dev
npm run type-check
npm run lint:check
npm run format:check
npm test
npm run build
npm run sync:skill
```
