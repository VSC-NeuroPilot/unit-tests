import { defineConfig } from 'vite'
import { resolve, join } from 'path'
import { readdirSync, statSync, existsSync } from 'fs'
import { readFileSync } from 'fs'
import { transformSync } from 'esbuild'

// legacy scripts
const LEGACY = ['prettify.js', 'sorter.js', 'block-navigation.js']

const ignoredDirectories = [".github", "dist", "node_modules"]

function findLegacyScripts() {
    const foundScripts = new Map<string, string>()

    const items = readdirSync('.')
    items.forEach(item => {
        const itemPath = resolve('.', item)
        const stat = statSync(itemPath)

        if (stat.isDirectory() && item !== 'node_modules' && item !== 'dist') {
            LEGACY.forEach(scriptName => {
                const scriptPath = resolve(itemPath, scriptName)
                if (existsSync(scriptPath) && !foundScripts.has(scriptName)) {
                    foundScripts.set(scriptName, scriptPath)
                }
            })
        }
    })

    return foundScripts
}

// Recursively find all HTML files in a directory
function findHtmlFiles(dir: string, baseDir: string = dir): string[] {
    const htmlFiles: string[] = []

    try {
        const items = readdirSync(dir)

        items.forEach(item => {
            const itemPath = join(dir, item)
            const stat = statSync(itemPath)

            if (stat.isDirectory()) {
                // Recursively search subdirectories
                htmlFiles.push(...findHtmlFiles(itemPath, baseDir))
            } else if (item.endsWith('.html')) {
                htmlFiles.push(itemPath)
            }
        })
    } catch (error) {
        console.warn(`Could not read directory ${dir}:`, error)
    }

    return htmlFiles
}

function handleLegacyScripts() {
    return {
        name: 'handle-legacy-scripts',
        enforce: 'pre' as const,
        transformIndexHtml(html: string) {
            // Mark legacy scripts as external to prevent bundling
            return html.replace(
                /<script\s+src="([^"]*(?:prettify|sorter|block-navigation)\.js)"><\/script>/g,
                '<script data-legacy="true" src="$1"></script>'
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
            // Find and copy legacy scripts from project directories
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

function postProcessLegacyScripts() {
    return {
        name: 'post-process-legacy-scripts',
        enforce: 'post' as const,
        generateBundle(options: any, bundle: any) {
            // Clean up the data-legacy attributes
            Object.keys(bundle).forEach(fileName => {
                if (fileName.endsWith('.html')) {
                    const htmlAsset = bundle[fileName]
                    if (htmlAsset.type === 'asset' && typeof htmlAsset.source === 'string') {
                        htmlAsset.source = htmlAsset.source.replace(
                            /<script\s+data-legacy="true"\s+src="([^"]*)"><\/script>/g,
                            '<script src="$1"></script>'
                        )
                    }
                }
            })
        }
    }
}

// Function to find all HTML files recursively
function getProjectEntries() {
    const entries: Record<string, string> = {}

    // Add root HTML files
    const rootHtmlFiles = ['index.html', '404.html']
    rootHtmlFiles.forEach(file => {
        const filePath = resolve(__dirname, file)
        if (existsSync(filePath)) {
            const entryName = file.replace('.html', '') || 'index'
            entries[entryName] = filePath
        }
    })

    // Scan project directories for all HTML files
    const items = readdirSync('.')
    items.forEach(item => {
        const itemPath = resolve('.', item)
        const stat = statSync(itemPath)

        if (stat.isDirectory() && item in ignoredDirectories) {
            const htmlFiles = findHtmlFiles(itemPath)

            htmlFiles.forEach(htmlFile => {
                // Create a unique entry name based on the file path
                const relativePath = htmlFile.replace(resolve('.') + '/', '').replace(/\\/g, '/')
                const entryName = relativePath.replace('.html', '').replace(/\//g, '-')
                entries[entryName] = htmlFile
            })
        }
    })

    return entries
}

// Plugin to inject project links
function injectProjectLinks() {
    return {
        name: 'inject-project-links',
        transformIndexHtml(html: string) {
            // Get unique project directories (not individual HTML files)
            const projectDirs = new Set<string>()
            const items = readdirSync('.')

            items.forEach(item => {
                const itemPath = resolve('.', item)
                const stat = statSync(itemPath)

                if (stat.isDirectory() && item !== 'node_modules' && item !== 'dist') {
                    const indexPath = resolve(itemPath, 'index.html')
                    if (existsSync(indexPath)) {
                        projectDirs.add(item)
                    }
                }
            })

            const projectLinks = Array.from(projectDirs).map(project => {
                const displayName = project.replace(/([a-z])([A-Z])/g, '$1 $2')
                    .replace(/([a-z])(\d)/g, '$1 $2')
                    .split(' ')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ')
                return `        <li><a href="./${project}/">${displayName}</a></li>`
            }).join('\n')

            return html.replace(
                /<ul class="project-links">[\s\S]*?<\/ul>/,
                `<ul class="project-links">${projectLinks}</ul>`
            ).replace(
                /Select a project to view its test coverage:/,
                `Select a project to view its test coverage (${projectDirs.size} projects shown):`
            )
        }
    }
}

export default defineConfig({
    root: '.',
    base: '/unit-tests/',
    plugins: [
        injectProjectLinks(),
        handleLegacyScripts(),
        postProcessLegacyScripts()
    ],
    build: {
        rollupOptions: {
            input: getProjectEntries()
        },
        outDir: 'dist',
        minify: 'esbuild',
        cssMinify: true,
        assetsInlineLimit: 0
    },
    server: {
        open: false,
        port: 3000
    },
    css: {
        devSourcemap: true
    }
})