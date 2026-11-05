import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import terser from '@rollup/plugin-terser'
import { defineConfig } from 'rollup'

const root = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

const banner = `/*! ${pkg.name} v${pkg.version} | first-party offline-capable | no telemetry | sideEffects:false */`

/** @type {import('rollup').OutputOptions} */
const namedOutput = {
  exports: 'named',
  banner,
  sourcemap: true,
  generatedCode: {
    constBindings: true,
  },
}

const terserPlugin = terser({
  ecma: 2018,
  compress: {
    passes: 2,
    pure_getters: true,
    unsafe: false,
    unsafe_Function: false,
  },
  format: {
    comments: (_node, comment) => comment.value.startsWith('!'),
  },
})

/**
 * Core npm ESM/CJS bundles (readable + minified). Modular `dist/**` remains the
 * primary tree-shakeable import path; these files support Node `require` and
 * single-file ESM consumers.
 */
export default defineConfig({
  input: join(root, 'dist/index.js'),
  output: [
    {
      ...namedOutput,
      file: join(root, 'dist/core.esm.js'),
      format: 'esm',
    },
    {
      ...namedOutput,
      file: join(root, 'dist/core.esm.min.js'),
      format: 'esm',
      plugins: [terserPlugin],
    },
    {
      ...namedOutput,
      // `.cjs` extension required because package.json has "type": "module".
      file: join(root, 'dist/core.cjs'),
      format: 'cjs',
      interop: 'auto',
    },
    {
      ...namedOutput,
      file: join(root, 'dist/core.min.cjs'),
      format: 'cjs',
      interop: 'auto',
      plugins: [terserPlugin],
    },
  ],
})
