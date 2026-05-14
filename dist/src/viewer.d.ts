export type LlmAuditViewerOptions = {
    variant?: "legacy" | "openclaw" | "hermes";
    title?: string;
    subtitle?: string;
    taskPlaceholder?: string;
    autoLoadLatestTask?: boolean;
};
export declare function renderLlmAuditViewer(options?: LlmAuditViewerOptions): string;
//# sourceMappingURL=viewer.d.ts.map