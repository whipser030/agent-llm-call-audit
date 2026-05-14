import { LlmAuditStore } from "./store.js";
import { startLlmAuditServer } from "./server.js";
export async function createLlmAuditRuntime(options) {
    const { logger, config, serviceContext } = options;
    if (!config.enabled) {
        logger.info("llm-audit: disabled");
        return null;
    }
    const store = new LlmAuditStore({
        stateDir: serviceContext?.stateDir,
        auditHome: config.auditHome,
    });
    let server = null;
    try {
        server = await startLlmAuditServer(store, {
            host: config.host,
            port: config.port,
            logger,
            viewerVariant: "openclaw",
        });
        logger.info(`llm-audit: viewer live at ${server.url}`);
    }
    catch (err) {
        const e = err;
        if (e?.code === "EADDRINUSE") {
            logger.warn(`llm-audit: viewer port :${config.port} is already in use; audit capture will continue`);
        }
        else {
            logger.warn(`llm-audit: viewer failed to start; audit capture will continue: ${e?.message ?? String(err)}`);
        }
    }
    return {
        store,
        server,
        handleLlmInput(event, ctx) {
            try {
                store.recordInput(event, ctx);
            }
            catch (err) {
                logger.warn(`llm-audit: failed to record llm_input: ${err instanceof Error ? err.message : String(err)}`);
            }
        },
        handleLlmOutput(event, ctx) {
            try {
                store.recordOutput(event, ctx);
            }
            catch (err) {
                logger.warn(`llm-audit: failed to record llm_output: ${err instanceof Error ? err.message : String(err)}`);
            }
        },
        async shutdown() {
            if (server) {
                try {
                    await server.close();
                }
                catch (err) {
                    logger.warn(`llm-audit: viewer close error: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            try {
                store.close();
            }
            catch (err) {
                logger.warn(`llm-audit: store close error: ${err instanceof Error ? err.message : String(err)}`);
            }
        },
    };
}
export function resolveConfig(raw) {
    return {
        enabled: envEnabled("OPENCLAW_LLM_AUDIT", boolFrom(raw?.enabled, true)),
        host: stringFrom(raw?.host, process.env.OPENCLAW_LLM_AUDIT_HOST ?? "127.0.0.1"),
        port: numberFrom(raw?.port, process.env.OPENCLAW_LLM_AUDIT_PORT, 8764),
        auditHome: stringOptional(raw?.auditHome ?? process.env.OPENCLAW_LLM_AUDIT_HOME),
    };
}
function envEnabled(name, fallback) {
    const value = process.env[name];
    if (value === undefined || value.trim() === "")
        return fallback;
    return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
}
function boolFrom(value, fallback) {
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string")
        return !["0", "false", "no", "off"].includes(value.trim().toLowerCase());
    return fallback;
}
function stringFrom(value, fallback) {
    return typeof value === "string" && value.trim() ? value.trim() : fallback;
}
function stringOptional(value) {
    return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function numberFrom(value, envValue, fallback) {
    const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number(envValue);
    return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : fallback;
}
//# sourceMappingURL=runtime.js.map