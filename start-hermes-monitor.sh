#!/usr/bin/env bash
# Hermes LLM audit monitor (build + Hermes viewer on :8765).
#
# Environment:
#   SKIP_BUILD=1   Skip npm install (when node_modules missing) and
#                  npm run build. Use when dist/ is already built.
#
# This script intentionally does NOT touch OpenClaw. If you also need the
# OpenClaw-side audit viewer (:8764), run start-openclaw-audit-with-restart.sh
# (it rsyncs the working dir into ~/.openclaw/extensions, patches
# openclaw.json and restarts OpenClaw), or use start-hermes-openclaw-combo.sh
# to do both in one shot.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

HERMES_CONFIG="${HERMES_CONFIG:-$HOME/.hermes/config.yaml}"
HERMES_AUDIT_DIR="${HERMES_LLM_AUDIT_SOURCE_DIR:-$HOME/.hermes/llm-audit}"
# Port must be exported: Node reads HERMES_LLM_AUDIT_MONITOR_PORT (not HERMES_MONITOR_PORT).
export HERMES_LLM_AUDIT_MONITOR_PORT="${HERMES_LLM_AUDIT_MONITOR_PORT:-${HERMES_MONITOR_PORT:-8765}}"
HERMES_MONITOR_PORT="$HERMES_LLM_AUDIT_MONITOR_PORT"

info() {
  printf '[agent-llm-monitor] %s\n' "$*"
}

fail() {
  printf '[agent-llm-monitor] ERROR: %s\n' "$*" >&2
  exit 1
}

command -v node >/dev/null 2>&1 || fail "node is required"
command -v npm >/dev/null 2>&1 || fail "npm is required"

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"$HERMES_MONITOR_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    fail "port $HERMES_MONITOR_PORT is already in use; stop the existing listener first"
  fi
fi

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

if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  if [[ ! -d node_modules ]]; then
    info "installing npm dependencies"
    npm install
  fi
  info "building TypeScript package"
  npm run build
else
  info "SKIP_BUILD=1 — skipping npm install / npm run build"
fi

info "💡 This script does NOT touch OpenClaw."
info "   If you want the OpenClaw audit viewer too (http://127.0.0.1:8764/),"
info "   run start-openclaw-audit-with-restart.sh, or use start-hermes-openclaw-combo.sh"
info "   which does both in one shot."

info "starting Hermes LLM audit monitor (JSONL tail + SQLite + web UI only)"
info "Hermes viewer: http://127.0.0.1:${HERMES_MONITOR_PORT}/"
info "source JSONL: ${HERMES_AUDIT_DIR}"
info ""
info "Hermes and OpenClaw LLM audit use different ports and databases by design."
info ""
info "press Ctrl+C to stop"

exec npm run monitor:hermes
