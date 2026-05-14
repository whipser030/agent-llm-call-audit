import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startLlmAuditServer } from "../src/server.js";
import { LlmAuditStore } from "../src/store.js";
import { startHermesLlmAuditMonitor } from "../src/hermes.js";
import plugin from "../src/index.js";
let tmpDir;
let store;
let server = null;
let hermesMonitor = null;
beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-llm-audit-"));
    store = new LlmAuditStore({ auditHome: tmpDir });
});
afterEach(async () => {
    if (hermesMonitor) {
        await hermesMonitor.close();
        hermesMonitor = null;
    }
    if (server) {
        await server.close();
        server = null;
    }
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
});
describe("LlmAuditStore", () => {
    it("inserts llm_input and updates it from llm_output by Task ID", () => {
        store.recordInput({
            runId: "run-123",
            sessionId: "session-1",
            provider: "openai",
            model: "gpt-test",
            systemPrompt: "You are helpful",
            prompt: "Use Bearer abcdefghijklmnopqrstuvwxyz0123456789",
            historyMessages: [{ role: "user", content: "hello", api_key: "secret-value" }],
            imagesCount: 0,
        }, {
            runId: "run-123",
            agentId: "main",
            sessionKey: "thread-1",
            sessionId: "session-1",
            workspaceDir: "/tmp/workspace",
        });
        const output = store.recordOutput({
            runId: "run-123",
            sessionId: "session-1",
            provider: "openai",
            model: "gpt-test",
            assistantTexts: ["final answer"],
            lastAssistant: {
                role: "assistant",
                content: [
                    { type: "thinking", thinking: "think step" },
                    { type: "toolCall", name: "shell", arguments: { command: "pwd" } },
                    { type: "text", text: "final answer" },
                ],
            },
            usage: { input: 10, output: 20, total: 30 },
        }, {
            runId: "run-123",
            agentId: "main",
            sessionKey: "thread-1",
            sessionId: "session-1",
            workspaceDir: "/tmp/workspace",
        });
        expect(output.taskId).toBe("run-123");
        expect(output.callIndex).toBe(1);
        expect(output.status).toBe("success");
        const calls = store.getTaskCalls("run-123");
        expect(calls).toHaveLength(1);
        expect(calls[0].prompt).toBe("Use Bearer [REDACTED]");
        expect(calls[0].history).toEqual([{ role: "user", content: "hello", api_key: "[REDACTED]" }]);
        expect(calls[0].lastAssistant).toEqual({
            role: "assistant",
            content: [
                { type: "thinking", thinking: "think step" },
                { type: "toolCall", name: "shell", arguments: { command: "pwd" } },
                { type: "text", text: "final answer" },
            ],
        });
        expect(calls[0].usage).toEqual({ input: 10, output: 20, total: 30 });
        expect(store.listTasks()).toMatchObject([
            {
                taskId: "run-123",
                calls: 1,
                hasPending: false,
                models: ["gpt-test"],
                provider: "openai",
                sessionKey: "thread-1",
            },
        ]);
    });
    it("keeps a pending prompt when output has not arrived", () => {
        store.recordInput({
            runId: "run-pending",
            sessionId: "session-2",
            provider: "anthropic",
            model: "claude-test",
            prompt: "hello",
            historyMessages: [],
            imagesCount: 1,
        }, { runId: "run-pending", sessionKey: "thread-2" });
        expect(store.getTaskCalls("run-pending")[0]).toMatchObject({
            taskId: "run-pending",
            callIndex: 1,
            status: "pending",
            imagesCount: 1,
        });
    });
    it("imports Hermes JSONL records once by source key", () => {
        store.recordHermesAuditRecord({
            timestamp: "2026-05-08T11:49:05.219493+00:00",
            session_id: "session-hermes",
            task_id: "task-hermes",
            platform: "cli",
            provider: "custom",
            model: "gpt-5.5",
            api_mode: "chat_completions",
            api_call_count: 3,
            duration_ms: 25385,
            request: {
                body: {
                    messages: [
                        { role: "system", content: "You are helpful" },
                        { role: "user", content: "Use token sk-test-secret-abcdefghijklmnop" },
                    ],
                },
            },
            assistant_message: { role: "assistant", content: "answer" },
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }, "llm_calls_session-hermes.jsonl:1");
        store.recordHermesAuditRecord({ session_id: "session-hermes", task_id: "task-hermes" }, "llm_calls_session-hermes.jsonl:1");
        store.recordHermesAuditRecord({ session_id: "session-only", provider: "custom", model: "gpt-5.5" }, "llm_calls_session-only.jsonl:1");
        const calls = store.getTaskCalls("task-hermes");
        expect(calls).toHaveLength(1);
        expect(calls[0]).toMatchObject({
            taskId: "task-hermes",
            provider: "custom",
            model: "gpt-5.5",
            sessionKey: "session-hermes",
            sourceKey: "llm_calls_session-hermes.jsonl:1",
        });
        expect(calls[0].systemPrompt).toBe("You are helpful");
        expect(calls[0].prompt).toBe("Use token [REDACTED_OPENAI_KEY]");
        expect(calls[0].assistantTexts).toEqual(["answer"]);
        expect(store.getTaskCalls("session-only")).toHaveLength(0);
    });
});
describe("LlmAuditServer", () => {
    it("serves health and Task ID call queries", async () => {
        store.recordInput({
            runId: "run-http",
            sessionId: "session-http",
            provider: "local",
            model: "model-http",
            prompt: "hello web",
            historyMessages: [],
            imagesCount: 0,
        }, { runId: "run-http" });
        server = await startLlmAuditServer(store, { port: 0 });
        const health = await fetchJson(`${server.url}/api/health`);
        expect(health).toMatchObject({ ok: true, name: "Openclaw LLM Audit Viewer" });
        const payload = await fetchJson(`${server.url}/api/tasks/run-http/calls`);
        expect(payload.taskId).toBe("run-http");
        expect(payload.calls).toHaveLength(1);
        const html = await fetch(`${server.url}/`).then((res) => res.text());
        expect(html).toContain("Openclaw LLM Audit Viewer");
        expect(html).toContain("Task ID");
    });
    it("serves the OpenClaw shell viewer with lake-blue title and three-column layout", async () => {
        store.recordInput({
            runId: "run-openclaw-ui",
            sessionId: "session-openclaw-ui",
            provider: "local",
            model: "model-ui",
            systemPrompt: "# System\n\n- Be useful",
            prompt: "# Prompt\n\n**bold** and `code`",
            historyMessages: [],
            imagesCount: 0,
        }, { runId: "run-openclaw-ui" });
        server = await startLlmAuditServer(store, { port: 0, viewerVariant: "openclaw" });
        const html = await fetch(`${server.url}/`).then((res) => res.text());
        expect(html).toContain("Openclaw LLM Audit Viewer");
        expect(html).toContain(".audit-shell--openclaw h1");
        expect(html).toContain("#2aa7c8");
        expect(html).not.toContain("#ff3eb5");
        expect(html).toContain('id="taskList"');
        expect(html).toContain('id="callList"');
        expect(html).not.toContain("function renderMarkdownPlain");
        expect(html).not.toContain('class="markdown"');
        expect(html).toContain("Loading recent OpenClaw tasks");
        expect(html).toContain("json-string");
        expect(html).toContain("data:image/svg+xml");
        expect(html).toContain("%23ff4500");
        expect(html).not.toContain("/hermes-favicon.png");
    });
    it("serves custom viewer branding", async () => {
        server = await startLlmAuditServer(store, {
            port: 0,
            name: "Hermes LLM Audit Viewer",
            subtitle: "Automatically imports Hermes runtime task_id calls",
            taskPlaceholder: "Hermes task_id",
            autoLoadLatestTask: true,
        });
        const health = await fetchJson(`${server.url}/api/health`);
        expect(health).toMatchObject({ ok: true, name: "Hermes LLM Audit Viewer" });
        const html = await fetch(`${server.url}/`).then((res) => res.text());
        expect(html).toContain("Hermes LLM Audit Viewer");
        expect(html).toContain("Hermes task_id");
        expect(html).toContain("loadTask(state.tasks[0].taskId)");
        expect(html).not.toContain("Loading recent OpenClaw tasks");
        expect(html).not.toContain("--accent: #2aa7c8");
    });
});
describe("Hermes monitor entry", () => {
    it("tails Hermes audit JSONL into the shared viewer store", async () => {
        const sourceDir = path.join(tmpDir, "hermes-source");
        const auditHome = path.join(tmpDir, "hermes-monitor");
        fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, "llm_calls_session-hermes.jsonl"), `${JSON.stringify({
            session_id: "session-hermes",
            task_id: "task-hermes",
            provider: "custom",
            model: "gpt-5.5",
            request: { body: { messages: [{ role: "user", content: "hello" }] } },
            assistant_message: { role: "assistant", content: "hi" },
        })}\n`);
        hermesMonitor = await startHermesLlmAuditMonitor({ sourceDir, auditHome, port: 0, pollMs: 50 }, { info: () => { }, warn: () => { }, error: () => { } });
        const payload = await fetchJson(`${hermesMonitor.url}/api/tasks/task-hermes/calls`);
        expect(payload.taskId).toBe("task-hermes");
        expect(payload.calls).toHaveLength(1);
        const html = await fetch(`${hermesMonitor.url}/`).then((res) => res.text());
        expect(html).toContain("Hermes LLM Audit Monitor");
        expect(html).toContain("/hermes-favicon.png");
        expect(html).toContain("#ff3eb5");
        expect(html).toContain("audit-shell--hermes");
        const fav = await fetch(`${hermesMonitor.url}/hermes-favicon.png`);
        expect(fav.status).toBe(200);
        expect(fav.headers.get("content-type")).toContain("image/png");
        const favBuf = Buffer.from(await fav.arrayBuffer());
        expect(favBuf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    });
});
describe("Openclaw plugin entry", () => {
    it("registers startup service and LLM hooks", async () => {
        const handlers = new Map();
        let service = null;
        const api = {
            id: "agent-openclaw-local-monitor",
            name: "Openclaw LLM Audit Viewer",
            pluginConfig: { auditHome: tmpDir, port: 0 },
            logger: {
                info: () => { },
                warn: () => { },
                error: () => { },
            },
            registerService: (s) => {
                service = s;
            },
            on: (name, handler) => {
                handlers.set(name, handler);
            },
        };
        plugin.register(api);
        const registeredService = service;
        expect(registeredService?.id).toBe("openclaw-llm-audit-viewer");
        expect(handlers.has("llm_input")).toBe(true);
        expect(handlers.has("llm_output")).toBe(true);
        const ctx = { stateDir: tmpDir };
        await registeredService?.start?.(ctx);
        await handlers.get("llm_input")?.({
            runId: "run-plugin",
            sessionId: "session-plugin",
            provider: "test",
            model: "test-model",
            prompt: "hello",
            historyMessages: [],
            imagesCount: 0,
        }, { runId: "run-plugin" });
        await handlers.get("llm_output")?.({
            runId: "run-plugin",
            sessionId: "session-plugin",
            provider: "test",
            model: "test-model",
            assistantTexts: ["answer"],
        }, { runId: "run-plugin" });
        await registeredService?.stop?.(ctx);
        const check = new LlmAuditStore({ auditHome: tmpDir });
        try {
            expect(check.getTaskCalls("run-plugin")).toMatchObject([
                { taskId: "run-plugin", callIndex: 1, status: "success" },
            ]);
        }
        finally {
            check.close();
        }
    });
});
async function fetchJson(url) {
    const res = await fetch(url);
    expect(res.ok).toBe(true);
    return (await res.json());
}
//# sourceMappingURL=audit.test.js.map