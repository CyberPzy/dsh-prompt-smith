#!/usr/bin/env node
/**
 * dsh-prompt-enhancer 打包脚本。
 *
 * 产出可分发的安装包：dist/@CyberPzy-dsh-prompt-smith-<version>.tgz
 * （npm pack 语义，严格按 package.json 的 "files" 白名单收录），
 * 并生成 .sha256 校验文件。
 *
 * 校验：
 *  - 包名必须与仓库约定一致（@cyberpzy/dsh-prompt-smith）；
 *  - 版本号必须与 CHANGELOG.md 顶部条目一致，不一致直接失败；
 *  - dist 目录先清空再打包，避免混入旧版本产物。
 *
 * 用法：npm run pack:plugin   （等价 node scripts/pack.mjs）
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPECTED_NAME = '@cyberpzy/dsh-prompt-smith'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))

if (pkg.name !== EXPECTED_NAME) {
  console.error(`[pack] FAIL: package.json name "${pkg.name}" !== "${EXPECTED_NAME}"`)
  process.exit(1)
}

const version = pkg.version
if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(version)) {
  console.error(`[pack] FAIL: invalid semver "${version}"`)
  process.exit(1)
}

const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8')
if (!changelog.includes(`## ${version}`)) {
  console.error(`[pack] FAIL: CHANGELOG.md has no "## ${version}" entry — bump the changelog to match package.json`)
  process.exit(1)
}

const dist = join(root, 'dist')
if (existsSync(dist)) rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

console.log(`[pack] packing ${pkg.name}@${version} ...`)

// Windows 下 npm 是 npm.cmd，execFileSync 需要带扩展名才能找到
const packCandidates = process.platform === 'win32'
  ? ['npm.cmd', 'npm', 'pnpm.cmd', 'pnpm']
  : ['npm', 'pnpm']
let tarball = null
let lastError = null
for (const cmd of packCandidates) {
  try {
    // shell:true —— Windows 的 npm/pnpm 是 .cmd 垫片，新版 Node 不带 shell 直接 spawn 会 ENOENT/EINVAL
    const out = execFileSync(cmd, ['pack', '--pack-destination', dist], { cwd: root, encoding: 'utf8', shell: true })
    tarball = out.trim().split('\n').pop()
    break
  } catch (error) {
    lastError = error
  }
}
if (!tarball) {
  console.error('[pack] FAIL: no packer found (tried ' + packCandidates.join(', ') + ').')
  console.error('[pack] Install npm/pnpm, or run inside a shell where it is on PATH.')
  if (lastError) console.error(String(lastError.message || lastError))
  process.exit(1)
}
// shell:true 下 npm 会打印绝对路径，只保留文件名
tarball = basename(tarball.trim())
const tarballPath = join(dist, tarball)

const bytes = readFileSync(tarballPath)
const sha256 = createHash('sha256').update(bytes).digest('hex')
writeFileSync(`${tarballPath}.sha256`, `${sha256}  ${tarball}\n`, 'utf8')

const sizeKb = (bytes.length / 1024).toFixed(1)
console.log(`[pack] OK: dist/${tarball} (${sizeKb} KiB)`)
console.log(`[pack] sha256: ${sha256}`)
console.log('[pack] dist contents:')
for (const f of readdirSync(dist)) console.log(`  - ${f}`)
