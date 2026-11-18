#!/usr/bin/env node
/**
 * 命名守卫：插件的内部标识必须只有一个名字。
 *
 * DSH 社区惯例（dsh-client-auto-continue → auto-continue、dsh-opencode-balance
 * → opencode-balance、dsh-notify-me 行 id → notify-me）：内部标识用「包名去掉
 * dsh- 前缀」的短名，不在内部重复包前缀；HTTP 路由则沿用包名风格。
 *
 * 本插件内部标识 = prompt-smith；代码与配置里出现旧名即视为不一致，直接失败。
 * 文档（README / CHANGELOG / docs）允许提及历史沿革，不参与检查。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const IDENTITY = 'prompt-smith'
const LEGACY = /prompt[-_]?enhancer/i
const CHECKED = [
  'index.js',
  'client.js',
  'cordis.patch.yml',
  'package.json',
  ...readdirSync(join(ROOT, 'locale')).map((f) => join('locale', f)),
]

const problems = []

for (const rel of CHECKED) {
  let text
  try {
    text = readFileSync(join(ROOT, rel), 'utf8')
  } catch {
    problems.push(`${rel}: 无法读取`)
    continue
  }
  text.split(/\r?\n/).forEach((line, i) => {
    if (LEGACY.test(line)) problems.push(`${rel}:${i + 1}: 出现旧标识 — ${line.trim()}`)
  })
}

// 关键位置必须落在统一短名上
const expectations = [
  ['cordis.patch.yml', `- id: ${IDENTITY}`],
  ['index.js', `export const name = '${IDENTITY}'`],
  ['client.js', `const NS = '${IDENTITY}'`],
]
for (const [rel, needle] of expectations) {
  const text = readFileSync(join(ROOT, rel), 'utf8')
  if (!text.includes(needle)) problems.push(`${rel}: 缺少统一标识 ${needle}`)
}

if (problems.length > 0) {
  console.error(`✗ 命名检查未通过：${problems.length} 处问题（内部标识应统一为 ${IDENTITY}）`)
  for (const p of problems) console.error(`  ${p}`)
  process.exit(1)
}

console.log(`✓ 命名检查通过：代码与配置的内部标识统一为 ${IDENTITY}`)
