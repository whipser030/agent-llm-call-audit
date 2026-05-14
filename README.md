# Agent LLM Call Local Monitor

Independent OpenClaw plugin/service for capturing every `llm_input` and `llm_output`
hook into a local SQLite database and viewing the calls at `http://127.0.0.1:8764/`.

The package also includes an independent Hermes monitor. It tails Hermes'
native `~/.hermes/llm-audit/llm_calls_*.jsonl` files, automatically imports records with a Hermes runtime `task_id` into a local
SQLite database, and serves a separate viewer at `http://127.0.0.1:8765/`.

## Requirements

- **Node.js** `>= 22.12.0` (see `package.json` → `engines`). Hermes and OpenClaw gateways should use a compatible Node major where possible.
- **npm** (for `npm run build`, `npm install`, and the shell helpers).
- **OpenClaw deploy script path:** **Python 3** (`python3` on `PATH`) for editing Hermes `llm_audit` in YAML; **rsync**; **curl** (health check after `openclaw daemon restart`). **`openclaw`** CLI on `PATH` for restart (otherwise the script skips restart and prints a manual hint).
- **Hermes path:** Hermes installed and `~/.hermes/config.yaml` writable if you use the Hermes helpers or monitor.
- **OpenClaw path:** `~/.openclaw/openclaw.json` should exist after a normal OpenClaw setup; if it is missing, the deploy script logs a warning and skips the JSON patch until you bootstrap OpenClaw once.

## Git clone vs npm package (important)

| You have | OpenClaw plugin + deploy helpers | Hermes monitor |
|----------|-----------------------------------|----------------|
| **Git clone** of this repo | Use `./start-openclaw-audit-with-restart.sh` and `./start-hermes-openclaw-combo.sh` (scripts live in the repo root). | Use `./start-hermes-monitor.sh` or `npm run monitor:hermes` after `npm run build`. |
| **`npm install` / registry tarball** | The published package **only** ships `dist/`, `package.json`, and `README.md` (`package.json` → `files`). **The `start-*.sh` scripts are not in the tarball.** Deploy by copying/syncing the package directory into `~/.openclaw/extensions/agent-openclaw-local-monitor/` yourself, or clone this repo for the scripts. | After install: `npm run build` in the package if you build from source, then `npx agent-hermes-llm-monitor` (see `package.json` → `bin`) or `node dist/src/hermes.js`. |

## Shell helpers (git clone only)

| Script | What it does |
|--------|----------------|
| `start-hermes-monitor.sh` | Patches Hermes `llm_audit` in `HERMES_CONFIG` (default `~/.hermes/config.yaml`), optional **build** in this repo, then **runs** the Hermes monitor (`HERMES_LLM_AUDIT_MONITOR_PORT`, default **8765**) in the foreground. Does **not** touch OpenClaw. |
| `start-openclaw-audit-with-restart.sh` | Optional **build** in this repo, **rsync** into `~/.openclaw/extensions/agent-openclaw-local-monitor/` (excluding `node_modules`; see below), **`npm install --omit=dev`** inside that extension directory (rebuilds native deps such as `better-sqlite3` there), patches **`~/.openclaw/openclaw.json`** (allow / entries / installs), runs **`openclaw daemon restart`**, waits for **`http://127.0.0.1:${OPENCLAW_LLM_AUDIT_PORT:-8764}/api/health`**, then **exits**. The **8764** viewer runs **inside** OpenClaw, not as a separate long-lived process started by this script. |
| `start-hermes-openclaw-combo.sh` | Same Hermes YAML prep as above, then **one** `npm run build` in this repo (unless `SKIP_BUILD=1`), then invokes `start-openclaw-audit-with-restart.sh` with **`SKIP_BUILD=1`** so the OpenClaw path does not build twice, then **`exec npm run monitor:hermes`**. If the OpenClaw step fails, it **still** starts the Hermes monitor and logs a warning. |

Run from the repo root, e.g. `bash start-hermes-monitor.sh` or `chmod +x start-hermes-monitor.sh && ./start-hermes-monitor.sh`.

### `SKIP_BUILD=1` (nuance)

- **`start-hermes-monitor.sh`** / **`start-hermes-openclaw-combo.sh`**: skips `npm install` (even when `node_modules` is missing) **and** `npm run build` in the **repository**. You must already have `node_modules` and a built **`dist/`** or `npm run monitor:hermes` will fail.
- **`start-openclaw-audit-with-restart.sh`**: skips only the **repository** `npm install` / `npm run build`. It still runs **rsync** (unless `SKIP_RSYNC=1`) and **`npm install` inside the extension directory** (unless `SKIP_INSTALL_DEPS=1`).

### `start-openclaw-audit-with-restart.sh` environment variables

- `SKIP_BUILD=1` — Skip `npm install` / `npm run build` in the **repository** checkout.
- `SKIP_RSYNC=1` — Skip copying the working tree into the extensions directory.
- `SKIP_INSTALL_DEPS=1` — Skip `npm install` (and `better-sqlite3` rebuild) **inside** `~/.openclaw/extensions/agent-openclaw-local-monitor/`.
- `SKIP_OPENCLAW_RESTART=1` — Skip `openclaw daemon restart` and the health wait (sync / config only); exits after the manual-restart hint.
- `SKIP_CONFIG_PATCH=1` — Skip updating `~/.openclaw/openclaw.json`.
- `OPENCLAW_EXTENSIONS_DIR` — Extensions **base** directory (default `~/.openclaw/extensions`; plugin dir is `$OPENCLAW_EXTENSIONS_DIR/agent-openclaw-local-monitor`).
- `OPENCLAW_LLM_AUDIT_PORT` — Audit viewer port for the **health check URL** (default `8764`; must match the plugin’s bind port / env).
- `OPENCLAW_WAIT_TIMEOUT` — Seconds to wait for `/api/health` (default `90`).

**Why rsync excludes `node_modules`:** the extension directory runs its own `npm install` so node-gyp artefacts (e.g. under `better-sqlite3/build/`) record paths on the **machine that runs OpenClaw**, not your development tree.

**Symlink note:** OpenClaw’s extension scan uses `fs.readdirSync` with `withFileTypes: true` and only treats **`Dirent.isDirectory() === true`** as an installable folder. On typical Node/macOS setups, a **symlink to a directory** reports `isSymbolicLink()` and not `isDirectory()`, so the entry is skipped. Use a **real directory** (this script’s rsync target), not a symlink.

## OpenClaw Runtime

- Plugin id: `agent-openclaw-local-monitor`
- Viewer: `http://127.0.0.1:8764/` (unless overridden by env / plugin config)
- Database: `~/.openclaw/llm-audit/audit.db` (or `OPENCLAW_LLM_AUDIT_HOME`; see `src/paths.ts`)
- Task ID: OpenClaw `runId` (stored as `task_id` in SQLite). The web UI may show a gray **`subagent`** label when `task_id` or `session_key` indicates a subagent context (`:subagent:` in the string).

The service starts when OpenClaw loads plugin services. It does not depend on a separate “memory” plugin.

### Deploy plugin + restart OpenClaw (git clone)

From a clone of this repository:

```bash
./start-openclaw-audit-with-restart.sh
```

That runs `openclaw daemon restart` and waits for `/api/health` unless you set `SKIP_OPENCLAW_RESTART=1` or `openclaw` is missing from `PATH`.

### OpenClaw plugin metadata

- **`openclaw.plugin.json`** in the repo root is the manifest OpenClaw reads from the extension directory.
- **`package.json` → `openclaw.extensions`** lists `./dist/src/index.js` for tooling that reads npm metadata.

Host compatibility is declared under `package.json` → `openclaw.compat.pluginApi` (e.g. `>=2026.4.15-beta.1`). Use an OpenClaw build that satisfies that range.

## Config (OpenClaw plugin / env)

Environment variables:

- `OPENCLAW_LLM_AUDIT=0` disables capture and viewer startup.
- `OPENCLAW_LLM_AUDIT_HOST` overrides the bind host.
- `OPENCLAW_LLM_AUDIT_PORT` overrides the viewer port.
- `OPENCLAW_LLM_AUDIT_HOME` overrides the audit home directory (parent of `audit.db`).

Equivalent plugin config keys are `enabled`, `host`, `port`, and `auditHome` (see `openclaw.plugin.json` → `configSchema`).

## Hermes Runtime

Hermes capture is separate from the OpenClaw plugin. Enable Hermes’ native audit writer, build this package, then run the Hermes monitor:

```bash
npm install
npm run build
npm run monitor:hermes
```

From a **git clone**, you can instead:

```bash
./start-hermes-monitor.sh
```

`SKIP_BUILD=1 ./start-hermes-monitor.sh` skips repository `npm install` / `npm run build` (see nuance above).

`start-hermes-monitor.sh` does **not** restart OpenClaw; use `start-openclaw-audit-with-restart.sh` or the combo script if you need **8764**.

### Hermes + OpenClaw in one command (git clone)

```bash
./start-hermes-openclaw-combo.sh
```

Environment variables for the **OpenClaw** leg are the same as `start-openclaw-audit-with-restart.sh` (see script header). **`SKIP_BUILD=1`** on the combo script skips only the **initial** repository build before delegating; the child script is always invoked with `SKIP_BUILD=1` for that second phase.

**Combo script does not export** `SKIP_RSYNC`, `SKIP_INSTALL_DEPS`, etc. to the child; set them in the same shell **before** running the combo if you need them for the OpenClaw step, e.g. `SKIP_RSYNC=1 ./start-hermes-openclaw-combo.sh` (same process environment).

### Defaults (Hermes monitor)

- Source JSONL directory: `~/.hermes/llm-audit` (`HERMES_LLM_AUDIT_SOURCE_DIR`)
- Viewer: `http://127.0.0.1:8765/` (`HERMES_LLM_AUDIT_MONITOR_HOST` / `HERMES_LLM_AUDIT_MONITOR_PORT`)
- SQLite database: `~/.hermes/llm-audit-monitor/audit.db` (`HERMES_LLM_AUDIT_MONITOR_HOME`)
- Task ID: Hermes runtime `task_id`

### Hermes environment variables

- `HERMES_LLM_AUDIT_SOURCE_DIR` — JSONL source directory.
- `HERMES_LLM_AUDIT_MONITOR_HOME` — Monitor DB directory (SQLite file lives here).
- `HERMES_LLM_AUDIT_MONITOR_HOST` — Bind host for the monitor HTTP server.
- `HERMES_LLM_AUDIT_MONITOR_PORT` — Viewer port (the shell helpers also accept **`HERMES_MONITOR_PORT`** as a fallback and export the canonical name for Node).
- `HERMES_LLM_AUDIT_MONITOR_POLL_MS` — Poll interval when watching the source dir.
- `HERMES_CONFIG` — Path to Hermes `config.yaml` for the **shell helpers only** (default `~/.hermes/config.yaml`).
