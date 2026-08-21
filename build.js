#!/usr/bin/env node

/**
 * Build script — concatenates modules into dist/thryft.js,
 * minifies to dist/thryft.min.js, and copies individual modules.
 *
 * Run: node build.js
 * Requires: npm install (terser as devDependency)
 */

const fs = require('fs')
const path = require('path')

const src = path.join(__dirname, 'src')
const dist = path.join(__dirname, 'dist')
const version = require('./package.json').version

const modules = ['fetch', 'tooltip', 'timer', 'sound', 'modal', 'inventory', 'cost']

// Clean and create dist/
if (fs.existsSync(dist)) fs.rmSync(dist, { recursive: true })
fs.mkdirSync(dist)

// Copy individual modules
for (const mod of modules) {
  fs.copyFileSync(path.join(src, mod + '.js'), path.join(dist, mod + '.js'))
}

// Build combined bundle
const header = `/**
 * Thryft v${version} — Game UI toolkit
 * https://github.com/loxleygames/thryft
 * License: MIT
 */
`

let bundle = header
for (const mod of modules) {
  const code = fs.readFileSync(path.join(src, mod + '.js'), 'utf8')
  const stripped = code.replace(/^\/\*\*[\s\S]*?\*\/\s*/, '')
  bundle += '\n// ── ' + mod + ' ──\n' + stripped
}

fs.writeFileSync(path.join(dist, 'thryft.js'), bundle)

// Minify
async function minify() {
  try {
    const { minify } = require('terser')
    const result = await minify(bundle, {
      compress: { passes: 2 },
      mangle: true,
      output: { comments: /^!|@license|@preserve/ },
    })
    const minHeader = `/*! Thryft v${version} | MIT | github.com/loxleygames/thryft */\n`
    fs.writeFileSync(path.join(dist, 'thryft.min.js'), minHeader + result.code)

    const minSize = fs.statSync(path.join(dist, 'thryft.min.js')).size
    console.log(`  thryft.min.js: ${(minSize / 1024).toFixed(1)}KB (minified)`)
  } catch (e) {
    console.log('  (skipping minification — run npm install to enable)')
  }
}

// Report sizes
const stats = modules.map(m => {
  const size = fs.statSync(path.join(dist, m + '.js')).size
  return `  ${m}.js: ${(size / 1024).toFixed(1)}KB`
})
const bundleSize = fs.statSync(path.join(dist, 'thryft.js')).size

console.log('Built to dist/')
console.log(stats.join('\n'))
console.log(`  thryft.js: ${(bundleSize / 1024).toFixed(1)}KB (combined)`)

minify()
