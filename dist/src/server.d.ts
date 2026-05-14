import type { HostLogger } from "./types.js";
import type { LlmAuditStore } from "./store.js";
export type LlmAuditServerHandle = {
    url: string;
    port: number;
    readonly closed: boolean;
    close(): Promise<void>;
};
export declare function startLlmAuditServer(store: LlmAuditStore, options?: {
    host?: string;
    port?: number;
    logger?: HostLogger;
    viewerVariant?: "legacy" | "openclaw" | "hermes";
    name?: string;
    subtitle?: string;
    taskPlaceholder?: string;
    autoLoadLatestTask?: boolean;
}): Promise<LlmAuditServerHandle>;
//# sourceMappingURL=server.d.ts.map