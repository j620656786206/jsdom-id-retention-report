// What does the leak scale with — document size, or number of ids?
//
// If ONE id pins the WHOLE document, retention should track document size and
// be almost flat in id count. That is exactly what happens.
//
//   node --expose-gc 03-scaling.mjs
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'
import { retainedPerCall, jsdomVersion, row, body } from './lib/measure.mjs'

const viaPurify = (html) => {
  const { window } = new JSDOM('')
  const purify = createDOMPurify(window)
  return () => purify.sanitize(html, { FORCE_BODY: true })
}
const ids = (n) => Array.from({ length: n }, (_, i) => `<div id="ad${i}"></div>`).join('')

console.log(`jsdom ${await jsdomVersion()}\n`)
console.log('vary document size, hold id count at 1:')
for (const p of [10, 40, 160]) row(`  ${p} paragraphs + 1 id`, await retainedPerCall(viaPurify(`${body(p)}${ids(1)}`)))
console.log('\nvary id count, hold document size:')
for (const n of [1, 20]) row(`  40 paragraphs + ${n} ids`, await retainedPerCall(viaPurify(`${body(40)}${ids(n)}`)))
