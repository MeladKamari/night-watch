import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

describe('STEP 006 docker compose offline toolchain', () => {
  it('checks in compose, Dockerfiles, secrets placeholder, and offline runbook', () => {
    for (const rel of [
      'server/docker-compose.yml',
      'server/Dockerfile',
      'server/Dockerfile.worker',
      'server/deploy/OFFLINE_IMAGES.md',
      'server/deploy/nginx/default.conf',
      'server/deploy/secrets/postgres_password.txt',
      'scripts/ci/validate-docker-compose.mjs',
    ]) {
      expect(existsSync(join(root, rel)), rel).toBe(true)
    }
    const compose = readFileSync(join(root, 'server/docker-compose.yml'), 'utf8')
    expect(compose).toContain('postgres:16.6-alpine')
    expect(compose).toContain('redis:7.4.1-alpine')
    expect(compose).toContain('AllowOutboundLookup')
    expect(compose).not.toMatch(/fingerprint\.com/)
    const runbook = readFileSync(join(root, 'server/deploy/OFFLINE_IMAGES.md'), 'utf8')
    expect(runbook).toContain('docker load')
    expect(runbook).toContain('cold start')
  })

  it('docker compose config validates when docker is installed', () => {
    const version = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8' })
    if (version.status !== 0) {
      console.warn('docker not available — compose config NOT RUN')
      return
    }
    const cfg = spawnSync(
      'docker',
      ['compose', '-f', join(root, 'server/docker-compose.yml'), 'config'],
      {
        encoding: 'utf8',
        env: { ...process.env, POSTGRES_PASSWORD: 'dev-only-change-me' },
      },
    )
    expect(cfg.status, cfg.stderr || cfg.stdout).toBe(0)
  })
})
