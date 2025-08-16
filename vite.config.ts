import { defineConfig } from 'vite'
import { getProjectEntries, injectProjectLinks } from './plugins/links'
import { handleLegacyScripts, postProcessLegacyScripts } from './plugins/scripts'

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
        commonjsOptions: {
            include: [/.+\.js$/]
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
    preview: {
        open: false,
        port: 4000
    },
    css: {
        devSourcemap: true
    }
})