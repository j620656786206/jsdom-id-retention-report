// Is it really `id`, or just "an extra element"?
// Controls: class / data-* / name are all ignored; id is not.
// Also: element type and position are irrelevant.
//
//   node --expose-gc 02-attribute-ablation.mjs
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'
import { retainedPerCall, jsdomVersion, row, body } from './lib/measure.mjs'

const viaPurify = (html) => {
  const { window } = new JSDOM('')
  const purify = createDOMPurify(window)
  return () => purify.sanitize(html, { FORCE_BODY: true })
}

const B = body()
const CASES = [
  ['baseline: no id',            B],
  ['+ <div id>',                 `${B}<div id="ad1"></div>`],
  ['+ <p id>',                   `${B}<p id="ad1">x</p>`],
  ['+ <span id>',                `${B}<span id="ad1">x</span>`],
  ['+ <div id> first, not last', `<div id="ad1"></div>${B}`],
  ['control: + class',           `${B}<div class="ad1"></div>`],
  ['control: + data-*',          `${B}<div data-x="ad1"></div>`],
  ['control: + name',            `${B}<a name="ad1"></a>`],
]

console.log(`jsdom ${await jsdomVersion()}\n`)
for (const [label, html] of CASES) row(label, await retainedPerCall(viaPurify(html)))
