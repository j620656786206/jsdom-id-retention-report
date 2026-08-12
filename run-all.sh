#!/usr/bin/env bash
# Full reproduction across jsdom versions.
#
#   ./run-all.sh                       # default matrix, output also written to results/
#   JSDOM_VERSIONS="28.1.0" ./run-all.sh
#   SCRIPTS="01-minimal.mjs" ./run-all.sh
set -euo pipefail

VERSIONS="${JSDOM_VERSIONS:-26.1.0 27.0.0 28.1.0 29.1.1 30.0.1}"
SCRIPTS="${SCRIPTS:-01-minimal.mjs 02-attribute-ablation.mjs 03-scaling.mjs}"
OUT_DIR="${OUT_DIR:-results}"

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/raw-$(date -u +%Y%m%dT%H%M%SZ).txt"

{
  echo "host node:   $(node --version 2>/dev/null || echo 'n/a')"
  echo "docker:      $(docker --version)"
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

  docker build -q --build-arg "JSDOM_VERSION=$v" -t "jsdom-leak:$v" . >/dev/null

  for s in $SCRIPTS; do
    echo "--- $s" | tee -a "$LOG"
    # 4g container / 2g heap: enough headroom that the leak shows as a slope
    # rather than crashing the process mid-measurement.
    docker run --rm --memory=4g \
      -e NODE_OPTIONS="--max-old-space-size=2048" \
      "jsdom-leak:$v" "$s" | tee -a "$LOG"
    echo | tee -a "$LOG"
  done
done

echo "raw output: $LOG"
