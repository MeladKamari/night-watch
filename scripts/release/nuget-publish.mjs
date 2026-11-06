#!/usr/bin/env node
/**
 * Pack + push NightWatch.Blazor to nuget.org.
 *
 * Prerequisites:
 *   - .NET SDK
 *   - NUGET_API_KEY env (https://www.nuget.org/account/apikeys)
 *
 * Usage:
 *   node scripts/release/nuget-publish.mjs           # pack only (dry)
 *   node scripts/release/nuget-publish.mjs --execute  # pack + push
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const execute = process.argv.includes('--execute')
const proj = join(root, 'packages/blazor/csharp/NightWatch.Blazor.csproj')
const outDir = join(root, 'artifacts/nuget')

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts })
}

if (!existsSync(proj)) throw new Error(`missing ${proj}`)
mkdirSync(outDir, { recursive: true })

run('dotnet', ['pack', proj, '-c', 'Release', '-o', outDir, '--nologo'])

const nupkgs = readdirSync(outDir).filter((f) => f.endsWith('.nupkg') && !f.endsWith('.snupkg'))
if (!nupkgs.length) throw new Error(`no .nupkg in ${outDir}`)
console.log('packed:', nupkgs.join(', '))

if (!execute) {
  console.log('\nDry-run done. Re-run with --execute and NUGET_API_KEY set to push.')
  process.exit(0)
}

const key = process.env.NUGET_API_KEY || process.env.NUGET_AUTH_TOKEN
if (!key) throw new Error('NUGET_API_KEY is required for --execute')

for (const file of nupkgs) {
  run('dotnet', [
    'nuget',
    'push',
    join(outDir, file),
    '--api-key',
    key,
    '--source',
    'https://api.nuget.org/v3/index.json',
    '--skip-duplicate',
  ])
}

console.log('\nNuGet publish done.')
