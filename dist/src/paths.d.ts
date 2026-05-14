export type LlmAuditPaths = {
    root: string;
    dbFile: string;
};
export declare function resolveLlmAuditPaths(options?: {
    stateDir?: string;
    auditHome?: string;
}): LlmAuditPaths;
export declare function expandHome(input: string): string;
//# sourceMappingURL=paths.d.ts.map