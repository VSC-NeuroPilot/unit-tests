import { resolve, join } from 'path'
import { readdirSync, statSync, existsSync } from 'fs'
import { PluginOption } from 'vite'
import { getProjectInfo, ignoredDirectories, ProjectInfo } from './consts'

// Recursively find all HTML files in a directory
function findHtmlFiles(dir: string, baseDir: string = dir): string[] {
    const htmlFiles: string[] = []

    try {
        const items = readdirSync(dir)

        items.forEach(item => {
            const itemPath = join(dir, item)
            const stat = statSync(itemPath)

            if (stat.isDirectory() && !ignoredDirectories.includes(item)) {
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

// Function to find all HTML files recursively in registered projects
export function getProjectEntries() {
    const entries: Record<string, string> = {}

    // Add root HTML files
    const rootHtmlFiles = ['index.html', '404.html']
    rootHtmlFiles.forEach(file => {
        const filePath = resolve(file)
        if (existsSync(filePath)) {
            const entryName = file.replace('.html', '') || 'index'
            entries[entryName] = filePath
        }
    })

    // Scan for registered project directories (those with info.json)
    const items = readdirSync('.')
    items.forEach(item => {
        const itemPath = resolve('.', item)
        const stat = statSync(itemPath)

        if (stat.isDirectory() && !ignoredDirectories.includes(item)) {
            // Check if this directory is a registered project
            const projectInfo = getProjectInfo(itemPath)
            if (projectInfo) {
                const htmlFiles = findHtmlFiles(itemPath)

                htmlFiles.forEach(htmlFile => {
                    // Create a unique entry name based on the file path
                    const relativePath = htmlFile.replace(resolve('.') + '/', '').replace(/\\/g, '/')
                    const entryName = relativePath.replace('.html', '').replace(/\//g, '-')
                    entries[entryName] = htmlFile
                })
            }
        }
    })

    return entries
}

// Plugin to inject project links using info.json names
export function injectProjectLinks(): PluginOption {
    return {
        name: 'inject-project-links',
        transformIndexHtml(html: string) {
            // Get registered projects with their display names
            const projects: Array<{ dir: string, info: ProjectInfo }> = []
            const items = readdirSync('.')

            items.forEach(item => {
                const itemPath = resolve('.', item)
                const stat = statSync(itemPath)

                if (stat.isDirectory() && !ignoredDirectories.includes(item)) {
                    const projectInfo = getProjectInfo(itemPath)
                    if (projectInfo) {
                        // Verify it has an index.html
                        const indexPath = resolve(itemPath, 'index.html')
                        if (existsSync(indexPath)) {
                            projects.push({ dir: item, info: projectInfo })
                        }
                    }
                }
            })

            // Sort projects by name for consistent ordering
            projects.sort((a, b) => a.info.name.localeCompare(b.info.name))

            const projectLinks = projects.map(({ dir, info }) => {
                return `        <li><a href="./${dir}/">${info.name}</a></li>`
            }).join('\n')

            return html.replace(
                /<ul class="project-links">[\s\S]*?<\/ul>/,
                `<ul class="project-links">\n${projectLinks}\n    </ul>`
            ).replace(
                /Select a project to view its test coverage:/,
                `Select a project to view its test coverage (${projects.length} project${projects.length === 1 ? '' : 's'} registered):`
            )
        }
    }
}