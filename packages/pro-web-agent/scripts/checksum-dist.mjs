import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
if (!existsSync(dist)) {
  console.error('dist missing — run build first')
  process.exit(1)
}

const lines = []
for (const name of readdirSync(dist).sort()) {
  if (!name.endsWith('.js') && !name.endsWith('.d.ts') && !name.endsWith('.map')) continue
  // Avoid private absolute paths in published checksum metadata
  const buf = readFileSync(join(dist, name))
  const sha = createHash('sha256').update(buf).digest('hex')
  lines.push(`${sha}  dist/${name}`)
}
writeFileSync(join(root, 'dist.sha256'), lines.join('\n') + '\n')
console.log(`wrote ${lines.length} checksums`)
