import { createLlmAuditRuntime, resolveConfig, type LlmAuditRuntime } from "./runtime.js";
import type {
  LlmInputEvent,
  LlmOutputEvent,
  OpenClawPluginApi,
  OpenClawPluginServiceContext,
  PluginHookAgentContext,
} from "./types.js";

const PLUGIN_ID = "agent-openclaw-local-monitor";

function definePluginEntry() {
  return {
    id: PLUGIN_ID,
    name: "Openclaw LLM Audit Viewer",
    description: "Captures Openclaw LLM prompts/responses into a local SQLite audit viewer on port 8764.",
    register(api: OpenClawPluginApi) {
      const config = resolveConfig(api.pluginConfig);
      let runtimePromise: Promise<LlmAuditRuntime | null> | null = null;

      const ensureRuntime = (serviceContext?: OpenClawPluginServiceContext) => {
        runtimePromise ??= createLlmAuditRuntime({
          logger: api.logger,
          config,
          serviceContext,
        });
        return runtimePromise;
      };

      api.registerService({
        id: "openclaw-llm-audit-viewer",
        name: "Openclaw LLM Audit Viewer",
        start: async (ctx) => {
          await ensureRuntime(ctx);
        },
        stop: async () => {
          const runtime = await runtimePromise;
          runtimePromise = null;
          await runtime?.shutdown();
        },
      });

      api.on("llm_input", async (event, ctx) => {
        const runtime = await ensureRuntime();
        runtime?.handleLlmInput(event as LlmInputEvent, ctx as PluginHookAgentContext);
      });

      api.on("llm_output", async (event, ctx) => {
        const runtime = await ensureRuntime();
        runtime?.handleLlmOutput(event as LlmOutputEvent, ctx as PluginHookAgentContext);
      });
    },
  };
}

export default definePluginEntry();
export { createLlmAuditRuntime, resolveConfig } from "./runtime.js";
export { LlmAuditStore } from "./store.js";
export type { LlmAuditRuntime } from "./runtime.js";
export type { LlmAuditCall, LlmAuditTaskSummary } from "./store.js";
