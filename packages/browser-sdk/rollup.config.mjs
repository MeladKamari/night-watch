import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import resolve from '@rollup/plugin-node-resolve'
import terser from '@rollup/plugin-terser'
import { defineConfig } from 'rollup'

const root = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dependencyNames = Object.keys(pkg.dependencies ?? {})

const banner = `/*! ${pkg.name} v${pkg.version} | first-party offline-capable | no telemetry | sideEffects:false */`

/** @type {import('rollup').OutputOptions} */
const namedOutput = {
  name: 'NightWatch',
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
    // Keep CSP-friendly: never emit Function/eval.
    unsafe: false,
    unsafe_Function: false,
    unsafe_methods: false,
  },
  format: {
    comments: (_node, comment) => comment.value.startsWith('!'),
  },
  safari10: true,
})

/**
 * Browser-sdk publish bundles (step 56).
 * - IIFE/UMD: dependencies inlined for self-hosted script-tag / offline use.
 * - ESM/CJS npm: `@night-watch/core` left external for tree-shaking / dual-package installs.
 * Readable + minified where applicable. Sourcemaps always emitted (publication policy).
 */
export default defineConfig([
  {
    input: join(root, 'dist/index.js'),
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false,
      }),
    ],
    output: [
      {
        ...namedOutput,
        file: join(root, 'dist/fp.js'),
        format: 'iife',
      },
      {
        ...namedOutput,
        file: join(root, 'dist/fp.min.js'),
        format: 'iife',
        plugins: [terserPlugin],
      },
      {
        ...namedOutput,
        file: join(root, 'dist/fp.umd.js'),
        format: 'umd',
      },
      {
        ...namedOutput,
        file: join(root, 'dist/fp.umd.min.js'),
        format: 'umd',
        plugins: [terserPlugin],
      },
    ],
  },
  {
    input: join(root, 'dist/index.js'),
    external: dependencyNames,
    plugins: [resolve({ preferBuiltins: false })],
    output: [
      {
        ...namedOutput,
        file: join(root, 'dist/fp.esm.js'),
        format: 'esm',
      },
      {
        ...namedOutput,
        file: join(root, 'dist/fp.esm.min.js'),
        format: 'esm',
        plugins: [terserPlugin],
      },
      {
        ...namedOutput,
        // `.cjs` extension required because package.json has "type": "module".
        file: join(root, 'dist/fp.cjs'),
        format: 'cjs',
        interop: 'auto',
      },
      {
        ...namedOutput,
        file: join(root, 'dist/fp.min.cjs'),
        format: 'cjs',
        interop: 'auto',
        plugins: [terserPlugin],
      },
    ],
  },
])
