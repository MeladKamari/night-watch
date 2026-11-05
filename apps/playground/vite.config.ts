import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

const rootDir = dirname(fileURLToPath(import.meta.url))

/**
 * Local-only first-party playground.
 * Aliases workspace packages to TypeScript sources for live reload.
 * Binds to loopback by default — no public host, no remote assets.
 */
export default defineConfig({
  root: rootDir,
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
    open: false,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2018',
  },
  resolve: {
    alias: {
      '@night-watch/browser-sdk': resolve(rootDir, '../../packages/browser-sdk/src/index.ts'),
      '@night-watch/core': resolve(rootDir, '../../packages/core/src/index.ts'),
    },
  },
})
