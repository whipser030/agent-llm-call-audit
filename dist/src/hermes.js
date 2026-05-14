#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { startLlmAuditServer } from "./server.js";
import { LlmAuditStore } from "./store.js";
import { expandHome } from "./paths.js";
const DEFAULT_SOURCE_DIR = "~/.hermes/llm-audit";
const DEFAULT_AUDIT_HOME = "~/.hermes/llm-audit-monitor";
export async function startHermesLlmAuditMonitor(config = {}, logger = consoleLogger) {
    const resolved = resolveHermesMonitorConfig(config);
    fs.mkdirSync(resolved.sourceDir, { recursive: true });
    const store = new LlmAuditStore({ auditHome: resolved.auditHome });
    const states = new Map();
    const ingestFile = (filePath) => ingestJsonlFile(filePath, states, store, logger);
    const ingestAll = () => {
        for (const filePath of listAuditFiles(resolved.sourceDir)) {
            ingestFile(filePath);
        }
    };
    ingestAll();
    let server;
    try {
        server = await startLlmAuditServer(store, {
            host: resolved.host,
            port: resolved.port,
            logger,
            viewerVariant: "hermes",
            name: "Hermes LLM Audit Monitor",
            subtitle: "Automatically imports Hermes runtime task_id calls",
            taskPlaceholder: "Hermes task_id",
            autoLoadLatestTask: true,
        });
    }
    catch (err) {
        store.close();
        throw err;
    }
    let watcher = null;
    try {
        watcher = fs.watch(resolved.sourceDir, { persistent: true }, (_event, filename) => {
            if (typeof filename === "string" && /^llm_calls_.*\.jsonl$/.test(filename)) {
                ingestFile(path.join(resolved.sourceDir, filename));
            }
        });
        watcher.on("error", (err) => {
            logger.warn(`hermes-llm-audit: fs.watch disabled; polling continues: ${err.message}`);
            watcher?.close();
            watcher = null;
        });
    }
    catch (err) {
        logger.warn(`hermes-llm-audit: fs.watch unavailable; polling continues: ${err instanceof Error ? err.message : String(err)}`);
    }
    const interval = setInterval(ingestAll, resolved.pollMs);
    logger.info(`hermes-llm-audit: watching ${resolved.sourceDir}`);
    logger.info(`hermes-llm-audit: viewer live at ${server.url}`);
    return {
        store,
        server,
        url: server.url,
        async close() {
            clearInterval(interval);
            watcher?.close();
            await server.close();
            store.close();
        },
    };
}
export function resolveHermesMonitorConfig(config = {}) {
    return {
        sourceDir: path.resolve(expandHome(config.sourceDir ?? process.env.HERMES_LLM_AUDIT_SOURCE_DIR ?? DEFAULT_SOURCE_DIR)),
        auditHome: path.resolve(expandHome(config.auditHome ?? process.env.HERMES_LLM_AUDIT_MONITOR_HOME ?? DEFAULT_AUDIT_HOME)),
        host: config.host ?? process.env.HERMES_LLM_AUDIT_MONITOR_HOST ?? "127.0.0.1",
        port: numberFrom(config.port, process.env.HERMES_LLM_AUDIT_MONITOR_PORT, 8765),
        pollMs: numberFrom(config.pollMs, process.env.HERMES_LLM_AUDIT_MONITOR_POLL_MS, 2000),
    };
}
function ingestJsonlFile(filePath, states, store, logger) {
    if (!/^llm_calls_.*\.jsonl$/.test(path.basename(filePath)))
        return;
    let stat;
    try {
        stat = fs.statSync(filePath);
    }
    catch {
        return;
    }
    if (!stat.isFile())
        return;
    const state = states.get(filePath) ?? { offset: 0, lines: 0, leftover: "" };
    if (stat.size < state.offset) {
        state.offset = 0;
        state.lines = 0;
        state.leftover = "";
    }
    if (stat.size === state.offset && !state.leftover) {
        states.set(filePath, state);
        return;
    }
    const chunk = readRange(filePath, state.offset, stat.size);
    state.offset = stat.size;
    const text = state.leftover + chunk;
    state.leftover = "";
    const lines = text.split(/\r?\n/);
    const trailing = lines.pop() ?? "";
    for (const line of lines) {
        ingestLine(filePath, line, state, store, logger);
    }
    if (trailing.trim()) {
        if (isCompleteJsonObject(trailing)) {
            ingestLine(filePath, trailing, state, store, logger);
        }
        else {
            state.leftover = trailing;
        }
    }
    states.set(filePath, state);
}
function ingestLine(filePath, line, state, store, logger) {
    const sourceKey = `${path.basename(filePath)}:${state.lines + 1}`;
    state.lines += 1;
    if (!line.trim())
        return;
    try {
        const parsed = JSON.parse(line);
        if (!parsed || typeof parsed !== "object")
            return;
        const imported = store.recordHermesAuditRecord(parsed, sourceKey);
        if (!imported) {
            logger.warn(`hermes-llm-audit: skipped record without Hermes task_id ${sourceKey}`);
        }
    }
    catch (err) {
        logger.warn(`hermes-llm-audit: skipped malformed JSONL record ${sourceKey}: ${err instanceof Error ? err.message : String(err)}`);
    }
}
function readRange(filePath, start, end) {
    const length = end - start;
    if (length <= 0)
        return "";
    const fd = fs.openSync(filePath, "r");
    try {
        const buffer = Buffer.alloc(length);
        fs.readSync(fd, buffer, 0, length, start);
        return buffer.toString("utf8");
    }
    finally {
        fs.closeSync(fd);
    }
}
function listAuditFiles(sourceDir) {
    try {
        return fs
            .readdirSync(sourceDir)
            .filter((name) => /^llm_calls_.*\.jsonl$/.test(name))
            .map((name) => path.join(sourceDir, name))
            .sort();
    }
    catch {
        return [];
    }
}
function isCompleteJsonObject(line) {
    try {
        JSON.parse(line);
        return true;
    }
    catch {
        return false;
    }
}
function numberFrom(value, envValue, fallback) {
    const raw = value ?? Number(envValue);
    return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : fallback;
}
const consoleLogger = {
    info: (message) => console.log(message),
    warn: (message) => console.warn(message),
    error: (message) => console.error(message),
};
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const handle = await startHermesLlmAuditMonitor();
    const shutdown = async () => {
        await handle.close();
        process.exit(0);
    };
    process.on("SIGINT", () => void shutdown());
    process.on("SIGTERM", () => void shutdown());
}
//# sourceMappingURL=hermes.js.map