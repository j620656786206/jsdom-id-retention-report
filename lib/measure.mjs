// Shared measurement helper.
//
// Two disciplines matter here, and getting either wrong produces garbage:
//
//  1. Force GC before and after, and require --expose-gc. Without it you are
//     measuring "garbage not yet collected", not retention.
//  2. Yield to the event loop inside the loop. jsdom defers some cleanup to
//     finalizers, which never run inside a fully synchronous tight loop. A
//     synchronous benchmark will report a leak that does not exist in a real
//     async server.
export const tick = () => new Promise((r) => setImmediate(r))

export const settle = async () => {
  if (typeof global.gc !== 'function') {
    throw new Error('run node with --expose-gc')
  }
  global.gc(); await tick()
  global.gc(); await tick()
  global.gc()
}

/**
 * Returns retained bytes per call, in KB.
 * @param {() => any} run  one unit of work
 * @param {number} n       measured iterations
 * @param {number} warmup  iterations discarded before measuring (JIT + lazy module init)
 */
export const retainedPerCall = async (run, n = 300, warmup = 25) => {
  for (let i = 0; i < warmup; i += 1) { run(); await tick() }
  await settle()
  const before = process.memoryUsage().heapUsed
  for (let i = 0; i < n; i += 1) { run(); if (i % 10 === 0) await tick() }
  await settle()
  return (process.memoryUsage().heapUsed - before) / n / 1024
}

export const jsdomVersion = async () =>
  (await import('jsdom/package.json', { with: { type: 'json' } })).default.version

export const row = (label, kb) => console.log(`${label.padEnd(34)}${kb.toFixed(2).padStart(10)} KB/call`)

/** Synthetic article body. Deliberately contains NO id attribute. */
export const body = (paragraphs = 40) =>
  '<p>Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>'.repeat(paragraphs)
