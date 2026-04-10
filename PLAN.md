# Granola CLI Implementation Plan

## Goal

Create a standalone repository for `granola-cli` at `../granola-cli`, following the overall structure, tooling, release setup, and agent-skill model of `../outline-cli`, but implementing the Granola CLI behavior we have already built in `cto-pa`.

This should become a small, well-structured, agent-oriented CLI that uses the **official Granola public API**, keeps a **local synced cache**, and offers **human-friendly output by default** with **machine-friendly structured output** for agent use.

## Primary reference inputs

This project should be implemented by combining two sources of truth:

1. **Repository/setup reference:** `../outline-cli`
    - use it as the template for repo shape, TypeScript setup, linting, formatting, testing, skill installation, CI, and release automation
    - mimic the architecture and developer ergonomics, not the Outline-specific feature set

2. **Granola product/functionality reference:** `cto-pa/scripts/granola.js` and `cto-pa/scripts/lib/granola-auth.js`
    - port the current working Granola CLI behavior into proper TypeScript modules
    - preserve the UX improvements already made there

## Explicit product decisions

These are already decided and should not be re-litigated during implementation unless requirements change.

### API and data model

- Use the **official Granola public API only**.
- Do **not** use private or reverse-engineered Granola endpoints.
- Do **not** depend on local desktop app auth/session files.
- Granola is read-only in this CLI.
- Folder support is **cache-derived** from `folder_membership` found on note detail payloads.
- Search/filter behavior is fundamentally **local-cache based**, not server-side.

### Auth and storage

- Auth storage precedence should be:
    1. `GRANOLA_API_KEY` env var
    2. system credential store / keychain
    3. `~/.config/granola-cli/config.json`
- Config should live in `~/.config/granola-cli/config.json`.
- Cache should live in `~/.cache/granola-cli/`.
- Do **not** support repo-local `.env` files in the standalone CLI.
- Do **not** keep cache under a project directory.

### UX

- Default output should be optimized for humans.
- Structured output should be optimized for agents/scripts.
- Human output should keep IDs/emails secondary, not dominant.
- Search output should explain why a result matched.
- Implicit sync should be visible.
- Transcript rendering should be readable.
- Folder browsing/filtering should feel seamless even though the API lacks a dedicated folders endpoint.

### Project structure and quality

- Match `outline-cli` closely for overall setup and repo structure.
- Use colocated tests (`*.test.ts`) next to source files instead of `__tests__/`.
- Include proper README, linting, formatting, tests, GitHub Actions, release automation, and agent skills.
- Include **in-CLI self-update and changelog support**, similar to `outline-cli`.

## Non-goals for the first implementation

These are out of scope unless implementation naturally makes them trivial.

- Write/update/delete note operations
- Webhooks or push sync
- Server-side search abstractions that do not exist in the API
- Granola desktop app integration
- Project-local secrets management
- Fancy indexing/ranking systems beyond straightforward local search scoring
- Large plugin architecture or extension system inside the CLI itself

## Functional scope for v1

### Authentication

- `granola auth login`
- `granola auth status`
- `granola auth logout`

### Data sync and inspection

- `granola sync [--full]`
- `granola list [--person <text>] [--folder <text>] [--after <date>] [--before <date>] [--limit <n>]`
- `granola folders [--person <text>] [--after <date>] [--before <date>] [--limit <n>]`
- `granola search <query> [--person <text>] [--folder <text>] [--after <date>] [--before <date>] [--limit <n>]`
- `granola show <note-id> [--transcript]`

### Agent skills

- `granola skill install <agent>`
- `granola skill uninstall <agent>`
- `granola skill list`

### Update and changelog

- `granola update`
- `granola update --check`
- `granola update --channel`
- `granola update switch --stable`
- `granola update switch --pre-release`
- `granola changelog`
- `granola changelog -n <count>`

## Output model

Adopt the same general output strategy as `outline-cli`.

### Human-readable output

Default mode should be concise and scan-friendly.

Examples of behavior to preserve from the prototype:

- dates shown in local, human-readable form
- people shown by name by default
- emails shown mainly in `show` or structured output
- IDs shown as secondary metadata, not inline clutter
- sync banners shown when commands auto-sync
- search results show matched fields
- `show --transcript` uses speaker/turn formatting rather than flattened text

### Structured output

Add the same style of agent-friendly output used in `outline-cli`:

- `--json` for pretty JSON
- `--ndjson` for newline-delimited JSON on list-like outputs
- `--full` to include all fields instead of a reduced essential shape

Recommendation:

- support `--json` on all commands that return data
- support `--ndjson` at least on `list`, `folders`, and `search`
- support `--full` for `list`, `folders`, `search`, and `show`

## Repository structure

Proposed structure:

```text
granola-cli/
  .github/
    workflows/
      check-semantic-pull-request.yml
      check-skill-sync.yml
      lint.yml
      release.yml
      test.yml
  .gitignore
  .nvmrc
  .oxfmtrc.json
  .oxlintrc.json
  CHANGELOG.md
  CLAUDE.md
  CONTRIBUTING.md
  lefthook.yml
  package-lock.json
  package.json
  PLAN.md
  README.md
  release.config.js
  scripts/
    check-skill-sync.js
    postinstall.js
    sync-skill.js
  skills/
    granola-cli/
      SKILL.md
  src/
    index.ts
    postinstall.ts
    commands/
      auth.ts
      auth.test.ts
      changelog.ts
      changelog.test.ts
      folders.ts
      folders.test.ts
      list.ts
      list.test.ts
      search.ts
      search.test.ts
      show.ts
      show.test.ts
      skill.ts
      sync.ts
      sync.test.ts
      update/
        action.ts
        action.test.ts
        index.ts
        switch.ts
        switch.test.ts
    lib/
      api.ts
      api.test.ts
      auth.ts
      auth.test.ts
      cache.ts
      cache.test.ts
      errors.ts
      output.ts
      output.test.ts
      search.ts
      search.test.ts
      transcript.ts
      transcript.test.ts
      types.ts
      update-config.ts
      update-config.test.ts
      skills/
        content.ts
        create-installer.ts
        create-installer.test.ts
        index.ts
        types.ts
        update-installed.ts
    transport/
      fetch-with-retry.ts
      fetch-with-retry.test.ts
      http-dispatcher.ts
      http-dispatcher.test.ts
  tsconfig.json
```

This is intentionally very close to `outline-cli`, but with Granola-specific commands and with colocated tests.

## Tooling and config plan

### `package.json`

Use `outline-cli` as the model.

Expected characteristics:

- package name: `@doist/granola-cli`
- ESM package (`"type": "module"`)
- executable binary: `granola`
- public npm publishing with provenance
- Node engine aligned with `outline-cli`
- standard scripts for build/typecheck/lint/format/test/postinstall/skill sync
- `prepublishOnly` should at least build and test

Likely scripts:

- `build`
- `dev`
- `type-check`
- `lint:check`
- `lint:write`
- `format`
- `format:check`
- `test`
- `test:watch`
- `postinstall`
- `check:skill-sync`
- `sync:skill`
- `prepublishOnly`

### Dependencies

Copy only what is justified.

Likely runtime dependencies:

- `chalk`
- `commander`
- `undici`
- `yocto-spinner`
- `@napi-rs/keyring`

Likely dev dependencies:

- `typescript`
- `vitest`
- `oxlint`
- `oxfmt`
- `lefthook`
- `semantic-release`
- `@semantic-release/changelog`
- `@semantic-release/git`
- `conventional-changelog-conventionalcommits`
- `@types/node`

Do **not** copy runtime deps that are Outline-specific and not needed here, such as:

- `open`
- `marked`
- `marked-terminal`

### Formatting and linting

Copy from `outline-cli` with minimal changes:

- `.oxlintrc.json`
- `.oxfmtrc.json`
- `lefthook.yml`

If no repo-specific rule changes are needed, keep them essentially identical.

### TypeScript config

Use the same general compiler settings as `outline-cli`:

- `target: ES2022`
- `module: NodeNext`
- `moduleResolution: NodeNext`
- `strict: true`
- declaration output
- source maps

Important change:

- exclude `src/**/*.test.ts` instead of `src/__tests__`

### GitHub Actions

Start with the same core workflow set as `outline-cli`:

- lint
- test
- semantic PR title check
- skill sync check
- release

For release automation:

- use semantic-release, same as `outline-cli`
- support stable (`main`) and pre-release (`next`) branches
- publish to npm with provenance
- generate GitHub releases
- update `CHANGELOG.md` only on stable releases

Pragmatic note:

- `outline-cli` includes a Twist announcement step
- only keep that if the new repo is expected to announce releases there and the required secrets/channel are available
- otherwise omit it initially to avoid broken or noisy release plumbing

### Lockfiles

Use npm as the source of truth.

- commit `package-lock.json`
- do **not** introduce `pnpm-lock.yaml` unless there is an explicit reason to support pnpm as a first-class workflow

## Architecture plan

The prototype in `cto-pa/scripts/granola.js` is functionally good but structurally monolithic. The standalone project should split it into small modules with clear ownership.

### CLI entrypoint

#### `src/index.ts`

Responsibilities:

- create Commander program
- register all commands
- add global help text for agent users
- add `--no-spinner`
- handle top-level async error exit behavior

### Commands

Each command module should follow the `outline-cli` pattern:

- export `registerXCommand(program)`
- keep parsing and CLI wiring local to the command
- delegate logic to `lib/*`
- keep output formatting either in the command or a focused helper

Planned commands:

- `src/commands/auth.ts`
- `src/commands/sync.ts`
- `src/commands/list.ts`
- `src/commands/folders.ts`
- `src/commands/search.ts`
- `src/commands/show.ts`
- `src/commands/skill.ts`
- `src/commands/changelog.ts`
- `src/commands/update/*`

### Core libraries

#### `src/lib/auth.ts`

Port the current Granola auth logic from `scripts/lib/granola-auth.js`, but make it typed and reusable.

Responsibilities:

- config path resolution
- keychain integration via `@napi-rs/keyring`
- read/save/clear API key
- auth source detection
- login validation support
- update-channel storage integration (shared config file)

Design notes:

- auth config and update channel should coexist cleanly in one config file
- preserve secure-store-first behavior
- allow env override without writing env credentials back into config

#### `src/lib/api.ts`

Encapsulate all official Granola API access.

Responsibilities:

- API client creation
- request building
- auth header handling
- rate limiting
- error normalization
- note list and note detail methods
- optional retry/backoff for network failures and rate limits

Recommendation:

- do not embed command-specific behavior here
- keep it as a small, typed API client

#### `src/lib/cache.ts`

Own the local cache and sync model.

Responsibilities:

- cache directory layout
- state file load/save
- cached note load/write/remove
- sync orchestration inputs/outputs
- note summary extraction for index/state
- folder metadata extraction from `folder_membership`

Important note:

Because the standalone CLI uses a **new global cache path**, it does **not** need to preserve on-disk compatibility with the old `cto-pa/.cache/granola` cache. That means the first standalone version can start with a clean schema and avoid carrying migration complexity that only existed for the prototype.

Still, the code should be written so future schema migrations are possible.

#### `src/lib/search.ts`

Pure local query logic.

Responsibilities:

- person/date/folder filtering
- local scoring for search queries
- matched-field explanations
- snippet generation
- folder aggregation for `granola folders`

This should be testable without touching the filesystem.

#### `src/lib/transcript.ts`

Transcript normalization and rendering.

Responsibilities:

- flatten transcript for full-text search fallback
- extract transcript segments from loose API shapes
- speaker/timestamp formatting
- readable transcript output for `show --transcript`

#### `src/lib/output.ts`

Copy the general pattern from `outline-cli`.

Responsibilities:

- human output
- JSON output
- NDJSON output
- reduced vs full field selection
- reusable helpers for item/list output
- common error formatting

#### `src/lib/update-config.ts`

Mirror `outline-cli`.

Responsibilities:

- read/write update channel from config
- default to stable
- preserve other config fields

#### `src/lib/errors.ts`

Introduce a small typed error model.

Recommendation:

- define a custom error class similar to the prototype’s `GranolaError`
- use stable error codes
- keep user-facing formatting separate from error creation

#### `src/lib/types.ts`

Centralize shared types.

Likely types:

- API note shapes
- cache/index note summaries
- folder metadata
- sync results
- search results
- auth status payloads

### Transport helpers

Copy the transport layer pattern from `outline-cli`.

#### `src/transport/fetch-with-retry.ts`

Use for:

- registry version checks in update commands
- optionally Granola API requests where retry behavior is appropriate

#### `src/transport/http-dispatcher.ts`

Use for:

- proxy-aware HTTP handling
- stable Node/Undici dispatcher behavior

## Command-by-command expectations

### `auth`

- `login` should prompt for an API key if not provided via env
- validate the API key before saving it
- report auth source and storage location clearly
- keep output simple and human-readable
- `status` should verify credentials against the API
- `logout` should clear secure store and config fallback token

### `sync`

- support incremental sync by default
- support `--full`
- maintain weekly full-sync behavior if we want parity with the prototype
- show a concise sync summary
- JSON mode should expose machine-usable counters

### `list`

- optionally sync first unless `--no-sync`
- support person/date/folder filters
- show local-formatted date
- show people by name only
- show folder names if present
- keep note ID secondary

### `folders`

- derive folder list from cached note metadata
- support person/date filters via the same filtering layer used by `list`
- show folder name, note count, latest date, and folder ID
- no dependence on an API folders endpoint

### `search`

- search local cache only
- support person/date/folder filters
- explain matched fields
- show a useful snippet
- score title > people > summary > transcript > folder (or another simple explicit weighting)

### `show`

- read from cache
- optionally sync first unless `--no-sync`
- show summary cleanly
- show attendees and folders
- render transcript with speaker/timestamp formatting
- JSON mode should return the structured note payload

### `skill`

Mirror `outline-cli` closely.

- install skill to agent-specific directories
- support local and global install
- keep `skills/granola-cli/SKILL.md` generated from source content
- auto-update installed skills in postinstall

### `update`

Mirror `outline-cli` closely unless a Granola-specific difference is clearly needed.

- detect stable vs pre-release channel
- check npm registry for latest matching version
- install via global package manager (`npm` or `pnpm`, same logic as Outline)
- support channel switching
- show helpful permission guidance on install failures

### `changelog`

Mirror `outline-cli` closely.

- read local `CHANGELOG.md`
- render a recent subset nicely for terminal use
- strip noisy link clutter
- link to the full changelog on GitHub when appropriate

## Skill plan

The standalone project should ship an installable skill exactly like `outline-cli` does.

### Source of truth

- source: `src/lib/skills/content.ts`
- generated artifact: `skills/granola-cli/SKILL.md`

### Skill content expectations

The skill should teach LLMs to:

- prefer `--json` or `--ndjson` for parsing
- use `granola search`, `granola list`, `granola folders`, and `granola show`
- understand implicit sync and `--no-sync`
- understand that folder/person filters are substring-based
- use `show --transcript` for raw meeting detail
- understand that the CLI uses the official read-only API plus a local cache

### Skill tooling

Port these from `outline-cli` with minimal changes:

- `src/lib/skills/*`
- `src/commands/skill.ts`
- `src/postinstall.ts`
- `scripts/postinstall.js`
- `scripts/sync-skill.js`
- `scripts/check-skill-sync.js`

## Testing plan

Tests should be colocated next to source and suffixed with `.test.ts`.

### Why colocated tests

- easier local navigation
- clearer ownership between module and tests
- fits the preference expressed for this repo

### Minimum solid first test set

#### Core logic

- `src/lib/auth.test.ts`
    - env vs secure store vs config precedence
    - save/clear behavior
    - update channel storage interoperability

- `src/lib/cache.test.ts`
    - state load/save
    - note summary extraction
    - folder metadata extraction
    - preview generation

- `src/lib/search.test.ts`
    - person/date/folder filtering
    - scoring and matched field reporting
    - folder aggregation

- `src/lib/transcript.test.ts`
    - transcript flattening
    - speaker extraction
    - timestamp formatting

- `src/lib/output.test.ts`
    - human/json/ndjson/full behavior

- `src/lib/update-config.test.ts`
    - stable default
    - switching channels without clobbering auth config

#### Command tests

- `src/commands/search.test.ts`
    - flag parsing
    - human output
    - JSON output

- `src/commands/show.test.ts`
    - transcript output behavior
    - missing note path

- `src/commands/list.test.ts`
    - folder/person filter wiring
    - structured output mode

- `src/commands/folders.test.ts`
    - aggregation output
    - date/person filter wiring

- `src/commands/auth.test.ts`
    - login/status/logout command behavior with mocked libs

- `src/commands/update/action.test.ts`
    - version comparison behavior
    - check vs install paths

- `src/commands/changelog.test.ts`
    - changelog parsing and rendering behavior

#### Skill tests

- `src/lib/skills/create-installer.test.ts`
    - install path generation
    - local/global behavior
    - overwrite protection

This is enough to make the first standalone version trustworthy without building an oversized test suite.

## Implementation phases

### Phase 1: Repository scaffolding

Set up the repo to match `outline-cli` structurally.

Tasks:

- create root files and directories
- create `package.json`
- copy/adapt TypeScript, OXC, lefthook, release, and workflow config
- set up initial `README.md`, `CONTRIBUTING.md`, `CLAUDE.md`, `CHANGELOG.md`
- set up basic `src/index.ts`

Output of this phase:

- project installs
- typechecks
- builds
- empty CLI runs
- CI config is in place

### Phase 2: Shared infrastructure

Build the reusable layers before porting commands.

Tasks:

- `lib/errors.ts`
- `lib/types.ts`
- `lib/output.ts`
- `lib/auth.ts`
- `transport/*`
- `lib/api.ts`
- `lib/cache.ts`
- `lib/search.ts`
- `lib/transcript.ts`
- initial tests for the above

Output of this phase:

- Granola domain logic exists independently of Commander wiring
- core behavior is testable

### Phase 3: Granola commands

Port the real CLI behavior.

Tasks:

- `auth`
- `sync`
- `list`
- `folders`
- `search`
- `show`
- command-level tests

Output of this phase:

- feature parity with the current prototype
- improved structure and typed boundaries

### Phase 4: Skills

Port the skill installation framework.

Tasks:

- copy/adapt `outline-cli` skill framework
- write Granola-specific skill content
- generate `skills/granola-cli/SKILL.md`
- add skill-sync CI coverage

Output of this phase:

- `granola skill install <agent>` works
- installed skills auto-update on package update

### Phase 5: Update and changelog

Add self-maintenance commands early, not as a later extra.

Tasks:

- port/adapt `changelog` command
- port/adapt `update` command family
- add `lib/update-config.ts`
- add tests for update config, version comparison, and changelog parsing

Output of this phase:

- the CLI can update itself and show recent changes
- release-channel handling matches `outline-cli`

### Phase 6: Documentation and polish

Tasks:

- complete README
- ensure command help text is good
- verify JSON/NDJSON output is consistent
- verify human output is polished
- verify package publish metadata is correct

Output of this phase:

- repo is ready for handoff or implementation review

## README plan

The README should mirror `outline-cli` in shape, but explain Granola-specific behavior clearly.

Recommended sections:

1. title + one-line description
2. installation
3. agent skills
4. uninstallation
5. local setup for development
6. authentication setup
7. cache and sync model
8. commands
9. output modes
10. limitations / capability boundaries
11. development

Important topics that must be explicit:

- official public API only
- read-only scope
- Business/Enterprise API-key requirement
- local cache behavior
- implicit sync behavior
- folder filtering is local/cache-derived
- `--json` / `--ndjson` for agent use

## CLAUDE.md plan

Like `outline-cli`, include a repo-local agent guidance file.

It should explain:

- main commands to run during development
- architecture overview
- command pattern
- lib module responsibilities
- testing approach with colocated tests
- skill content sync expectations

## Release plan

Use semantic-release like `outline-cli`.

### Branches

- `main` for stable releases
- `next` for pre-releases

### Release behavior

- automated versioning from conventional commits
- npm publish
- GitHub releases
- changelog updates on stable releases only

### Command support tied to release behavior

Because update/changelog are part of the product scope, release metadata and npm publication should be treated as part of the CLI contract, not optional polish.

## Risks and implementation pitfalls

### 1. Over-copying Outline features

Risk:

- bringing over Outline-specific concepts or dependencies that do not belong here

Mitigation:

- copy scaffolding and patterns, not feature code that is unrelated to Granola

### 2. Keeping too much prototype structure

Risk:

- porting the current monolithic script too literally into TypeScript

Mitigation:

- split by responsibility before wiring commands
- keep command modules thin

### 3. Transcript shapes are messy

Risk:

- transcript entries may vary in structure across notes

Mitigation:

- keep transcript parsing permissive and defensive
- test several shape variants

### 4. Keyring behavior differs by machine

Risk:

- auth tests can become flaky or environment-dependent

Mitigation:

- isolate secure-store access behind a small wrapper or mockable interface
- avoid requiring real keychain access in tests

### 5. Folder behavior may be misunderstood

Risk:

- implementers may think a folders endpoint is required

Mitigation:

- document clearly that folder support comes from cached note detail payloads
- keep folder filtering fully local

### 6. Cache compatibility distractions

Risk:

- spending time on migration from the old `cto-pa` cache path

Mitigation:

- do not support old cache migration in v1
- start clean with the standalone CLI’s own cache schema

### 7. Release/update mismatch

Risk:

- implementing update commands without matching release/channel conventions

Mitigation:

- keep update logic aligned with semantic-release branch strategy from day one

## Acceptance criteria

The first implementation should be considered successful when all of the following are true:

- repo structure clearly mirrors `outline-cli`
- `npm install`, `npm run build`, `npm run type-check`, and `npm test` work
- linting and formatting are configured and enforced
- GitHub Actions are present and sensible
- `granola auth login/status/logout` work
- `granola sync/list/folders/search/show` work with local cache behavior
- folder filtering works without any private API usage
- output supports both humans and agents cleanly
- skill installation works
- `granola update` and `granola changelog` work
- README explains install, auth, cache model, commands, and limitations clearly
- tests are colocated and cover the critical paths

## Recommended implementation stance

If there is ever a choice between:

- exact mechanical parity with the prototype, or
- a cleaner structure that still preserves the same behavior,

prefer the cleaner structure.

The goal is not to transplant `scripts/granola.js` into TypeScript line-by-line. The goal is to turn that working prototype into a proper small Doist CLI, using `outline-cli` as the structural template.
