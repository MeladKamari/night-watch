/**
 * Validates server/docker-compose.yml when Docker is available.
 * Exit 0 on success; exit 2 if docker missing (documented NOT RUN for CI without Docker).
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const compose = join(root, 'server/docker-compose.yml')
const runbook = join(root, 'server/deploy/OFFLINE_IMAGES.md')

if (!existsSync(compose) || !existsSync(runbook)) {
  console.error('validate-docker-compose: missing compose or offline runbook')
  process.exit(1)
}

const docker = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' })
if (docker.status !== 0) {
  console.log('validate-docker-compose: NOT RUN — docker not available')
  process.exit(2)
}

const cfg = spawnSync('docker', ['compose', '-f', compose, 'config'], {
  encoding: 'utf8',
  env: { ...process.env, POSTGRES_PASSWORD: 'dev-only-change-me' },
})
if (cfg.status !== 0) {
  console.error(cfg.stderr || cfg.stdout)
  process.exit(1)
}
console.log('validate-docker-compose: PASS — docker compose config OK')
process.exit(0)
