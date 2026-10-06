#!/usr/bin/env bash
# Prints "code=true" or "code=false" for the GitHub checks (wave 2, item 1).
# code=false only when every changed file is documentation: docs/ (except docs/requirements.csv, which the
# register check reads), any *.md file, AGENTS.md or CLAUDE.md. Anything else, or an unknown base, means code=true,
# so the full checks run. Usage: scripts/ci-changes.sh <base-commit> [head-commit]
set -uo pipefail
base=${1:-}; head=${2:-HEAD}
if [ -z "$base" ] || [ "$base" = "0000000000000000000000000000000000000000" ] || ! git cat-file -e "$base^{commit}" 2>/dev/null; then
  echo "code=true"; exit 0
fi
files=$(git diff --name-only "$base" "$head")
if [ -z "$files" ]; then echo "code=true"; exit 0; fi
while IFS= read -r f; do
  case "$f" in
    docs/requirements.csv) echo "code=true"; exit 0 ;;
    docs/*|*.md) ;;
    *) echo "code=true"; exit 0 ;;
  esac
done <<<"$files"
echo "code=false"
