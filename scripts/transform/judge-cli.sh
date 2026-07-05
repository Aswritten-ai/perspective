#!/usr/bin/env bash
# Judge pending entities on a Claude subscription via the Claude Code CLI.
# Auth: CLAUDE_CODE_OAUTH_TOKEN (generate locally with `claude setup-token`,
# store as a repo Actions secret). Same export/merge machinery as the API
# judge (judge.mjs); withhold-by-default makes any failure safe.
#
#   bash scripts/public-transform/judge-cli.sh [workdir]
set -euo pipefail
DIR=${1:-/tmp/pending-entities}

node scripts/public-transform/export-pending.mjs --out "$DIR" --chunks 8

shopt -s nullglob
for chunk in "$DIR"/chunk-*.json; do
  n=$(basename "$chunk" .json); n=${n#chunk-}
  out="$DIR/verdicts-$n.jsonl"
  [ -s "$out" ] && continue
  {
    cat scripts/public-transform/judge-rules.md
    echo
    echo 'Classify every entity below. Output ONLY JSONL, one line per entity:'
    echo '{"iri":"narr:...","verdict":"public","reason":"<short>"}  (verdict: "public" or "private")'
    echo 'No prose, no code fences, no preamble. Every input entity must get exactly one line.'
    echo
    cat "$chunk"
  } | claude -p --output-format text --model sonnet > "$out" || { rm -f "$out"; echo "chunk $n failed" >&2; }
done

node scripts/public-transform/merge-verdicts.mjs --dir "$DIR" --by "claude-max-ci"
