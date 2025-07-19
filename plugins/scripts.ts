import { LEGACY, getProjectInfo, ignoredDirectories } from "./consts"
import { PluginOption } from "vite"
import { transformSync } from 'esbuild'
import { existsSync, readFileSync, readdirSync, statSync } from "fs"
import { resolve } from 'path'

function findLegacyScripts() {
    const foundScripts = new Map<string, string>()

    const items = readdirSync('.')
    items.forEach(item => {
        const itemPath = resolve('.', item)
        const stat = statSync(itemPath)

        if (stat.isDirectory() && !ignoredDirectories.includes(item)) {
            // Only look in registered projects
            const projectInfo = getProjectInfo(itemPath)
            if (projectInfo) {
                LEGACY.forEach(scriptName => {
                    const scriptPath = resolve(itemPath, scriptName)
                    if (existsSync(scriptPath) && !foundScripts.has(scriptName)) {
                        foundScripts.set(scriptName, scriptPath)
                    }
                })
            }
        }
    })

    return foundScripts
}

export function handleLegacyScripts(): PluginOption {
    return {
        name: 'handle-legacy-scripts',
        enforce: 'pre' as const,
        transformIndexHtml(html: string) {
            // Mark legacy scripts as external to prevent bundling
            // This regex now matches relative paths like ../sorter.js, ../../prettify.js, etc.
            return html.replace(
                /<script\s+src="([^"]*(?:\.\.\/)*(?:prettify|sorter|block-navigation)\.js)"><\/script>/g,
                '<script data-legacy="true" src="/unit-tests/$1"></script>'
            )
        },
        config(config: any) {
            // Exclude legacy scripts from bundling
            config.build = config.build || {}
            config.build.rollupOptions = config.build.rollupOptions || {}
            config.build.rollupOptions.external = config.build.rollupOptions.external || []

            if (Array.isArray(config.build.rollupOptions.external)) {
                config.build.rollupOptions.external.push(...LEGACY)
            }
        },
        generateBundle() {
            // Find and copy legacy scripts from registered project directories
            const foundScripts = findLegacyScripts()

            foundScripts.forEach((scriptPath, scriptName) => {
                try {
                    const code = readFileSync(scriptPath, 'utf8')
                    const { code: minified } = transformSync(code, {
                        loader: 'js',
                        minify: true
                    })

                    this.emitFile({
                        type: 'asset',
                        fileName: scriptName,
                        source: minified
                    })
                } catch (error) {
                    console.warn(`Could not process legacy script ${scriptName}:`, error)
                }
            })
        }
    }
}

export function postProcessLegacyScripts(): PluginOption {
    return {
        name: 'post-process-legacy-scripts',
        enforce: 'post' as const,
        generateBundle(options: any, bundle: any) {
            // Clean up the data-legacy attributes
            // This regex now also matches relative paths
            Object.keys(bundle).forEach(fileName => {
                if (fileName.endsWith('.html')) {
                    const htmlAsset = bundle[fileName]
                    if (htmlAsset.type === 'asset' && typeof htmlAsset.source === 'string') {
                        htmlAsset.source = htmlAsset.source.replace(
                            /<script\s+data-legacy="true"\s+src="([^"]*)"><\/script>/g,
                            '<script src="/unit-tests/$1"></script>'
                        )
                    }
                }
            })
        }
    }
}