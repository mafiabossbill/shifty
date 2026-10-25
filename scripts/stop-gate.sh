#!/usr/bin/env bash
# Claude Code Stop / SubagentStop hook (wired in .claude/settings.json).
# Blocks "done" while lint, typecheck or unit tests fail. Skips the run when nothing
# changed since the last green gate, so finishing a turn without code changes stays fast.
#
# Hook contract (verified against Claude Code 2.1.308 hooks reference):
#   stdin  JSON with stop_hook_active, cwd, ...
#   exit 0 allow stop; exit 2 block stop, stderr is fed back to Claude as the reason.
# Set FACTORY_GATE=off to disable for one session; FACTORY_GATE_BUILD=1 to include `next build`.
set -euo pipefail

if [[ "${1:-}" == "--help" ]]; then
  sed -n '2,10p' "$0"
  exit 0
fi

[[ "${FACTORY_GATE:-on}" == "off" ]] && exit 0

input="$(cat || true)"
project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
cd "$project_dir"
[[ -f package.json && -d node_modules ]] || exit 0

# Fingerprint: HEAD plus the content of every modified, deleted or untracked file.
# Unchanged since the last green run → nothing to check. Outside git, always check.
stamp=".factory-gate-ok"
fingerprint=""
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  fingerprint="$( {
    git rev-parse HEAD 2>/dev/null || true
    git ls-files -m -d -o --exclude-standard -- . | grep -v -x -F "$stamp" | sort -u | while IFS= read -r f; do
      if [[ -f "$f" ]]; then sha256sum -- "$f"; else echo "deleted $f"; fi
    done
  } | sha256sum | cut -c1-16)"
  if [[ -f "$stamp" && "$(cat "$stamp")" == "$fingerprint" ]]; then
    exit 0
  fi
fi

# Parallel subagents may finish together: one gate run at a time (flock where available), then
# re-check the stamp, since the run we waited for may already have covered this tree.
if command -v flock >/dev/null 2>&1; then
  exec 9>".factory-gate.lock"
  flock 9
  if [[ -n "$fingerprint" && -f "$stamp" && "$(cat "$stamp")" == "$fingerprint" ]]; then exit 0; fi
fi

log="$(mktemp)"
trap 'rm -f "$log"' EXIT
steps=(lint typecheck test)
[[ "${FACTORY_GATE_BUILD:-0}" == "1" ]] && steps+=(build)
for step in "${steps[@]}"; do
  if ! npm run --silent "$step" >"$log" 2>&1; then
    {
      echo "Quality gate failed at 'npm run $step'. Fix it before finishing (Definition of Done)."
      echo "Last lines:"
      tail -n 40 "$log"
    } >&2
    # Loop guard: stop_hook_active means this block already sent Claude back once.
    # Keep blocking (Claude Code caps consecutive continuations), but say so.
    if grep -q '"stop_hook_active":[[:space:]]*true' <<<"$input"; then
      echo "(Still failing after a previous block. If it can't be fixed now, say exactly what fails and why in the handoff.)" >&2
    fi
    exit 2
  fi
done
[[ -n "$fingerprint" ]] && echo "$fingerprint" >"$stamp"
exit 0
