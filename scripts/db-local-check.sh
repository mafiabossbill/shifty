#!/usr/bin/env bash
# Applies every migration and runs the RLS check against a throwaway local Postgres
# (with supabase/local/supabase-stub.sql standing in for Supabase's auth schema and roles).
# Catches SQL errors and policy mistakes before anything touches a real project.
# Needs Postgres server binaries (initdb, pg_ctl, psql); cloud sessions have PostgreSQL 16.
#
#   bash scripts/db-local-check.sh            # or: npm run db:local-check
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  sed -n '2,8p' "$0"
  exit 0
fi

bin="${PG_BIN:-}"
if [[ -z "$bin" ]]; then
  if command -v initdb >/dev/null 2>&1; then bin="$(dirname "$(command -v initdb)")"
  else bin="$(find /usr/lib/postgresql -maxdepth 3 -name initdb -printf '%h\n' 2>/dev/null | sort -V | tail -1)"; fi
fi
if [[ -z "$bin" || ! -x "$bin/initdb" ]]; then
  echo "SKIP: Postgres server binaries not found (set PG_BIN). Run 'npm run db:check-rls' against a real project instead." >&2
  exit 0
fi

work="$(mktemp -d)"
port="${PG_PORT:-55432}"
cleanup() { "$bin/pg_ctl" -D "$work/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$work"; }
trap cleanup EXIT

run_pg() { if [[ "$(id -u)" == "0" ]]; then su postgres -s /bin/bash -c "$*"; else bash -c "$*"; fi; }
if [[ "$(id -u)" == "0" ]]; then chown postgres "$work"; fi
run_pg "'$bin/initdb' -D '$work/data' -U postgres --auth=trust >'$work/initdb.log' 2>&1"
run_pg "'$bin/pg_ctl' -D '$work/data' -o '-p $port -k $work -c listen_addresses=' -l '$work/pg.log' -w start >/dev/null"

export LOCAL_DATABASE_URL="postgresql://postgres@/postgres?host=$work&port=$port"
psql "$LOCAL_DATABASE_URL" -X -q -v ON_ERROR_STOP=1 -f supabase/local/supabase-stub.sql >/dev/null
node --import tsx scripts/migrate.ts
node --import tsx scripts/check-rls.ts
echo "Local migration + RLS check passed (Supabase stub; run npm run db:check-rls against the real project too)."
