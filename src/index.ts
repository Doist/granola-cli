#!/usr/bin/env node
import { Command } from 'commander'
import packageJson from '../package.json' with { type: 'json' }
import { registerAuthCommand } from './commands/auth.js'
import { registerChangelogCommand } from './commands/changelog.js'
import { registerFoldersCommand } from './commands/folders.js'
import { registerListCommand } from './commands/list.js'
import { registerSearchCommand } from './commands/search.js'
import { registerShowCommand } from './commands/show.js'
import { registerSkillCommand } from './commands/skill.js'
import { registerSyncCommand } from './commands/sync.js'
import { registerUpdateCommand } from './commands/update/index.js'

const program = new Command()

program
    .name('granola')
    .version(packageJson.version)
    .description('CLI for the Granola notes and transcript API')
    .option('--no-spinner', 'Disable loading animations')
    .addHelpText(
        'after',
        `
Note for AI/LLM agents:
  Use --json or --ndjson for unambiguous output.
  Use --full when you need richer structured fields.
  list/search/folders/show read from a local cache and may sync first unless you pass --no-sync.`,
    )

registerAuthCommand(program)
registerSyncCommand(program)
registerListCommand(program)
registerFoldersCommand(program)
registerSearchCommand(program)
registerShowCommand(program)
registerSkillCommand(program)
registerChangelogCommand(program)
registerUpdateCommand(program)

program.parseAsync().catch((error: Error) => {
    console.error(error.message)
    process.exit(1)
})
