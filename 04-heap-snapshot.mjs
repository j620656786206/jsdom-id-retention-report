// Write a heap snapshot after repeatedly parsing an id-bearing document,
// so the retainer chain can be walked with retainers.py.
//
//   node --expose-gc 04-heap-snapshot.mjs   # -> ./out/leak.heapsnapshot
//   python3 retainers.py out/leak.heapsnapshot HTMLDivElementImpl
import { mkdirSync } from 'node:fs'
import v8 from 'node:v8'
import { JSDOM } from 'jsdom'
import { tick, body } from './lib/measure.mjs'

const { window } = new JSDOM('')
const parser = new window.DOMParser()
const html = `<body>${body()}<div id="ad1"></div></body>`

for (let i = 0; i < 120; i += 1) { parser.parseFromString(html, 'text/html'); await tick() }
global.gc(); await tick(); global.gc()

mkdirSync('out', { recursive: true })
console.log('heapUsed(MB):', (process.memoryUsage().heapUsed / 1048576).toFixed(1))
console.log(v8.writeHeapSnapshot('out/leak.heapsnapshot'))
