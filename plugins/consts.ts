import { resolve } from "path"
import { existsSync, readFileSync } from "fs"

export const LEGACY = ['prettify.js', 'sorter.js', 'block-navigation.js']
export const ignoredDirectories = [".github", "dist", "node_modules"]

export interface ProjectInfo {
    name: string
}

export function getProjectInfo(projectDir: string): ProjectInfo | null {
    const infoPath = resolve(projectDir, 'info.json')
    if (!existsSync(infoPath)) {
        return null
    }
    
    try {
        const content = readFileSync(infoPath, 'utf8')
        return JSON.parse(content) as ProjectInfo
    } catch (error) {
        console.warn(`Could not parse info.json in ${projectDir}:`, error)
        return null
    }
}