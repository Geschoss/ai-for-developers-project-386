#!/usr/bin/env bash
# Staged files only. Checks, never autofixes: oxlint without --fix, oxfmt --check.
set -euo pipefail

if [[ -z "${STAGED:-}" ]]; then
  exit 0
fi

lint_files=()
fmt_files=()

for file in ${STAGED}; do
  if [[ ! -f "${file}" ]]; then
    continue
  fi
  case "${file}" in
    spec/openapi.yaml | spec/api.d.ts | pnpm-lock.yaml | .github/workflows/hexlet-check.yml)
      continue
      ;;
    backend/drizzle/* | backend/drizzle/*/* | .agents/* | .claude/* | dist/* | */dist/*)
      continue
      ;;
  esac
  case "${file}" in
    *.ts | *.tsx | *.mts | *.cts | *.js | *.jsx | *.mjs | *.cjs)
      lint_files+=("${file}")
      fmt_files+=("${file}")
      ;;
    *.json | *.jsonc | *.yaml | *.yml | *.md)
      fmt_files+=("${file}")
      ;;
  esac
done

if ((${#lint_files[@]} > 0)); then
  pnpm exec oxlint --deny-warnings "${lint_files[@]}"
fi

if ((${#fmt_files[@]} > 0)); then
  pnpm exec oxfmt --check "${fmt_files[@]}"
fi
