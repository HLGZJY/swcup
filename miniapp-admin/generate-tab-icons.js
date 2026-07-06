/**
 * 批量生成 admin 端 tabBar 图标
 * 配色: normal=#999999, active=#FF6B6B
 * 尺寸: 81x81 PNG, 透明背景
 *
 * 5 个 tab × 2 状态 (normal+active) = 10 张
 * tab-user 已有,只生成 8 张新图
 */

const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const OUT_DIR = 'F:/swcup2026/miniapp-admin/src/static'

// 用户提供的 5 个 Tabler Icons SVG (提取 path 数据,viewBox 24x24)
const ICONS = {
  home: `
    <path d="M5 12l-2 0l9 -9l9 9l-2 0"/>
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/>
    <path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6"/>
  `,
  audit: `
    <path d="M13 15.5v-6.5a1 1 0 0 1 1 -1h6a1 1 0 0 1 1 1v4"/>
    <path d="M18 8v-3a1 1 0 0 0 -1 -1h-13a1 1 0 0 0 -1 1v12a1 1 0 0 0 1 1h7"/>
    <path d="M16 9h2"/>
    <path d="M15 19l2 2l4 -4"/>
  `,
  animal: `
    <path d="M14.7 13.5c-1.1 -2 -1.441 -2.5 -2.7 -2.5c-1.259 0 -1.736 .755 -2.836 2.747c-.942 1.703 -2.846 1.845 -3.321 3.291c-.097 .265 -.145 .677 -.143 .962c0 1.176 .787 2 1.8 2c1.259 0 3 -1 4.5 -1s3.241 1 4.5 1c1.013 0 1.8 -.823 1.8 -2c0 -.285 -.049 -.697 -.146 -.962c-.475 -1.451 -2.512 -1.835 -3.454 -3.538"/>
    <path d="M20.188 8.082a1.039 1.039 0 0 0 -.406 -.082h-.015c-.735 .012 -1.56 .75 -1.993 1.866c-.519 1.335 -.28 2.7 .538 3.052c.129 .055 .267 .082 .406 .082c.739 0 1.575 -.742 2.011 -1.866c.516 -1.335 .273 -2.7 -.54 -3.052l-.001 0"/>
    <path d="M9.474 9c.055 0 .109 0 .163 -.011c.944 -.128 1.533 -1.346 1.32 -2.722c-.203 -1.297 -1.047 -2.267 -1.932 -2.267c-.055 0 -.109 0 -.163 .011c-.944 .128 -1.533 1.346 -1.32 2.722c.204 1.293 1.048 2.267 1.933 2.267"/>
    <path d="M16.456 6.733c.214 -1.376 -.375 -2.594 -1.32 -2.722a1.164 1.164 0 0 0 -.162 -.011c-.885 0 -1.728 .97 -1.93 2.267c-.214 1.376 .375 2.594 1.32 2.722c.054 .007 .108 .011 .162 .011c.885 0 1.73 -.974 1.93 -2.267"/>
    <path d="M5.69 12.918c.816 -.352 1.054 -1.719 .536 -3.052c-.436 -1.124 -1.271 -1.866 -2.009 -1.866c-.14 0 -.277 .027 -.407 .082c-.816 .352 -1.054 1.719 -.536 3.052c.436 1.124 1.271 1.866 2.009 1.866c.14 0 .277 -.027 .407 -.082"/>
  `,
  event: `
    <path d="M4 7a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -12"/>
    <path d="M16 3l0 4"/>
    <path d="M8 3l0 4"/>
    <path d="M4 11l16 0"/>
    <path d="M8 15h2v2h-2l0 -2"/>
  `,
  user: `
    <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0"/>
    <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2"/>
  `
}

const COLORS = {
  normal: '#999999',
  active: '#FF6B6B'
}

async function generate(name, paths, color, suffix = '') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="81" height="81" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`
  const fileName = suffix ? `tab-${name}${suffix}.png` : `tab-${name}.png`
  const outPath = path.join(OUT_DIR, fileName)
  await sharp(Buffer.from(svg))
    .resize(81, 81)
    .png()
    .toFile(outPath)
  const stats = fs.statSync(outPath)
  console.log(`✓ ${fileName} (${stats.size} bytes)`)
}

async function main() {
  for (const [name, paths] of Object.entries(ICONS)) {
    await generate(name, paths, COLORS.normal)
    await generate(name, paths, COLORS.active, '-active')
  }
  console.log(`\n全部生成完成 → ${OUT_DIR}`)
}

main().catch(err => { console.error(err); process.exit(1) })
