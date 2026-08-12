[English](README.md) · **繁體中文**

# jsdom `id` 屬性造成整份文件殘留——記憶體洩漏報告

> **在 jsdom ≥ 27，從一個常駐的 `Window` 解析出來的文件，只要裡面含有任何一個帶
> `id` 屬性的元素，整份文件就會被永久保留。** 到 30.0.1 仍然存在。

以下每一個數字都由本 repo 的腳本實跑產生，該次執行的原始輸出 commit 在
[`results/`](results/)——macOS、Node v24.13.0、Docker 29.5.2、2026-08-12。

會不會發生，只由 `id` 屬性決定。元素種類與位置都無關；文件大小只決定**漏多少**。
`class`、`data-*`、`name` 完全不會觸發。

---

## 為什麼這件事重要

「一個常駐的 `Window`，加上許多用完就丟的 `Document`」正是 server 端 HTML
sanitizer 的標準形狀。建立 `Window` 的成本很高，所以每個 server 端的 wrapper 都會在模組
載入時建一次，之後每一筆進來的內容都拿它來解析：

```js
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

// 一個 Window，用到行程結束
const purify = createDOMPurify(new JSDOM('').window)

export const sanitize = (html) => purify.sanitize(html)
```

真實世界的 CMS 內容裡到處都是 `id`——廣告版位、錨點、目錄跳轉。在這個形狀下，每一個
request 都可能永久留下它自己那份完整文件，一次幾 MB，直到行程死掉。

公開張貼的最小重現通常長得像 `<p>Hello</p>` 這種，**裡面沒有 `id`**，所以量出來的洩漏比
真實世界的小了大約兩個數量級。就我看到的證據，這個取樣落差正是它一直被歸類成效能回歸、
而不是記憶體缺陷的原因。

---

## 最小重現

不需要任何 sanitizer，純 jsdom 就能重現。同一份文件從同一個 `Window` 解析 300 次，兩列
唯一的差別是一個 `id` 屬性：

```js
// 01-minimal.mjs
import { JSDOM } from 'jsdom'
import { retainedPerCall, row, body } from './lib/measure.mjs'

const parseRepeatedly = (html) => {
  const { window } = new JSDOM('')          // 一個 Window，重複使用，跟 server 上一樣
  const parser = new window.DOMParser()
  return () => parser.parseFromString(html, 'text/html')
}

row('no id attribute',   await retainedPerCall(parseRepeatedly(`<body>${body()}</body>`)))
row('one <div id="ad1">', await retainedPerCall(parseRepeatedly(`<body>${body()}<div id="ad1"></div></body>`)))
```

`body()` 是 40 段 Lorem ipsum，刻意不含任何 `id`。附加上去的 `<div id="ad1">` 是空的——
它留下來的東西不是它自己的內容。

---

## 結果

每次呼叫的殘留堆積（KB），量測前後都強制 GC。每個版本的完整表格在
[RESULTS.zh-TW.md](RESULTS.zh-TW.md)，原始 log 在 [`results/`](results/)。

**版本邊界**（`01-minimal.mjs`，純 jsdom、無 sanitizer）：

| jsdom | 無 id | 有一個 `id` | |
|---|---:|---:|---|
| 26.1.0 | 0.11 | 0.35 | 乾淨 |
| 27.0.0 | 6.90 | **181.09** | 缺陷從這裡進來 |
| 28.1.0 | 6.88 | **189.73** | |
| 29.1.1 | 0.11 | **161.14** | 基準被修好了，缺陷還在 |
| 30.0.1 | 0.11 | **161.14** | 仍未修 |

**是 `id`，不是「多了一個元素」**（`02-attribute-ablation.mjs`，jsdom 30.0.1）：

| | 殘留 |
|---|---:|
| 基準（無 id） | 0.51 KB/call |
| `+ <div id>` | **157.50** |
| `+ <p id>` | **158.00** |
| `+ <span id>` | **157.40** |
| `+ <div id>` 放最前面而非最後面 | **157.13** |
| 對照：`+ class` | 0.68 |
| 對照：`+ data-*` | 0.41 |
| 對照：`+ name` | 0.57 |

元素種類無關、位置無關，另外三個屬性都停在基準線。同一個元素上的兩個屬性，差了 230 倍。

**一個 `id` 釘住的是整份文件**（`03-scaling.mjs`，jsdom 30.0.1）：

| | 殘留 |
|---|---:|
| 10 段 + 1 個 id | 51.83 KB/call |
| 40 段 + 1 個 id | 157.47 |
| 160 段 + 1 個 id | **579.68** |
| 40 段 + **20** 個 id | 231.31 |

殘留跟著文件大小走，不跟著 id 數量走。一個 `id` 是開關，不是刻度。

換成正式站的 CMS 文章——41,316 bytes 的 HTML，帶著常見的廣告版位與錨點——同樣的量測給出
**每次解析約 2.7 MB**。那份文件不在這個 repo 裡；合成的 fixture 已經足以重現整個機制與
scaling law。

---

## 保留路徑

`04-heap-snapshot.mjs` 會把一份含 `id` 的文件解析 120 次並寫出 V8 heap snapshot；
`retainers.py` 再把存活下來最大的那個 `HTMLDivElementImpl` 反向走訪回 GC root，過程中跳過
weak edge：

```bash
node --expose-gc 04-heap-snapshot.mjs
python3 retainers.py out/leak.heapsnapshot HTMLDivElementImpl
```

實際輸出（節錄，完整的走訪在 [`results/retainer-chain.txt`](results/retainer-chain.txt)）：

```
═══ retainer chain of HTMLDivElementImpl [object] sz=328 ═══
  (GC roots) [synthetic]
    --element:19-->
  (Stack roots) [synthetic]
    --internal:33-->
  Window [object] sz=24
    --internal:5 / part of key (Window @7235) -> value (Map @311695) pair in WeakMap (table @310159)-->
  Map [object] sz=32
    --internal:table-->
   [array] sz=152
    --internal:6-->
  Set [object] sz=32
    --internal:table-->
   [array] sz=2600            ← 每解析一次就長一點
    --internal:83-->
  HTMLDivElementImpl [object] sz=328
```

畫成形狀：

```
GC roots
  └─ Window                              （常駐，行程活著就不會釋放）
       └─ WeakMap[key = Window] → Map    （key 是 id 字串）
            └─ Set                       （具該 id 的元素集合）
                 └─ HTMLDivElementImpl → …整份文件
```

那個 `Set` 的底層陣列隨解析次數線性成長，沒有任何移除路徑。而一個元素被留住，它的
`parentNode` 就跟著活著，於是整棵樹都留下來。

這是一個 `id → element` 查詢快取的形狀，而它掛在 **`Window`** 層級，不是 **`Document`**
層級。從那個 `Window` 解析出來的每一份 `Document`，都把自己帶 `id` 的元素塞進這個共用快取，
而且永遠不會被移除。

> 這是從保留路徑的形狀、加上「`id` 是唯一觸發條件」推出來的，不是逐行讀 jsdom 內部實作
> 得到的。如果維護者看到這裡、發現真正的機制是旁邊某個東西，上面那些量測結果依然成立。

---

## 上游狀態

這個機制在公開的 tracker 上看得到，只是換了幾種名字。沒有一個叫做「jsdom 的記憶體洩漏」：

| 回報 | 被歸類成什麼 | 狀態 |
|---|---|---|
| [isomorphic-dompurify#368](https://github.com/kkomelin/isomorphic-dompurify/issues/368) | 長時間執行的程序記憶體無上限成長 | 已關閉——靠 3.0.0 新增的 opt-in [`clearWindow()`](https://github.com/kkomelin/isomorphic-dompurify/releases/tag/3.0.0) |
| [DOMPurify#1089](https://github.com/cure53/DOMPurify/issues/1089) | DOMPurify + jsdom 的洩漏，懷疑是 `NodeIterator` | 已關閉 |
| [jsdom#3985](https://github.com/jsdom/jsdom/issues/3985)、[jsdom#3936](https://github.com/jsdom/jsdom/issues/3936) | 「performance regression in v27」 | 仍 open |

目前唯一真的有實作的修法，是下游那個 `clearWindow()` workaround：你不主動呼叫，就照漏。

留意版本表的 29.1.1 那一列——**無 id** 的基準大幅改善，有 `id` 的情況幾乎沒動。jsdom
29.0.0 的 release note 裡有這麼一條：

> Improved `Document` initialization performance by lazily initializing the CSS
> selector engine, avoiding ~0.5 ms of overhead per `Document`.

版本對得上基準的改善。我沒有進一步驗證「就是這個改動造成的」，只確認邊界吻合。

---

## Workaround

快取掛在 `Window` 上，所以唯一的出口是讓 `Window` 不要活那麼久：

```js
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'

let purify, window
let count = 0

const renew = () => {
  window?.close()
  window = new JSDOM('').window
  purify = createDOMPurify(window)   // addHook / setConfig 要在這裡重設
  count = 0
}

renew()

export const sanitize = (html) => {
  if (count++ > 500) renew()         // 舊 Window 連同它的 id 快取一起被回收
  return purify.sanitize(html)
}
```

那個門檻要從你的平均文件大小推，不要挑一個整數。以那篇 41 KB 真實文章觀察到的每次解析約
2.7 MB 換算，500 次在重置之前就已經留下超過 1 GB。

鎖 `jsdom@26.1.0` 也可以避開，代價是 27+ 以後的所有東西。

---

## 量測紀律

這裡有兩個地方做錯，會量出看起來很有說服力但完全錯誤的數字。兩條都處理在
[`lib/measure.mjs`](lib/measure.mjs) 裡：

1. **強制 GC，而且必須 `--expose-gc`。** 少了這步，你量到的是「還沒被回收的垃圾」，不是
   「收不回來的東西」。
2. **迴圈裡要讓出 event loop。** jsdom 有部分清理掛在 finalizer 上，完全同步的緊迴圈裡
   finalizer 永遠不會執行。同步的 benchmark 會報出一個在真實 async server 上根本不存在的
   大洩漏。

第三條不是關於 harness，是關於推論：消融實驗顯示「拿掉 X 洩漏就消失」，**並不等於** X 是
原因——被你拿掉的東西身上可能還黏著別的特徵。這裡就發生過：把真實文件裡所有 `<div>` 拿掉，
洩漏消失；但把內容包在 `<div>` 裡，完全不漏。那些 div 剛好是帶著 `id` 的那些元素。只有最小
重現才能驗證因果。

---

## 執行方式

Docker，完整版本矩陣（[`results/`](results/) 就是這樣跑出來的）：

```bash
./run-all.sh                                  # 26.1.0 / 27.0.0 / 28.1.0 / 29.1.1 / 30.0.1
JSDOM_VERSIONS="28.1.0" ./run-all.sh          # 單一版本
SCRIPTS="01-minimal.mjs" ./run-all.sh         # 單一腳本
```

每個案例跑在 4 GB 的容器、2 GB 的 heap 上——留足夠餘裕，讓洩漏呈現成一條斜率，而不是量到
一半就把行程撐爆。原始輸出寫到 `results/raw-<timestamp>.txt`。

不用 Docker 的話（會用 `package.json` 裡鎖的 jsdom 版本）：

```bash
npm install
node --expose-gc 01-minimal.mjs
```

## 檔案

| 檔案 | 用途 |
|---|---|
| `01-minimal.mjs` | 核心證明，約 20 行，不牽涉任何 sanitizer |
| `02-attribute-ablation.mjs` | `id` vs `class` / `data-*` / `name`；元素種類；位置 |
| `03-scaling.mjs` | 文件大小 vs id 數量 |
| `04-heap-snapshot.mjs` | 產生 `out/leak.heapsnapshot` |
| `retainers.py` | 從 snapshot 反向走訪到 GC root |
| `lib/measure.mjs` | 共用量測工具（強制 GC、讓出 event loop、暖機） |
| `Dockerfile`、`run-all.sh` | 版本矩陣 |

所有 fixture 都是合成的。這個 repo 裡沒有任何正式站的內容、設定或識別資訊。

> 程式碼註解維持英文，因為這份重現的預期讀者包含 jsdom 與 DOMPurify 的上游維護者。

## 授權

MIT
