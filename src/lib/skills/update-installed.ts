import { skillInstallers } from './index.js'

export interface InstalledSkillError {
    name: string
    message: string
}

export interface UpdateAllResult {
    updated: string[]
    skipped: string[]
    errors: InstalledSkillError[]
}

export async function updateAllInstalledSkills(local: boolean): Promise<UpdateAllResult> {
    const updated: string[] = []
    const skipped: string[] = []
    const errors: InstalledSkillError[] = []

    for (const [name, installer] of Object.entries(skillInstallers)) {
        try {
            const isInstalled = await installer.isInstalled(local)
            if (isInstalled) {
                await installer.update(local)
                updated.push(name)
            } else {
                skipped.push(name)
            }
        } catch (error) {
            errors.push({
                name,
                message: error instanceof Error ? error.message : String(error),
            })
        }
    }

    return { updated, skipped, errors }
}
