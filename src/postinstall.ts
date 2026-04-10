import { updateAllInstalledSkills } from './lib/skills/update-installed.js'

updateAllInstalledSkills(false)
    .then((result) => {
        if (result.errors.length === 0) {
            return
        }

        console.warn('granola-cli: failed to update some installed skills during postinstall:')
        for (const error of result.errors) {
            console.warn(`- ${error.name}: ${error.message}`)
        }
    })
    .catch((error) => {
        const message = error instanceof Error ? error.message : String(error)
        console.warn(
            `granola-cli: failed to refresh installed skills during postinstall: ${message}`,
        )
    })
