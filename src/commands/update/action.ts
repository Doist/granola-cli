import { spawn } from 'node:child_process'
import chalk from 'chalk'
import packageJson from '../../../package.json' with { type: 'json' }
import { withSpinner } from '../../lib/spinner.js'
import { getUpdateChannel, type UpdateChannel } from '../../lib/update-config.js'
import { fetchWithRetry } from '../../transport/fetch-with-retry.js'

const PACKAGE_NAME = '@doist/granola-cli'

interface RegistryResponse {
    version: string
}

interface ParsedVersion {
    major: number
    minor: number
    patch: number
    prerelease: string | undefined
}

function getInstallTag(channel: UpdateChannel): string {
    return channel === 'pre-release' ? 'next' : 'latest'
}

function parseVersion(version: string): ParsedVersion {
    const [core, ...rest] = version.split('-')
    const [major, minor, patch] = core.split('.').map(Number)
    return { major, minor, patch, prerelease: rest.length > 0 ? rest.join('-') : undefined }
}

function isNewer(current: string, candidate: string): boolean {
    const left = parseVersion(current)
    const right = parseVersion(candidate)

    for (const key of ['major', 'minor', 'patch'] as const) {
        if (right[key] !== left[key]) {
            return right[key] > left[key]
        }
    }

    if (!left.prerelease && right.prerelease) {
        return false
    }
    if (left.prerelease && !right.prerelease) {
        return true
    }
    if (left.prerelease && right.prerelease) {
        return right.prerelease.localeCompare(left.prerelease, undefined, { numeric: true }) > 0
    }
    return false
}

async function fetchVersion(channel: UpdateChannel): Promise<string> {
    const tag = getInstallTag(channel)
    const url = `https://registry.npmjs.org/${PACKAGE_NAME}/${tag}`
    const response = await fetchWithRetry({ url })
    if (!response.ok) {
        throw new Error(`Registry request failed (HTTP ${response.status})`)
    }
    const data = (await response.json()) as RegistryResponse
    return data.version
}

function detectPackageManager(): string {
    return 'npm'
}

function runInstall(
    packageManager: string,
    tag: string,
): Promise<{ exitCode: number; stderr: string }> {
    const command = packageManager === 'pnpm' ? 'add' : 'install'
    return new Promise((resolve, reject) => {
        const child = spawn(packageManager, [command, '-g', `${PACKAGE_NAME}@${tag}`], {
            stdio: ['ignore', 'ignore', 'pipe'],
            shell: process.platform === 'win32',
        })

        let stderr = ''
        child.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString()
        })

        child.on('error', reject)
        child.on('close', (code) => resolve({ exitCode: code ?? 1, stderr }))
    })
}

function channelLabel(channel: UpdateChannel): string {
    return channel === 'pre-release' ? ` ${chalk.magenta('(pre-release)')}` : ''
}

export async function updateAction(options: { check?: boolean; channel?: boolean }): Promise<void> {
    if (options.check && options.channel) {
        console.error(chalk.red('Error:'), 'Specify either --check or --channel, not both.')
        process.exitCode = 1
        return
    }

    if (options.channel) {
        const channel = await getUpdateChannel()
        console.log(
            `Update channel: ${channel === 'pre-release' ? chalk.magenta('pre-release') : chalk.green('stable')}`,
        )
        return
    }

    const channel = await getUpdateChannel()
    const tag = getInstallTag(channel)
    const label = channelLabel(channel)
    const currentVersion = packageJson.version

    let latestVersion: string
    try {
        latestVersion = await withSpinner(
            { text: `Checking for updates${label}...`, color: 'blue' },
            () => fetchVersion(channel),
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red('Error:'), `Failed to check for updates: ${message}`)
        process.exitCode = 1
        return
    }

    const updateAvailable = isNewer(currentVersion, latestVersion)

    if (options.check) {
        const channelLine =
            channel === 'pre-release'
                ? `  Channel: ${chalk.magenta('pre-release')}`
                : `  Channel: ${chalk.green('stable')}`

        if (currentVersion === latestVersion) {
            console.log(chalk.green('✓'), `Already up to date (v${currentVersion})`)
        } else if (updateAvailable) {
            console.log(
                `Update available: ${chalk.dim(`v${currentVersion}`)} → ${chalk.green(`v${latestVersion}`)}`,
            )
        } else {
            console.log(
                `Downgrade available: ${chalk.dim(`v${currentVersion}`)} → ${chalk.yellow(`v${latestVersion}`)}`,
            )
        }
        console.log(channelLine)
        return
    }

    if (currentVersion === latestVersion) {
        console.log(chalk.green('✓'), `Already up to date${label} (v${currentVersion})`)
        return
    }

    if (updateAvailable) {
        console.log(
            `Update available${label}: ${chalk.dim(`v${currentVersion}`)} → ${chalk.green(`v${latestVersion}`)}`,
        )
    } else {
        console.log(
            `Downgrade available${label}: ${chalk.dim(`v${currentVersion}`)} → ${chalk.yellow(`v${latestVersion}`)}`,
        )
    }

    const packageManager = detectPackageManager()

    let result: { exitCode: number; stderr: string }
    try {
        result = await withSpinner(
            { text: `Updating to v${latestVersion}${label}...`, color: 'blue' },
            () => runInstall(packageManager, tag),
        )
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(chalk.red('Error:'), `Install failed: ${message}`)
        process.exitCode = 1
        return
    }

    if (result.exitCode !== 0) {
        if (
            result.stderr &&
            (result.stderr.includes('EACCES') || result.stderr.includes('EPERM'))
        ) {
            console.error(chalk.red('Error:'), 'Permission denied. Try running with sudo:')
            console.error(
                chalk.dim(
                    `  sudo ${packageManager} ${packageManager === 'pnpm' ? 'add' : 'install'} -g ${PACKAGE_NAME}@${tag}`,
                ),
            )
        } else {
            console.error(
                chalk.red('Error:'),
                `${packageManager} exited with code ${result.exitCode}`,
            )
            if (result.stderr) {
                console.error(chalk.dim(result.stderr.trim()))
            }
        }
        process.exitCode = 1
        return
    }

    console.log(chalk.green('✓'), `Updated to v${latestVersion}${label}`)
    if (channel === 'stable') {
        console.log(
            chalk.dim('  Run'),
            chalk.cyan('granola changelog'),
            chalk.dim('to see what changed'),
        )
    }
}

export { isNewer, parseVersion }
