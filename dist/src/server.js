import { createServer } from "node:http";
import { renderLlmAuditViewer } from "./viewer.js";
export async function startLlmAuditServer(store, options = {}) {
    const host = options.host ?? "127.0.0.1";
    const port = options.port ?? 8764;
    const logger = options.logger;
    const server = createServer((req, res) => {
        void dispatch(req, res, store, options).catch((err) => {
            logger?.warn("llm-audit: request failed", {
                err: err instanceof Error ? err.message : String(err),
            });
            writeJson(res, 500, { error: { code: "internal", message: "Internal server error" } });
        });
    });
    await new Promise((resolve, reject) => {
        const onError = (err) => reject(err);
        server.once("error", onError);
        server.listen(port, host, () => {
            server.off("error", onError);
            resolve();
        });
    });
    const addr = server.address();
    const actualPort = typeof addr === "object" && addr ? addr.port : port;
    const url = `http://${host === "0.0.0.0" ? "127.0.0.1" : host}:${actualPort}`;
    let closed = false;
    return {
        url,
        port: actualPort,
        get closed() {
            return closed;
        },
        async close() {
            if (closed)
                return;
            closed = true;
            try {
                server.closeIdleConnections?.();
            }
            catch {
                /* noop */
            }
            await new Promise((resolve) => server.close(() => resolve()));
        },
    };
}
async function dispatch(req, res, store, options) {
    const url = new URL(req.url ?? "/", "http://localhost");
    const method = (req.method ?? "GET").toUpperCase();
    res.setHeader("cache-control", "no-store");
    if (method !== "GET" && method !== "HEAD") {
        writeJson(res, 405, { error: { code: "method_not_allowed", message: "Only GET is supported" } });
        return;
    }
    if (url.pathname === "/" || url.pathname === "/index.html") {
        writeHtml(res, renderLlmAuditViewer({
            variant: options.viewerVariant,
            title: options.name,
            subtitle: options.subtitle,
            taskPlaceholder: options.taskPlaceholder,
            autoLoadLatestTask: options.autoLoadLatestTask,
        }), method === "HEAD");
        return;
    }
    if (url.pathname === "/api/health") {
        writeJson(res, 200, {
            ok: true,
            name: options.name ?? "Openclaw LLM Audit Viewer",
            dbPath: store.paths.dbFile,
        });
        return;
    }
    if (url.pathname === "/api/tasks") {
        const rawLimit = Number(url.searchParams.get("limit") ?? 50);
        const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.trunc(rawLimit))) : 50;
        writeJson(res, 200, { tasks: store.listTasks(limit) });
        return;
    }
    const taskMatch = url.pathname.match(/^\/api\/tasks\/([^/]+)\/calls$/);
    if (taskMatch) {
        const taskId = decodeURIComponent(taskMatch[1]);
        writeJson(res, 200, { taskId, calls: store.getTaskCalls(taskId) });
        return;
    }
    const callMatch = url.pathname.match(/^\/api\/calls\/(\d+)$/);
    if (callMatch) {
        const call = store.getCallById(Number(callMatch[1]));
        if (!call) {
            writeJson(res, 404, { error: { code: "not_found", message: "Audit call not found" } });
            return;
        }
        writeJson(res, 200, { call });
        return;
    }
    writeJson(res, 404, { error: { code: "not_found", message: "Not found" } });
}
function writeHtml(res, body, headOnly) {
    res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        "content-length": Buffer.byteLength(body),
    });
    if (!headOnly)
        res.write(body);
    res.end();
}
function writeJson(res, status, payload) {
    if (res.headersSent)
        return;
    const body = JSON.stringify(payload);
    res.writeHead(status, {
        "content-type": "application/json; charset=utf-8",
        "content-length": Buffer.byteLength(body),
    });
    res.end(body);
}
//# sourceMappingURL=server.js.map