#!/usr/bin/env node
import { type LlmAuditServerHandle } from "./server.js";
import { LlmAuditStore } from "./store.js";
import type { HostLogger } from "./types.js";
export type HermesMonitorConfig = {
    sourceDir: string;
    auditHome: string;
    host: string;
    port: number;
    pollMs: number;
};
export type HermesMonitorHandle = {
    store: LlmAuditStore;
    server: LlmAuditServerHandle;
    url: string;
    close(): Promise<void>;
};
export declare function startHermesLlmAuditMonitor(config?: Partial<HermesMonitorConfig>, logger?: HostLogger): Promise<HermesMonitorHandle>;
export declare function resolveHermesMonitorConfig(config?: Partial<HermesMonitorConfig>): HermesMonitorConfig;
//# sourceMappingURL=hermes.d.ts.map