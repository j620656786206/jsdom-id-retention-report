// Generate the report's charts as standalone, dependency-free SVG files.
//
//   node charts/build.mjs
//
// Every figure below is read straight out of the committed run in results/.
// Charts are emphasis-form: one accent hue for the id-bearing case, the
// de-emphasis gray for everything that is context. Both themes are baked in
// via prefers-color-scheme, so the same file works on a light or dark page.
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = dirname(fileURLToPath(import.meta.url))

/* ------------------------------------------------------------------ tokens */
const T = {
  light: {
    surface: '#fcfcfb', ink: '#0b0b0b', ink2: '#52514e', muted: '#898781',
    grid: '#e1e0d9', axis: '#c3c2b7', accent: '#2a78d6', context: '#898781',
  },
  dark: {
    surface: '#1a1a19', ink: '#ffffff', ink2: '#c3c2b7', muted: '#898781',
    grid: '#2c2c2a', axis: '#383835', accent: '#3987e5', context: '#898781',
  },
}

const FONT = 'system-ui, -apple-system, "Segoe UI", "PingFang TC", "Noto Sans TC", sans-serif'

/** Theme-aware style block: light values on :root, dark under both scopes. */
const style = () => `
  <style>
    .s { fill: ${T.light.surface} }
    .ink { fill: ${T.light.ink} }  .ink2 { fill: ${T.light.ink2} }
    .muted { fill: ${T.light.muted} }
    .grid { stroke: ${T.light.grid} }  .axis { stroke: ${T.light.axis} }
    .accent { fill: ${T.light.accent} }  .context { fill: ${T.light.context} }
    .gap { stroke: ${T.light.surface} }
    text { font-family: ${FONT}; }
    .t   { font-size: 15px; font-weight: 600 }
    .st  { font-size: 12.5px }
    .lbl { font-size: 12px }
    .val { font-size: 12px; font-weight: 600 }
    .tick { font-size: 11px; font-variant-numeric: tabular-nums }
    @media (prefers-color-scheme: dark) {
      .s { fill: ${T.dark.surface} }
      .ink { fill: ${T.dark.ink} }  .ink2 { fill: ${T.dark.ink2} }
      .muted { fill: ${T.dark.muted} }
      .grid { stroke: ${T.dark.grid} }  .axis { stroke: ${T.dark.axis} }
      .accent { fill: ${T.dark.accent} }  .context { fill: ${T.dark.context} }
      .gap { stroke: ${T.dark.surface} }
    }
  </style>`

/** Values under 10 keep two decimals — 0.35 must not print as "0". */
const fmt = (v) => (v < 10 ? v.toFixed(2) : v.toFixed(0))

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Bar with a 4px rounded data-end, square at the baseline. */
function barH(x, y, w, h, r = 4) {
  const rr = Math.min(r, w)
  return `M${x},${y}h${w - rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - 2 * rr}a${rr},${rr} 0 0 1 ${-rr},${rr}h${-(w - rr)}z`
}
function barV(x, y, w, h, r = 4) {
  const rr = Math.min(r, h)
  return `M${x},${y + h}v${-(h - rr)}a${rr},${rr} 0 0 1 ${rr},${-rr}h${w - 2 * rr}a${rr},${rr} 0 0 1 ${rr},${rr}v${h - rr}z`
}

const svg = (w, h, title, desc, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="t d">
  <title id="t">${esc(title)}</title>
  <desc id="d">${esc(desc)}</desc>${style()}
  <rect width="${w}" height="${h}" rx="8" class="s"/>
${body}
</svg>
`

/* ------------------------------------------------------- 1. attribute ablation */
const K = {
  p: '+ <p id>', div: '+ <div id>', span: '+ <span id>',
  first: { en: '+ <div id> first', zh: '+ <div id> 放最前面' },
  cls: '+ class', name: '+ name', data: '+ data-*',
  base: { en: 'baseline (no id)', zh: '基準（無 id）' },
}
// Sorted descending; the id/control split falls out of the ordering.
const ABLATION = {
  '30.0.1': { max: 175, step: 25, rows: [
    { k: K.p, v: 158.0, id: true }, { k: K.div, v: 157.5, id: true },
    { k: K.span, v: 157.4, id: true }, { k: K.first, v: 157.13, id: true },
    { k: K.cls, v: 0.68 }, { k: K.name, v: 0.57 }, { k: K.base, v: 0.51 }, { k: K.data, v: 0.41 },
  ] },
  '28.1.0': { max: 200, step: 50, rows: [
    { k: K.p, v: 186.1, id: true }, { k: K.div, v: 186.04, id: true },
    { k: K.span, v: 185.72, id: true }, { k: K.first, v: 185.32, id: true },
    { k: K.base, v: 7.31 }, { k: K.name, v: 7.19 }, { k: K.cls, v: 6.98 }, { k: K.data, v: 6.96 },
  ] },
}

function ablation(loc, ver = '30.0.1') {
  const { max, step, rows: ROWS } = ABLATION[ver]
  const W = 760, H = 400
  const L = 168, R = 76, TOP = 74, BOT = 40
  const pw = W - L - R, ph = H - TOP - BOT
  const band = ph / ROWS.length
  const bh = Math.min(24, band - 2)      // ≤24px, 2px surface gap between bars
  const x = (v) => Math.max(1.5, (v / max) * pw)

  let g = ''
  for (let i = 0; i <= max; i += step) {
    const gx = L + (i / max) * pw
    g += `  <line x1="${gx}" y1="${TOP}" x2="${gx}" y2="${TOP + ph}" class="grid" stroke-width="1"/>\n`
    g += `  <text x="${gx}" y="${TOP + ph + 18}" class="tick muted" text-anchor="middle">${i}</text>\n`
  }
  g += `  <line x1="${L}" y1="${TOP}" x2="${L}" y2="${TOP + ph}" class="axis" stroke-width="1"/>\n`

  ROWS.forEach((d, i) => {
    const y = TOP + i * band + (band - bh) / 2
    const w = x(d.v)
    const label = typeof d.k === 'string' ? d.k : d.k[loc]
    g += `  <path d="${barH(L, y, w, bh)}" class="${d.id ? 'accent' : 'context'}"/>\n`
    g += `  <text x="${L - 10}" y="${y + bh / 2 + 4}" class="lbl ink2" text-anchor="end">${esc(label)}</text>\n`
    g += `  <text x="${L + w + 8}" y="${y + bh / 2 + 4}" class="val ink">${d.v.toFixed(2)}</text>\n`
  })

  const t = loc === 'zh'
    ? { title: '一個屬性就決定漏不漏', sub: `每次解析的殘留（KB/call），jsdom ${ver}`, a: '帶 id', b: '對照組', unit: 'KB/call' }
    : { title: 'One attribute decides it', sub: `Retained heap per parse (KB/call), jsdom ${ver}`, a: 'id-bearing', b: 'control', unit: 'KB/call' }

  let head = `  <text x="24" y="30" class="t ink">${esc(t.title)}</text>\n`
  head += `  <text x="24" y="50" class="st ink2">${esc(t.sub)}</text>\n`
  // legend — two visual classes, so identity is never colour-alone
  head += `  <rect x="${W - 214}" y="22" width="10" height="10" rx="2" class="accent"/>\n`
  head += `  <text x="${W - 199}" y="31" class="lbl ink2">${esc(t.a)}</text>\n`
  head += `  <rect x="${W - 214 + 78}" y="22" width="10" height="10" rx="2" class="context"/>\n`
  head += `  <text x="${W - 199 + 78}" y="31" class="lbl ink2">${esc(t.b)}</text>\n`
  head += `  <text x="${W - 24}" y="${H - 12}" class="tick muted" text-anchor="end">${esc(t.unit)}</text>\n`

  const desc = ROWS.map((d) => `${typeof d.k === 'string' ? d.k : d.k.en} ${d.v}`).join('; ')
  return svg(W, H, t.title, `${t.sub}. ${desc}`, head + g)
}

/* --------------------------------------------------------- 2. version boundary */
const VERSIONS = [
  { v: '26.1.0', no: 0.11, yes: 0.35 },
  { v: '27.0.0', no: 6.9, yes: 181.09 },
  { v: '28.1.0', no: 6.88, yes: 189.73 },
  { v: '29.1.1', no: 0.11, yes: 161.14 },
  { v: '30.0.1', no: 0.11, yes: 161.14 },
]

function versions(loc) {
  const W = 760, H = 400
  const L = 56, R = 24, TOP = 78, BOT = 54
  const pw = W - L - R, ph = H - TOP - BOT
  const max = 200
  const band = pw / VERSIONS.length
  const bw = Math.min(24, (band - 6) / 2)
  const y = (v) => (v / max) * ph

  let g = ''
  for (let i = 0; i <= 200; i += 50) {
    const gy = TOP + ph - (i / max) * ph
    g += `  <line x1="${L}" y1="${gy}" x2="${L + pw}" y2="${gy}" class="grid" stroke-width="1"/>\n`
    g += `  <text x="${L - 10}" y="${gy + 4}" class="tick muted" text-anchor="end">${i}</text>\n`
  }
  g += `  <line x1="${L}" y1="${TOP + ph}" x2="${L + pw}" y2="${TOP + ph}" class="axis" stroke-width="1"/>\n`

  VERSIONS.forEach((d, i) => {
    const cx = L + i * band + band / 2
    const x1 = cx - bw - 1, x2 = cx + 1     // 2px surface gap between the pair
    g += `  <path d="${barV(x1, TOP + ph - y(d.no), bw, y(d.no))}" class="context"/>\n`
    g += `  <path d="${barV(x2, TOP + ph - y(d.yes), bw, y(d.yes))}" class="accent"/>\n`
    g += `  <text x="${x2 + bw / 2}" y="${TOP + ph - y(d.yes) - 8}" class="val ink" text-anchor="middle">${fmt(d.yes)}</text>\n`
    g += `  <text x="${cx}" y="${TOP + ph + 20}" class="lbl ink2" text-anchor="middle">${d.v}</text>\n`
  })

  const t = loc === 'zh'
    ? { title: '缺陷從 27 進來，到 30.0.1 仍未修', sub: '同一份文件解析 300 次，唯一差異是一個 id 屬性', a: '有一個 id', b: '無 id', note: '26.1.0 兩種情況都乾淨', unit: 'KB/call' }
    : { title: 'Introduced in 27, still present in 30.0.1', sub: 'Same document parsed 300×; the only difference is one id attribute', a: 'one id', b: 'no id', note: '26.1.0 is clean in both cases', unit: 'KB/call' }

  let head = `  <text x="24" y="30" class="t ink">${esc(t.title)}</text>\n`
  head += `  <text x="24" y="50" class="st ink2">${esc(t.sub)}</text>\n`
  head += `  <rect x="${W - 214}" y="22" width="10" height="10" rx="2" class="accent"/>\n`
  head += `  <text x="${W - 199}" y="31" class="lbl ink2">${esc(t.a)}</text>\n`
  head += `  <rect x="${W - 214 + 88}" y="22" width="10" height="10" rx="2" class="context"/>\n`
  head += `  <text x="${W - 199 + 88}" y="31" class="lbl ink2">${esc(t.b)}</text>\n`
  head += `  <text x="24" y="${H - 14}" class="tick muted">${esc(t.note)}</text>\n`
  head += `  <text x="${W - 24}" y="${H - 14}" class="tick muted" text-anchor="end">${esc(t.unit)}</text>\n`

  const desc = VERSIONS.map((d) => `jsdom ${d.v}: no id ${d.no}, one id ${d.yes}`).join('; ')
  return svg(W, H, t.title, `${t.sub}. ${desc}`, head + g)
}

/* ------------------------------------------------------------------ 3. scaling */
const SCALING = {
  '30.0.1': { a: [51.83, 157.47, 579.68], b: [156.94, 231.31], na: [4, 3.7], nb: [20, 1.5] },
  '28.1.0': { a: [85.56, 186.49, 586.58], b: [185.10, 256.14], na: [4, 3.1], nb: [20, 1.4] },
}

function scaling(loc, ver = '30.0.1') {
  const { a: A, b: B, na, nb } = SCALING[ver]
  const W = 760, H = 380
  const TOP = 100, BOT = 56
  const ph = H - TOP - BOT
  const max = 600
  const y = (v) => (v / max) * ph

  const t = loc === 'zh'
    ? {
        title: 'id 決定漏不漏，文件大小決定漏多少',
        sub: `兩張圖共用同一條 y 軸（jsdom ${ver}）`,
        pa: '改變文件大小，id 固定 1 個', pb: '改變 id 數量，文件固定 40 段',
        a: ['10 段', '40 段', '160 段'], b: ['1 個 id', '20 個 id'],
        na: `文件放大 ${na[0]}×，殘留 ${na[1]}×`, nb: `id 放大 ${nb[0]}×，殘留只有 ${nb[1]}×`, unit: 'KB/call',
      }
    : {
        title: 'id decides whether; size decides how much',
        sub: `Both panels share one y-axis (jsdom ${ver})`,
        pa: 'Vary document size, hold id count at 1', pb: 'Vary id count, hold size at 40 paragraphs',
        a: ['10 para', '40 para', '160 para'], b: ['1 id', '20 ids'],
        na: `${na[0]}× the document → ${na[1]}× the retention`, nb: `${nb[0]}× the ids → only ${nb[1]}×`, unit: 'KB/call',
      }

  const panel = (x0, pw, vals, labels, title, note) => {
    let g = `  <text x="${x0}" y="${TOP - 26}" class="st ink2">${esc(title)}</text>\n`
    const band = pw / vals.length
    const bw = Math.min(24, band - 16)
    vals.forEach((v, i) => {
      const cx = x0 + i * band + band / 2
      g += `  <path d="${barV(cx - bw / 2, TOP + ph - y(v), bw, y(v))}" class="accent"/>\n`
      g += `  <text x="${cx}" y="${TOP + ph - y(v) - 8}" class="val ink" text-anchor="middle">${fmt(v)}</text>\n`
      g += `  <text x="${cx}" y="${TOP + ph + 20}" class="lbl ink2" text-anchor="middle">${esc(labels[i])}</text>\n`
    })
    g += `  <text x="${x0}" y="${TOP + ph + 44}" class="tick muted">${esc(note)}</text>\n`
    return g
  }

  let g = ''
  for (let i = 0; i <= 600; i += 200) {
    const gy = TOP + ph - (i / max) * ph
    g += `  <line x1="56" y1="${gy}" x2="${W - 24}" y2="${gy}" class="grid" stroke-width="1"/>\n`
    g += `  <text x="46" y="${gy + 4}" class="tick muted" text-anchor="end">${i}</text>\n`
  }
  g += `  <line x1="56" y1="${TOP + ph}" x2="${W - 24}" y2="${TOP + ph}" class="axis" stroke-width="1"/>\n`
  g += panel(72, 330, A, t.a, t.pa, t.na)
  g += `  <line x1="428" y1="${TOP - 44}" x2="428" y2="${TOP + ph}" class="grid" stroke-width="1"/>\n`
  g += panel(452, 260, B, t.b, t.pb, t.nb)

  let head = `  <text x="24" y="30" class="t ink">${esc(t.title)}</text>\n`
  head += `  <text x="24" y="50" class="st ink2">${esc(t.sub)}</text>\n`
  head += `  <text x="${W - 24}" y="30" class="tick muted" text-anchor="end">${esc(t.unit)}</text>\n`

  return svg(W, H, t.title, `${t.sub}. ${t.pa}: ${A.join(', ')}. ${t.pb}: ${B.join(', ')}`, head + g)
}

/* ----------------------------------------------------------- 4. retainer chain */
function retainer(loc) {
  const W = 760, H = 330
  const t = loc === 'zh'
    ? {
        title: '為什麼收不回來', sub: '從 heap snapshot 反向走訪到 GC root',
        nodes: ['GC roots', 'Window', 'Map', 'Set', 'HTMLDivElementImpl'],
        notes: ['', '常駐，行程活著就不會釋放', 'key 是 id 字串', '每解析一次就多一個，沒有移除路徑', '→ 拉住整份文件'],
        edge: 'WeakMap[key = Window]',
      }
    : {
        title: 'Why it is never collected', sub: 'Walked back from a heap snapshot to a GC root',
        nodes: ['GC roots', 'Window', 'Map', 'Set', 'HTMLDivElementImpl'],
        notes: ['', 'long-lived; never released', 'keyed by id string', 'one more per parse, never removed', '→ retains the whole document'],
        edge: 'WeakMap[key = Window]',
      }

  let g = `  <text x="24" y="30" class="t ink">${esc(t.title)}</text>\n`
  g += `  <text x="24" y="50" class="st ink2">${esc(t.sub)}</text>\n`

  const x0 = 40, bw = 200, bh = 34, step = 52
  t.nodes.forEach((n, i) => {
    const y = 84 + i * step
    const x = x0 + i * 26
    const last = i === t.nodes.length - 1
    g += `  <rect x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6" class="${last || i === 1 ? 'accent' : 'context'}" opacity="${last || i === 1 ? 1 : 0.28}"/>\n`
    g += `  <text x="${x + 12}" y="${y + 22}" class="lbl ${last || i === 1 ? 's' : 'ink'}" font-weight="600">${esc(n)}</text>\n`
    if (t.notes[i]) g += `  <text x="${x + bw + 14}" y="${y + 22}" class="lbl ink2">${esc(t.notes[i])}</text>\n`
    if (i < t.nodes.length - 1) {
      const cx = x + 16
      g += `  <line x1="${cx}" y1="${y + bh}" x2="${cx}" y2="${y + step}" class="axis" stroke-width="2"/>\n`
      if (i === 1) g += `  <text x="${cx + 10}" y="${y + bh + 16}" class="tick muted">${esc(t.edge)}</text>\n`
    }
  })
  return svg(W, H, t.title, `${t.title}: ${t.nodes.join(' → ')}`, g)
}

/* --------------------------------------------------------------------- write */
mkdirSync(OUT, { recursive: true })
const files = []
for (const loc of ['en', 'zh']) {
  const sfx = loc === 'en' ? '' : '.zh-TW'
  const set = {
    [`attribute-ablation${sfx}.svg`]: ablation(loc),
    [`attribute-ablation.v28${sfx}.svg`]: ablation(loc, '28.1.0'),
    [`version-boundary${sfx}.svg`]: versions(loc),
    [`scaling${sfx}.svg`]: scaling(loc),
    [`scaling.v28${sfx}.svg`]: scaling(loc, '28.1.0'),
    [`retainer-chain${sfx}.svg`]: retainer(loc),
  }
  for (const [name, content] of Object.entries(set)) {
    writeFileSync(join(OUT, name), content)
    files.push(name)
  }
}
console.log(`wrote ${files.length} files:\n  ${files.join('\n  ')}`)
