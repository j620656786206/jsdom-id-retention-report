// THE HEADLINE PROOF — 20 lines, no DOMPurify, no sanitizer, just jsdom.
//
// Parse the same document 300 times from ONE long-lived Window.
// The only difference between the two cases is a single `id` attribute.
//
//   node --expose-gc 01-minimal.mjs
import { JSDOM } from 'jsdom'
import { retainedPerCall, jsdomVersion, row, body } from './lib/measure.mjs'

const parseRepeatedly = (html) => {
  const { window } = new JSDOM('')          // one Window, reused — like a server would
  const parser = new window.DOMParser()
  return () => parser.parseFromString(html, 'text/html')
}

console.log(`jsdom ${await jsdomVersion()}\n`)
row('no id attribute', await retainedPerCall(parseRepeatedly(`<body>${body()}</body>`)))
row('one <div id="ad1">', await retainedPerCall(parseRepeatedly(`<body>${body()}<div id="ad1"></div></body>`)))
