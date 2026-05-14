import type { OpenClawPluginApi } from "./types.js";
declare const _default: {
    id: string;
    name: string;
    description: string;
    register(api: OpenClawPluginApi): void;
};
export default _default;
export { createLlmAuditRuntime, resolveConfig } from "./runtime.js";
export { LlmAuditStore } from "./store.js";
export type { LlmAuditRuntime } from "./runtime.js";
export type { LlmAuditCall, LlmAuditTaskSummary } from "./store.js";
//# sourceMappingURL=index.d.ts.map