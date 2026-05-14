import { LlmAuditStore } from "./store.js";
import { type LlmAuditServerHandle } from "./server.js";
import type { HostLogger, LlmAuditConfig, LlmInputEvent, LlmOutputEvent, OpenClawPluginServiceContext, PluginHookAgentContext } from "./types.js";
export type LlmAuditRuntime = {
    store: LlmAuditStore;
    server: LlmAuditServerHandle | null;
    handleLlmInput(event: LlmInputEvent, ctx: PluginHookAgentContext): void;
    handleLlmOutput(event: LlmOutputEvent, ctx: PluginHookAgentContext): void;
    shutdown(): Promise<void>;
};
export declare function createLlmAuditRuntime(options: {
    logger: HostLogger;
    config: LlmAuditConfig;
    serviceContext?: OpenClawPluginServiceContext;
}): Promise<LlmAuditRuntime | null>;
export declare function resolveConfig(raw: Record<string, unknown> | undefined): LlmAuditConfig;
//# sourceMappingURL=runtime.d.ts.map