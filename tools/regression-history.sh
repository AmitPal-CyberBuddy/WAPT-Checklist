#!/usr/bin/env bash
# Measures the Node test suite at the baseline commit and at every phase commit
# on the session branch. Proves each phase gate state at its own commit.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRANCH="${1:-arena/01a01429-wapt-checklist}"
BASE="${2:-main}"
OUT="${3:-/tmp/wapt-regression-history.txt}"

cd "$ROOT"
: > "$OUT"

measure() {
  local sha="$1"
  local label="$2"
  local wt="/tmp/wapt-reg-${sha:0:8}"
  git worktree add -q --detach "$wt" "$sha"
  (
    cd "$wt"
    node --test tests/*.test.js > /tmp/wapt-reg-run.txt 2>&1
    exit 0
  )
  result=$(grep -E '^# (tests|pass|fail|skipped)' /tmp/wapt-reg-run.txt | tr '\n' ' ')
  git worktree remove -f "$wt"
  echo "${label} ${sha:0:8} :: ${result}" | tee -a "$OUT"
}

echo "baseline $(git rev-parse "$BASE")"
measure "$(git rev-parse "$BASE")" "baseline"

for sha in $(git rev-list --reverse "$BASE".."$BRANCH"); do
  subject=$(git log -1 --format='%s' "$sha" | cut -c1-58)
  echo "phase $(git log -1 --format='%h' "$sha") ${subject}"
  measure "$sha" "phase"
done

git worktree prune
echo "results written to $OUT"
