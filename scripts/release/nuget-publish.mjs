#!/usr/bin/env node
/**
 * Pack + push NightWatch.Blazor.
 *
 * Targets:
 *   nuget.org (default with --execute) — needs NUGET_API_KEY
 *   GitHub Packages (--github) — needs GITHUB_TOKEN
 *
 * Usage:
 *   node scripts/release/nuget-publish.mjs                    # pack only
 *   node scripts/release/nuget-publish.mjs --execute          # nuget.org
 *   node scripts/release/nuget-publish.mjs --github           # GitHub Packages
 *   node scripts/release/nuget-publish.mjs --execute --github # both
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const execute = process.argv.includes('--execute')
const github = process.argv.includes('--github')
const proj = join(root, 'packages/blazor/csharp/NightWatch.Blazor.csproj')
const outDir = join(root, 'artifacts/nuget')
const GH_OWNER = 'MeladKamari'
const GH_SOURCE = `https://nuget.pkg.github.com/${GH_OWNER}/index.json`

function run(cmd, args, opts = {}) {
  console.log(`\n> ${cmd} ${args.join(' ')}`)
  execFileSync(cmd, args, { cwd: root, stdio: 'inherit', shell: true, ...opts })
}

function nupkgPaths() {
  return readdirSync(outDir)
    .filter((f) => f.endsWith('.nupkg') && !f.endsWith('.snupkg'))
    .map((f) => join(outDir, f))
}

if (!existsSync(proj)) throw new Error(`missing ${proj}`)
mkdirSync(outDir, { recursive: true })

run('dotnet', ['pack', proj, '-c', 'Release', '-o', outDir, '--nologo'])

const pkgs = nupkgPaths()
if (!pkgs.length) throw new Error(`no .nupkg in ${outDir}`)
console.log('packed:', pkgs.map((p) => p.split(/[/\\]/).pop()).join(', '))

if (!execute && !github) {
  console.log('\nDry-run done. Pass --execute and/or --github to push.')
  process.exit(0)
}

if (execute) {
  const key = process.env.NUGET_API_KEY || process.env.NUGET_AUTH_TOKEN
  if (!key) throw new Error('NUGET_API_KEY is required for --execute (nuget.org)')
  for (const file of pkgs) {
    run('dotnet', [
      'nuget',
      'push',
      file,
      '--api-key',
      key,
      '--source',
      'https://api.nuget.org/v3/index.json',
      '--skip-duplicate',
    ])
  }
  console.log('\nPushed to nuget.org')
}

if (github) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
  if (!token) throw new Error('GITHUB_TOKEN is required for --github (GitHub Packages)')
  for (const file of pkgs) {
    run('dotnet', [
      'nuget',
      'push',
      file,
      '--api-key',
      token,
      '--source',
      GH_SOURCE,
      '--skip-duplicate',
    ])
  }
  console.log(`\nPushed to GitHub Packages (${GH_SOURCE})`)
}

console.log('\nNuGet publish done.')
