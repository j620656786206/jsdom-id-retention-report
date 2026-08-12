**English** · [繁體中文](RESULTS.zh-TW.md)

# Results

Retained heap per call, in KB, after forced GC. Lower is better; anything under
~1 KB/call is noise on this harness.

Produced by `./run-all.sh` on 2026-08-12. Raw output:
[`results/raw-20260812T071121Z.txt`](results/raw-20260812T071121Z.txt).

| | |
|---|---|
| host | macOS, Node v24.13.0, Docker 29.5.2 |
| container | `node:24.13.0-alpine`, `--memory=4g`, `--max-old-space-size=2048` |
| dompurify | 3.4.13 (scripts 02 and 03 only) |
| iterations | 300 measured, 25 warmup discarded |
| fixture | synthetic Lorem ipsum paragraphs; no production content |

---

## 1. The `id` attribute alone (`01-minimal.mjs`)

Plain jsdom, no sanitizer. One `Window`, 300 `parseFromString()` calls of the
same 40-paragraph document. The only difference between the columns is one empty
`<div id="ad1">`.

| jsdom | no id | one `id` | ratio |
|---|---:|---:|---:|
| 26.1.0 | 0.11 | 0.35 | 3× |
| 27.0.0 | 6.90 | **181.09** | 26× |
| 28.1.0 | 6.88 | **189.73** | 28× |
| 29.1.1 | 0.11 | **161.14** | 1465× |
| 30.0.1 | 0.11 | **161.14** | 1465× |

26.1.0 is clean. The retention appears in 27.0.0 and is still present in 30.0.1,
the latest release at the time of writing.

The 29.1.1 row is where the *no-id* baseline drops from 6.90 back to 0.11 while
the `id` case barely moves — see the upstream-status section of the
[README](README.md#upstream-status).

## 2. It is `id`, not "one more element" (`02-attribute-ablation.mjs`)

Same document plus one extra element, sanitized through DOMPurify. Only the
attribute on that extra element changes.

| case | 26.1.0 | 27.0.0 | 28.1.0 | 29.1.1 | 30.0.1 |
|---|---:|---:|---:|---:|---:|
| baseline: no id | 0.41 | 7.21 | 7.31 | 0.51 | 0.51 |
| `+ <div id>` | 1.02 | **176.85** | **186.04** | **157.40** | **157.50** |
| `+ <p id>` | 0.59 | **176.73** | **186.10** | **158.03** | **158.00** |
| `+ <span id>` | 0.47 | **176.34** | **185.72** | **157.58** | **157.40** |
| `+ <div id>` first, not last | 0.54 | **175.99** | **185.32** | **157.09** | **157.13** |
| control: `+ class` | 0.75 | 7.03 | 6.98 | 0.68 | 0.68 |
| control: `+ data-*` | 0.33 | 7.05 | 6.96 | 0.38 | 0.41 |
| control: `+ name` | 0.44 | 7.06 | 7.19 | 0.53 | 0.57 |

Element type does not matter. Position in the document does not matter.
`class`, `data-*` and `name` all sit at baseline.

On 30.0.1 the contrast is at its cleanest, because the baseline noise is gone:
a `class` attribute costs 0.68 KB/call and an `id` costs 157.50 — a factor of
230 between two attributes on the same element.

## 3. One `id` pins the whole document (`03-scaling.mjs`)

If a single `id` retained only its own element, retention would track id count.
It tracks document size instead.

**Vary document size, hold id count at 1:**

| | 26.1.0 | 27.0.0 | 28.1.0 | 29.1.1 | 30.0.1 |
|---|---:|---:|---:|---:|---:|
| 10 paragraphs | 0.97 | 82.79 | 85.56 | 51.85 | 51.83 |
| 40 paragraphs | 1.20 | 177.06 | 186.49 | 157.68 | 157.47 |
| 160 paragraphs | 0.38 | **551.19** | **586.58** | **579.73** | **579.68** |

**Vary id count, hold document size at 40 paragraphs:**

| | 26.1.0 | 27.0.0 | 28.1.0 | 29.1.1 | 30.0.1 |
|---|---:|---:|---:|---:|---:|
| 1 id | 0.61 | 175.74 | 185.10 | 156.95 | 156.94 |
| 20 ids | 0.36 | 245.62 | 256.14 | 231.33 | 231.31 |

On 30.0.1, growing the document 4× (40 → 160 paragraphs) grows retention 3.7×.
Growing the id count 20× on the same document grows it 1.5×.

`id` decides *whether* the document is retained; document size decides *how much*.

## Real-world magnitude

The fixtures above are Lorem ipsum. On a production CMS article — 41,316 bytes of HTML
with the usual ad slots and anchor targets — the same measurement gives
**~2.7 MB retained per parse**.

That article is not in this repository — it is not mine to publish, which is
exactly the point of the synthetic fixtures: they reproduce the mechanism and
the scaling law without it. The 586 KB/call at 160 paragraphs is the same
phenomenon at a smaller scale.
