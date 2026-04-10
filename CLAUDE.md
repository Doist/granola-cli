# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Commands

```sh
npm install
npm run build
npm run dev
npm run type-check
npm run lint:check
npm run lint:write
npm run format
npm run format:check
npm test
npx vitest run src/lib/search.test.ts
```

After building, `npm link` makes the `granola` binary available globally.

## Architecture

ESM-only TypeScript CLI using Commander.js.

### Command pattern

Each file in `src/commands/` exports a `registerXCommand(program)` function.
Commands should stay thin: parse CLI input, call `lib/*`, and format output.

### Core modules

- `src/lib/api.ts`: official Granola API client
- `src/lib/auth.ts`: API-key resolution and secure-store/config persistence
- `src/lib/cache.ts`: local cache layout, note indexing, sync orchestration
- `src/lib/search.ts`: local filtering, scoring, folder aggregation
- `src/lib/transcript.ts`: transcript normalization and human formatting
- `src/lib/output.ts`: human/json/ndjson output helpers
- `src/lib/update-config.ts`: stable vs pre-release update-channel storage
- `src/lib/skills/*`: installable coding-agent skill framework

### Product boundaries

- official API only
- read-only
- local-cache search model
- folder support is derived from note detail payloads (`folder_membership`)
- no repo-local `.env` support in this standalone CLI

## Testing

Tests are colocated next to source files and end with `.test.ts`.

Common patterns:

- mock command dependencies with `vi.mock()`
- capture `console.log` / `console.error` output in arrays
- use `program.exitOverride()` + `program.parseAsync()` for command tests
- keep core logic testable without hitting the network or keychain

## Skill content

`src/lib/skills/content.ts` is the source of truth for the installable skill.

Whenever commands or flags change:

1. update `src/lib/skills/content.ts`
2. run `npm run build && npm run sync:skill`
3. ensure `skills/granola-cli/SKILL.md` stays in sync

CI will fail if the generated skill file is stale.

## Style

- OXC formatting and linting
- TypeScript strict mode
- no unnecessary abstractions
- prefer small focused modules over one large script
