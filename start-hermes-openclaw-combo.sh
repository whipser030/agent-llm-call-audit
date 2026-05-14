#!/usr/bin/env bash
# One-shot: build this package, rsync the working directory into OpenClaw's
# extensions folder (overwrite mode), restart OpenClaw so the :8764 audit
# viewer comes up, then start the Hermes JSONL monitor on :8765 in the
# foreground. Before handing control to the Hermes monitor it prints a
# clear reminder of how to re-restart OpenClaw later when you edit src/.
#
# Environment (build / OpenClaw side — passed through to
# start-openclaw-audit-with-restart.sh):
#   SKIP_BUILD=1                   Skip npm install / npm run build.
#   SKIP_OPENCLAW_RESTART=1        Skip 'openclaw daemon restart'.
#   SKIP_RSYNC=1                   Skip rsync into extensions dir.
#   SKIP_CONFIG_PATCH=1            Skip editing openclaw.json.
#   OPENCLAW_LLM_AUDIT_PORT        Audit viewer port (default 8764).
#   OPENCLAW_WAIT_TIMEOUT          Seconds to wait for /api/health (default 90).
#   OPENCLAW_EXTENSIONS_DIR        Override default ~/.openclaw/extensions.
#
# Environment (Hermes side):
#   HERMES_CONFIG                  Path to ~/.hermes/config.yaml.
#   HERMES_LLM_AUDIT_SOURCE_DIR    Hermes JSONL source dir.
#   HERMES_LLM_AUDIT_MONITOR_PORT  Hermes viewer port (default 8765).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

HERMES_CONFIG="${HERMES_CONFIG:-$HOME/.hermes/config.yaml}"
HERMES_AUDIT_DIR="${HERMES_LLM_AUDIT_SOURCE_DIR:-$HOME/.hermes/llm-audit}"
export HERMES_LLM_AUDIT_MONITOR_PORT="${HERMES_LLM_AUDIT_MONITOR_PORT:-${HERMES_MONITOR_PORT:-8765}}"
HERMES_MONITOR_PORT="$HERMES_LLM_AUDIT_MONITOR_PORT"
AUDIT_PORT="${OPENCLAW_LLM_AUDIT_PORT:-8764}"

info() { printf '[hermes+openclaw] %s\n' "$*"; }
fail() { printf '[hermes+openclaw] ERROR: %s\n' "$*" >&2; exit 1; }

command -v node  >/dev/null 2>&1 || fail "node is required"
command -v npm   >/dev/null 2>&1 || fail "npm is required"
command -v rsync >/dev/null 2>&1 || fail "rsync is required"

# 1. fail fast if the Hermes viewer port is already taken
if command -v lsof >/dev/null 2>&1 \
   && lsof -nP -iTCP:"$HERMES_MONITOR_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  fail "port $HERMES_MONITOR_PORT is already in use; stop the existing Hermes monitor first"
fi

# 2. make sure Hermes' native JSONL audit writer is on
info "ensuring Hermes native audit is enabled in $HERMES_CONFIG"
python3 - "$HERMES_CONFIG" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1]).expanduser()
path.parent.mkdir(parents=True, exist_ok=True)
text = path.read_text(encoding="utf-8") if path.exists() else ""
lines = text.splitlines()

section = ["llm_audit:", "  enabled: true", "  dir: ~/.hermes/llm-audit"]
start = next((i for i, line in enumerate(lines) if line.strip() == "llm_audit:" and not line.startswith((" ", "\t"))), None)

if start is None:
    insert_at = next((i for i, line in enumerate(lines) if line.startswith("_config_version:")), len(lines))
    if insert_at > 0 and lines[insert_at - 1].strip():
        lines.insert(insert_at, "")
        insert_at += 1
    lines[insert_at:insert_at] = section
else:
    end = start + 1
    while end < len(lines):
        line = lines[end]
        if line.strip() and not line.startswith((" ", "\t")):
            break
        end += 1
    lines[start:end] = section

path.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
PY

mkdir -p "$HERMES_AUDIT_DIR"

# 3. build once here; the OpenClaw helper gets SKIP_BUILD=1 to avoid rebuilding
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  if [[ ! -d node_modules ]]; then
    info "installing npm dependencies"
    npm install
  fi
  info "building TypeScript package"
  npm run build
else
  info "SKIP_BUILD=1 — skipping npm install / build"
fi

# 4. delegate: rsync working dir → ~/.openclaw/extensions/<id>/,
#    patch openclaw.json, restart OpenClaw daemon, wait for :8764.
info "deploying source → OpenClaw extensions dir + restarting OpenClaw (for :${AUDIT_PORT})"
audit_status=0
SKIP_BUILD=1 bash "$ROOT_DIR/start-openclaw-audit-with-restart.sh" || audit_status=$?

if (( audit_status != 0 )); then
  info "⚠ OpenClaw audit step did not complete cleanly (exit ${audit_status})."
  info "   :${AUDIT_PORT} may be unavailable. Continuing with Hermes monitor anyway."
fi

# 5. final summary + manual-restart reminder BEFORE we exec into Hermes
info ""
info "═══════════════════════════════════════════════════════════════"
info "  Two services:"
info "    Hermes viewer:   http://127.0.0.1:${HERMES_MONITOR_PORT}/   (starting next, foreground)"
info "    OpenClaw audit:  http://127.0.0.1:${AUDIT_PORT}/   (in OpenClaw process)"
info "═══════════════════════════════════════════════════════════════"
info "💡 Reminder: edits to src/ won't reach :${AUDIT_PORT} automatically."
info "   Re-run this script, or run start-openclaw-audit-with-restart.sh,"
info "   or do it by hand: rsync ./ ~/.openclaw/extensions/agent-openclaw-local-monitor/"
info "                     && openclaw daemon restart"
info ""
info "press Ctrl+C to stop the Hermes monitor"
info ""

exec npm run monitor:hermes
