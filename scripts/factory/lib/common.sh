#!/usr/bin/env bash
# Shared helpers for the factory scripts. Source it; don't run it.
# shellcheck disable=SC2034  # FACTORY_ROOT and TEMPLATE_DIR are used by the scripts that source this file.

FACTORY_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_DIR="$FACTORY_ROOT/templates/nextjs-supabase"
FAILURES=0

info() { printf '%s\n' "$*"; }
warn() { printf 'WARN  %s\n' "$*" >&2; }
die() {
  printf 'ERROR %s\n' "$*" >&2
  exit 1
}
pass() { printf 'PASS  %s\n' "$*"; }
fail() {
  printf 'FAIL  %s\n' "$*"
  FAILURES=$((FAILURES + 1))
}
skip() { printf 'SKIP  %s\n' "$*"; }

need() {
  local cmd
  for cmd in "$@"; do
    command -v "$cmd" >/dev/null 2>&1 || die "'$cmd' is required but not installed."
  done
}

# Prints the comment header of a script (lines 2.. until the first non-comment line) as its help.
usage_from_header() {
  awk 'NR == 1 { next } /^#/ { sub(/^# ?/, ""); print; next } { exit }' "$1"
}
