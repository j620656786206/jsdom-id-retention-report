#!/usr/bin/env python3
"""Walk the retainer chain of a given constructor's instances back to a GC root.

  python3 retainers.py <snapshot.heapsnapshot> <ConstructorName> [samples]

Example:
  python3 retainers.py out/leak.heapsnapshot HTMLDivElementImpl
"""

import json
import sys
from collections import deque

path, target_name = sys.argv[1], sys.argv[2]
samples = int(sys.argv[3]) if len(sys.argv) > 3 else 3

print(f"loading {path} ...", file=sys.stderr)
snap = json.load(open(path))
meta = snap["snapshot"]["meta"]
nf, ef = meta["node_fields"], meta["edge_fields"]
node_types = meta["node_types"][nf.index("type")]
edge_types = meta["edge_types"][ef.index("type")]
nodes, edges, strings = snap["nodes"], snap["edges"], snap["strings"]
NS, ES = len(nf), len(ef)
iN_type, iN_name, iN_id, iN_size, iN_edges = (
    nf.index("type"), nf.index("name"), nf.index("id"),
    nf.index("self_size"), nf.index("edge_count"),
)
iE_type, iE_name, iE_to = ef.index("type"), ef.index("name_or_index"), ef.index("to_node")

n_nodes = len(nodes) // NS
print(f"nodes={n_nodes:,} edges={len(edges)//ES:,}", file=sys.stderr)

# forward edge offsets (a node's edges are contiguous) + reverse index
first_edge = [0] * (n_nodes + 1)
acc = 0
for k in range(n_nodes):
    first_edge[k] = acc
    acc += nodes[k * NS + iN_edges] * ES
first_edge[n_nodes] = acc

print("building reverse index ...", file=sys.stderr)
rev = [[] for _ in range(n_nodes)]  # to_idx -> [(from_idx, edge_off)]
for k in range(n_nodes):
    for off in range(first_edge[k], first_edge[k + 1], ES):
        rev[edges[off + iE_to] // NS].append((k, off))

def node_label(k):
    t = node_types[nodes[k * NS + iN_type]]
    name = strings[nodes[k * NS + iN_name]] if t not in ("code",) else "(code)"
    return f"{name[:60]} [{t}] sz={nodes[k*NS+iN_size]}"

def edge_label(off):
    t = edge_types[edges[off + iE_type]]
    ni = edges[off + iE_name]
    name = ni if t in ("element", "hidden") else strings[ni]
    return f"--{t}:{name}-->"

# pick the largest instances by self_size
targets = sorted(
    (k for k in range(n_nodes)
     if node_types[nodes[k * NS + iN_type]] == "object"
     and strings[nodes[k * NS + iN_name]] == target_name),
    key=lambda k: -nodes[k * NS + iN_size],
)[:samples]
print(f"found {target_name} instances (showing {len(targets)})", file=sys.stderr)

# BFS backwards to a GC root; print the shortest chain
for t in targets:
    print(f"\n═══ retainer chain of {node_label(t)} ═══")
    prev = {t: None}
    q = deque([t])
    root = None
    while q:
        cur = q.popleft()
        if cur == 0:  # node 0 is the snapshot root
            root = cur
            break
        for frm, off in rev[cur]:
            if frm not in prev:
                # weak edges are not retainers
                if edge_types[edges[off + iE_type]] == "weak":
                    continue
                prev[frm] = (cur, off)
                q.append(frm)
    if root is None:
        print("  (held only by weak references -> collectable, not a leak path)")
        continue
    # print the chain root -> target
    chain = []
    cur = root
    while cur is not None and prev[cur] is not None:
        nxt, off = prev[cur]
        chain.append((cur, off))
        cur = nxt
    for k, off in chain:
        print(f"  {node_label(k)}")
        print(f"    {edge_label(off)}")
    print(f"  {node_label(t)}")
