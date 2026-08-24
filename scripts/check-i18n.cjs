// Post-build check over docs/.vitepress/dist: every internal link resolves,
// every fragment exists, and the Chinese mirror under /zh/ has the same pages
// and the same heading anchors as the English tree.
//
// Anchors are read out of the built HTML rather than recomputed from the
// markdown, because reimplementing VitePress's slugifier gets it wrong in
// exactly the cases that matter (punctuation, leading digits).
//
//   npm run check
'use strict'

const fs = require('fs')
const path = require('path')

const DIST = path.join(__dirname, '..', 'docs', '.vitepress', 'dist')

if (!fs.existsSync(DIST)) {
  console.error(`no build output at ${DIST} — run npm run build first`)
  process.exit(1)
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.html')) out.push(p)
  }
  return out
}

// dist/godicom/index.html -> /godicom/ ; dist/index.html -> / ; dist/a/b.html -> /a/b
function toUrl(file) {
  let rel = path.relative(DIST, file).split(path.sep).join('/').replace(/\.html$/, '')
  if (rel === 'index') return '/'
  if (rel.endsWith('/index')) return '/' + rel.slice(0, -'/index'.length) + '/'
  return '/' + rel
}

// Only the ids VitePress puts on headings; the theme's own scaffolding ids
// (#app, #VPSidebarNav, …) are not link targets.
function headingAnchors(html) {
  const set = new Set()
  const re = /<h[2-6][^>]*\bid="([^"]+)"/g
  let m
  while ((m = re.exec(html)) !== null) set.add(m[1])
  return set
}

// Every internal page link on the page — content, nav and sidebar alike, so a
// bad link in config.mts is caught too. Assets are not page links.
function internalLinks(html) {
  const out = []
  const re = /href="(\/[^"#]*)(#[^"]*)?"/g
  let m
  while ((m = re.exec(html)) !== null) {
    const target = m[1]
    if (!(target === '/' || target.endsWith('/') || target.endsWith('.html'))) continue
    out.push([target, m[2] ? m[2].slice(1) : ''])
  }
  return out
}

const files = walk(DIST)
const pages = new Map() // url -> { anchors, links }
for (const file of files) {
  const html = fs.readFileSync(file, 'utf8')
  pages.set(toUrl(file), { anchors: headingAnchors(html), links: internalLinks(html) })
}

const errors = []
const has = (url) => pages.has(url) || pages.has(url.replace(/\/$/, '')) || pages.has(url + '/')
const resolve = (url) =>
  pages.has(url) ? url : pages.has(url + '/') ? url + '/' : url.replace(/\/$/, '')

// 1. Internal links resolve, fragment included.
for (const [url, page] of pages) {
  for (const [target, frag] of page.links) {
    const t = target.replace(/\.html$/, '').replace(/\/index$/, '/')
    if (!has(t)) {
      errors.push(`${url}: link to missing page ${target}`)
      continue
    }
    if (frag && !pages.get(resolve(t)).anchors.has(frag)) {
      errors.push(`${url}: no anchor #${frag} on ${t}`)
    }
  }
}

// 2. The two trees mirror each other, page for page, anchor for anchor.
for (const url of pages.keys()) {
  if (url.startsWith('/zh/') || url === '/zh') continue
  if (url === '/404') continue
  const zh = url === '/' ? '/zh/' : '/zh' + url
  if (!has(zh)) {
    errors.push(`missing Chinese page for ${url} (expected ${zh})`)
    continue
  }
  const en = pages.get(url).anchors
  const cn = pages.get(resolve(zh)).anchors
  for (const a of en) if (!cn.has(a)) errors.push(`${zh}: missing anchor #${a} present on ${url}`)
  for (const a of cn) if (!en.has(a)) errors.push(`${zh}: extra anchor #${a} not on ${url}`)
}
for (const url of pages.keys()) {
  if (!url.startsWith('/zh')) continue
  const en = url === '/zh/' || url === '/zh' ? '/' : url.slice('/zh'.length)
  if (!has(en)) errors.push(`missing English page for ${url} (expected ${en})`)
}

if (errors.length) {
  for (const e of errors) console.error(e)
  console.error(`\n${errors.length} problem(s)`)
  process.exit(1)
}
const anchors = [...pages.values()].reduce((n, p) => n + p.anchors.size, 0)
const links = [...pages.values()].reduce((n, p) => n + p.links.length, 0)
console.log(`ok: ${pages.size} pages, ${anchors} anchors, ${links} internal links`)
