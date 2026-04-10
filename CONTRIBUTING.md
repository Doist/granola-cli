# Contributing to Granola CLI

All work on Granola CLI happens on [GitHub](https://github.com/Doist/granola-cli).

## Semantic Versioning

Granola CLI follows [semantic versioning](https://semver.org/).

- patch: bug fixes
- minor: backward-compatible features and improvements
- major: breaking changes

Every significant change should be reflected in `CHANGELOG.md`.

## Branch Organization

- target `main` for stable work
- target `next` for pre-release work

## Development Workflow

After cloning and installing dependencies:

- `npm run build`
- `npm run dev`
- `npm run type-check`
- `npm run lint:check`
- `npm run lint:write`
- `npm run format:check`
- `npm run format`
- `npm test`
- `npm run test:watch`

## Pull Requests

Before submitting a PR:

- branch from `main` (or `next` for pre-release work)
- add or update tests where appropriate
- ensure lint, format, typecheck, build, and tests pass
- keep skill content in sync when commands or flags change

## Commit Message Guidelines

This repository expects [Conventional Commits](https://www.conventionalcommits.org/).

Examples:

- `feat: add folder filtering`
- `fix: handle missing cached note`
- `docs: clarify auth setup`
- `test: cover transcript formatting`

PR titles are validated in CI because squash-merge titles become commit messages.

## Release Process

Releases are handled by `semantic-release`.

- merges to `main` publish stable releases
- merges to `next` publish pre-releases
- `CHANGELOG.md` is updated on stable releases

### Installing a pre-release

```sh
npm install @doist/granola-cli@next
```

## License

By contributing, you agree that your contributions are licensed under this repository's MIT license.
