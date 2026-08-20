// Node ESM, zero deps, Windows-safe (no `cp`, no shell globbing, no symlinks).
import { copyFileSync, mkdirSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../data/processed/projections.json')
const dest = resolve(here, '../public/data/projections.json')

if (!existsSync(src)) {
  console.error(
    `Missing ${src}\nRun the pipeline first:  .\\.venv\\Scripts\\python scripts\\build_dataset.py`,
  )
  process.exit(1) // fail loud -- matches the Phase 1 pipeline's no-silent-fallback ethos
}

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log(`Copied projections.json (${(statSync(src).size / 1024).toFixed(0)} KB) -> public/data/`)
