#!/usr/bin/env bash
# Build this monitor package, copy the working directory (EXCLUDING node_modules)
# into OpenClaw's extensions dir, install prod deps + rebuild native binding
# locally in the target, register the plugin in ~/.openclaw/openclaw.json,
# then 'openclaw daemon restart' so the embedded LLM-audit plugin and its
# :8764 viewer load fresh dist/.
#
# Why rsync into a real directory instead of symlinking?
#   OpenClaw plugin scan uses fs.readdirSync(extensionsDir, {withFileTypes:true})
#   and skips entries where Dirent.isDirectory() is false. On macOS that
#   filter rejects symlinks-to-directories, so a real directory is required.
#
# Why exclude node_modules and re-install in target?
#   node_modules/<native>/build/{Makefile,config.gypi,*.d} from node-gyp embed
#   the build-host absolute path. We do NOT want to propagate the dev
#   machine's source-tree path into the deployed copy. Letting the target
#   run `npm install` from scratch means its build artefacts only ever
#   contain its OWN install path, never the source project's path.
#
# Environment:
#   SKIP_BUILD=1                 Skip npm install / npm run build here.
#   SKIP_RSYNC=1                 Skip the working-dir → extensions copy.
#   SKIP_INSTALL_DEPS=1          Skip `npm install` in the target dir
#                                (assumes node_modules is already there).
#   SKIP_OPENCLAW_RESTART=1      Skip 'openclaw daemon restart' (sync only).
#   SKIP_CONFIG_PATCH=1          Skip updating openclaw.json.
#   OPENCLAW_EXTENSIONS_DIR      Override default ~/.openclaw/extensions.
#   OPENCLAW_LLM_AUDIT_PORT      Audit viewer port (default 8764).
#   OPENCLAW_WAIT_TIMEOUT        Seconds to wait for /api/health (default 90).

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PLUGIN_ID="agent-openclaw-local-monitor"
EXT_BASE="${OPENCLAW_EXTENSIONS_DIR:-$HOME/.openclaw/extensions}"
EXT_DIR="$EXT_BASE/$PLUGIN_ID"
CONFIG_PATH="$HOME/.openclaw/openclaw.json"
AUDIT_PORT="${OPENCLAW_LLM_AUDIT_PORT:-8764}"
WAIT_TIMEOUT="${OPENCLAW_WAIT_TIMEOUT:-90}"

info() { printf '[openclaw-audit-restart] %s\n' "$*"; }
warn() { printf '[openclaw-audit-restart] WARN: %s\n' "$*" >&2; }
fail() { printf '[openclaw-audit-restart] ERROR: %s\n' "$*" >&2; exit 1; }

command -v node  >/dev/null 2>&1 || fail "node is required"
command -v npm   >/dev/null 2>&1 || fail "npm is required"
command -v rsync >/dev/null 2>&1 || fail "rsync is required"

# 1. build (unless skipped)
if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
  if [[ ! -d node_modules ]]; then
    info "installing npm dependencies"
    npm install
  fi
  info "building agent-openclaw-local-monitor (dist/)"
  npm run build
else
  info "SKIP_BUILD=1 — skipping npm install / build"
fi

# 2. overwrite the deployed extension with current working directory
#    Note: node_modules is intentionally EXCLUDED — the target installs its
#    own copy in step 2b so build artefacts only contain target paths.
if [[ "${SKIP_RSYNC:-0}" != "1" ]]; then
  mkdir -p "$EXT_DIR"
  info "syncing $ROOT_DIR/ → $EXT_DIR/  (excluding node_modules)"
  rsync -a \
    --exclude '.git' \
    --exclude '.gitignore' \
    --exclude 'node_modules' \
    --exclude 'tests' \
    --exclude '*.log' \
    --exclude '.DS_Store' \
    --exclude '*.tsbuildinfo' \
    "$ROOT_DIR/" "$EXT_DIR/"
else
  info "SKIP_RSYNC=1 — skipping working-dir → extensions copy"
fi

# 2b. install prod-only deps inside the target. better-sqlite3 native
#     binding gets rebuilt for the current Node ABI; its build/Makefile,
#     build/config.gypi, build/Release/.deps etc. will be (re)generated
#     with the target's own absolute paths, never the source project's.
if [[ "${SKIP_INSTALL_DEPS:-0}" != "1" ]]; then
  info "installing prod dependencies in $EXT_DIR"
  ( cd "$EXT_DIR" && npm install --omit=dev --no-audit --no-fund --loglevel=error >/dev/null )
  if [[ -d "$EXT_DIR/node_modules/better-sqlite3" ]]; then
    info "rebuilding better-sqlite3 for $(node -v)"
    ( cd "$EXT_DIR" && npm rebuild better-sqlite3 --loglevel=error >/dev/null 2>&1 ) \
      || ( cd "$EXT_DIR" && npm rebuild better-sqlite3 --build-from-source --loglevel=error >/dev/null 2>&1 ) \
      || warn "better-sqlite3 rebuild had issues — check $EXT_DIR/node_modules/better-sqlite3/build/"
    ( cd "$EXT_DIR" && node -e "require('better-sqlite3')" >/dev/null 2>&1 ) \
      && info "better-sqlite3 native module loadable" \
      || warn "better-sqlite3 native module not loadable — 8764 will likely fail"
  fi
else
  info "SKIP_INSTALL_DEPS=1 — skipping npm install in extension dir"
fi

# 3. register the plugin in openclaw.json so it is not flagged as a stale
#    entry (allow + entries.<id>.enabled=true + installs.<id> path source).
if [[ "${SKIP_CONFIG_PATCH:-0}" != "1" && -f "$CONFIG_PATH" ]]; then
  PLUGIN_ID="$PLUGIN_ID" \
  INSTALL_PATH="$EXT_DIR" \
  CONFIG_PATH="$CONFIG_PATH" \
  PROJECT_ROOT="$ROOT_DIR" \
  node - <<'NODE'
const fs = require('fs');
const path = require('path');
const {
  CONFIG_PATH: configPath,
  PLUGIN_ID: pluginId,
  INSTALL_PATH: installPath,
  PROJECT_ROOT: projectRoot,
} = process.env;

const raw = fs.readFileSync(configPath, 'utf8');
const config = JSON.parse(raw);

config.plugins ??= {};
if (config.plugins.enabled !== false) config.plugins.enabled = true;

config.plugins.allow = Array.isArray(config.plugins.allow) ? config.plugins.allow : [];
if (!config.plugins.allow.includes(pluginId)) config.plugins.allow.push(pluginId);

config.plugins.entries ??= {};
if (typeof config.plugins.entries[pluginId] !== 'object' || !config.plugins.entries[pluginId]) {
  config.plugins.entries[pluginId] = {};
}
config.plugins.entries[pluginId].enabled = true;

let version = '0.0.0';
try {
  version = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version || version;
} catch {}

config.plugins.installs ??= {};
config.plugins.installs[pluginId] = {
  source: 'path',
  installPath,
  version,
  resolvedVersion: version,
  installedAt: new Date().toISOString(),
};

fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
console.log('[openclaw-audit-restart] openclaw.json registered ' + pluginId);
NODE
else
  [[ -f "$CONFIG_PATH" ]] || warn "openclaw.json not found at $CONFIG_PATH — skipping patch"
fi

# 4. restart OpenClaw daemon
if [[ "${SKIP_OPENCLAW_RESTART:-0}" == "1" ]]; then
  info "SKIP_OPENCLAW_RESTART=1 — skipping daemon restart"
  info "💡 run 'openclaw daemon restart' manually to load fresh dist/"
  exit 0
fi
if ! command -v openclaw >/dev/null 2>&1; then
  warn "'openclaw' not on PATH — skipping restart."
  warn "💡 run 'openclaw daemon restart' manually so the plugin loads."
  exit 0
fi

info "restarting OpenClaw daemon (openclaw daemon restart)"
openclaw daemon restart || warn "openclaw daemon restart returned non-zero"

# 5. wait for the audit viewer to come up
info "waiting up to ${WAIT_TIMEOUT}s for http://127.0.0.1:${AUDIT_PORT}/api/health"
deadline=$((SECONDS + WAIT_TIMEOUT))
while (( SECONDS < deadline )); do
  if curl -fsS --max-time 1 "http://127.0.0.1:${AUDIT_PORT}/api/health" >/dev/null 2>&1; then
    info "✅ audit viewer ready: http://127.0.0.1:${AUDIT_PORT}/"
    exit 0
  fi
  sleep 2
done

warn "timed out — audit endpoint not reachable at http://127.0.0.1:${AUDIT_PORT}/api/health"
warn "Hints:"
warn "  - confirm plugin agent-openclaw-local-monitor is enabled in $CONFIG_PATH"
warn "  - OPENCLAW_LLM_AUDIT must not be 0"
warn "  - check ~/.openclaw/logs/gateway.err.log"
exit 1
