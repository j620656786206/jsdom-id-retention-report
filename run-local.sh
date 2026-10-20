#!/usr/bin/env bash
# The same version matrix as run-all.sh, without Docker.
#
# Installs each jsdom version into ./node_modules in turn, runs the scripts
# against it, then restores whatever package.json pins. Use this if you do not
# have Docker; use run-all.sh if you do.
#
#   ./run-local.sh
#   JSDOM_VERSIONS="27.0.0 30.0.1" ./run-local.sh
#   SCRIPTS="01-minimal.mjs" ./run-local.sh
#
# Caveat: this runs on your host Node with no container memory cap, so the
# absolute numbers will not match results/ exactly. The shape is what matters —
# the id column should tower over the no-id column from 27.0.0 onward.
set -euo pipefail

VERSIONS="${JSDOM_VERSIONS:-26.1.0 27.0.0 28.1.0 29.1.1 30.0.1 30.1.3}"
SCRIPTS="${SCRIPTS:-01-minimal.mjs 02-attribute-ablation.mjs 03-scaling.mjs}"
OUT_DIR="${OUT_DIR:-results}"

# Strip any range prefix — package.json pins exactly, and so should the restore.
PINNED=$(node -p "require('./package.json').dependencies.jsdom.replace(/^[^0-9]*/, '')")
mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/raw-local-$(date -u +%Y%m%dT%H%M%SZ).txt"

# Always put node_modules back the way we found it, even on Ctrl-C.
restore() {
  echo "restoring jsdom@$PINNED …"
  npm install --no-save --no-audit --no-fund --silent "jsdom@$PINNED" >/dev/null 2>&1 || true
}
trap restore EXIT

{
  echo "host node:   $(node --version)"
  echo "docker:      not used (run-local.sh)"
  echo "started:     $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "versions:    $VERSIONS"
  echo "scripts:     $SCRIPTS"
  echo
} | tee "$LOG"

for v in $VERSIONS; do
  {
    echo "=============================================================="
    echo " jsdom $v"
    echo "=============================================================="
  } | tee -a "$LOG"

  # --no-save: swap the installed version without ever rewriting package.json
  # (a plain install turns the exact pin into a caret range).
  npm install --no-save --no-audit --no-fund --silent "jsdom@$v" >/dev/null

  for s in $SCRIPTS; do
    echo "--- $s" | tee -a "$LOG"
    # The version each script prints is read from the installed package at
    # runtime, so the log labels itself — it cannot drift from what actually ran.
    node --expose-gc --max-old-space-size=2048 "$s" | tee -a "$LOG"
    echo | tee -a "$LOG"
  done
done

echo "raw output: $LOG"
