import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
export function resolveLlmAuditPaths(options = {}) {
    const root = path.resolve(expandHome(options.auditHome ??
        process.env.OPENCLAW_LLM_AUDIT_HOME ??
        (options.stateDir ? path.join(options.stateDir, "llm-audit") : "~/.openclaw/llm-audit")));
    mkdirSync(root, { recursive: true });
    return {
        root,
        dbFile: path.join(root, "audit.db"),
    };
}
export function expandHome(input) {
    if (input === "~")
        return homedir();
    if (input.startsWith("~/"))
        return path.join(homedir(), input.slice(2));
    return input.replace(/\{HOME\}/g, homedir());
}
//# sourceMappingURL=paths.js.map