import type { HermesLlmAuditRecord, LlmInputEvent, LlmOutputEvent, PluginHookAgentContext } from "./types.js";
import { type LlmAuditPaths } from "./paths.js";
export type LlmAuditCallStatus = "pending" | "success";
export type LlmAuditCall = {
    id: number;
    taskId: string;
    callIndex: number;
    status: LlmAuditCallStatus;
    createdAt: string;
    updatedAt: string;
    agentId: string | null;
    sessionKey: string | null;
    sessionId: string | null;
    workspaceDir: string | null;
    provider: string | null;
    model: string | null;
    systemPrompt: unknown;
    prompt: unknown;
    history: unknown;
    imagesCount: number;
    output: unknown;
    assistantTexts: unknown;
    lastAssistant: unknown;
    usage: unknown;
    error: unknown;
    sourceKey: string | null;
};
export type LlmAuditTaskSummary = {
    taskId: string;
    calls: number;
    firstSeenAt: string;
    lastSeenAt: string;
    hasPending: boolean;
    models: string[];
    provider: string | null;
    sessionKey: string | null;
};
export declare class LlmAuditStore {
    readonly paths: LlmAuditPaths;
    private readonly db;
    constructor(options?: {
        stateDir?: string;
        auditHome?: string;
        dbFile?: string;
    });
    close(): void;
    recordInput(event: LlmInputEvent, ctx: PluginHookAgentContext): LlmAuditCall;
    recordOutput(event: LlmOutputEvent, ctx: PluginHookAgentContext): LlmAuditCall;
    recordHermesAuditRecord(record: HermesLlmAuditRecord, sourceKey: string): LlmAuditCall | null;
    listTasks(limit?: number): LlmAuditTaskSummary[];
    getTaskCalls(taskId: string): LlmAuditCall[];
    getCallById(id: number): LlmAuditCall | null;
    getCallBySourceKey(sourceKey: string): LlmAuditCall | null;
    private migrate;
    private nextCallIndex;
    private findPendingCall;
}
//# sourceMappingURL=store.d.ts.map