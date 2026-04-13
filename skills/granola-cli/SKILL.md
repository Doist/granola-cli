---
name: granola-cli
description: "Search and inspect Granola meeting notes, folders, summaries, attendees, and transcripts via the granola CLI"
---

# Granola CLI (granola)

Use this skill when the user wants to inspect or search Granola notes and transcripts.

The CLI uses the official Granola public API plus a local synced cache.

## Quick Reference

- `granola search "query"` - Search cached notes
- `granola list` - List recent cached notes
- `granola folders` - List folders inferred from cached notes
- `granola show <note-id>` - Show a cached note
- `granola show <note-id> --transcript` - Show a note with transcript
- `granola sync` - Refresh the local cache

## Important Behavior

- `list`, `search`, `folders`, and `show` may run an implicit sync first unless you pass `--no-sync`.
- Granola does not expose server-side full-text search or a documented folders endpoint, so search and folder filtering run against the local cache.
- Folder filtering is derived from each note's `folder_membership` metadata.
- `--person` and `--folder` use case-insensitive substring matching.
- Date-only filters like `--after 2026-04-01` use local day boundaries.

## Output Formats

Prefer structured output for agent use:

- `--json` - pretty JSON
- `--ndjson` - one JSON object per line for list-like outputs
- `--full` - include richer fields in structured output

## Commands

### Authentication
```bash
granola auth login
granola auth status
granola auth logout
```

### Sync
```bash
granola sync
granola sync --full
granola sync --json
```

### Notes
```bash
granola list
granola list --limit 10
granola list --person "Alice"
granola list --folder "1:1"
granola list --after 2026-04-01 --before 2026-04-30
granola list --json
granola list --ndjson --full
```

### Folders
```bash
granola folders
granola folders --person "Alice"
granola folders --after 2026-04-01
granola folders --json
granola folders --ndjson
```

### Search
```bash
granola search "roadmap"
granola search "roadmap hiring"
granola search "roadmap" --person "Alice"
granola search "roadmap" --folder "Leadership"
granola search "pricing" --after 2026-04-01
granola search "pricing" --json
granola search "pricing" --ndjson --full
```

### Show
```bash
granola show <note-id>
granola show <note-id> --transcript
granola show <note-id> --json
granola show <note-id> --json --full
```

### Skill installation
```bash
granola skill install claude-code
granola skill install codex
granola skill install cursor
granola skill install gemini
granola skill install pi
granola skill install universal
granola skill list
granola skill uninstall <agent>
```

### Update & changelog
```bash
granola update
granola update --check
granola update --channel
granola update switch --stable
granola update switch --pre-release
granola changelog
granola changelog -n 3
```

## Examples

### Find a note and inspect the transcript
```bash
granola search "customer pricing" --json | jq -r '.results[0].id'
granola show <note-id> --transcript
```

### List notes for a specific folder
```bash
granola list --folder "Leadership"
```

### Search for all notes involving a person
```bash
granola search "roadmap" --person "Alice"
```
