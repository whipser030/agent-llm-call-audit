export type HostLogger = {
  debug?: (message: string, ctx?: Record<string, unknown>) => void;
  info: (message: string, ctx?: Record<string, unknown>) => void;
  warn: (message: string, ctx?: Record<string, unknown>) => void;
  error: (message: string, ctx?: Record<string, unknown>) => void;
};

export type PluginHookAgentContext = {
  runId?: string;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  workspaceDir?: string;
  modelProviderId?: string;
  modelId?: string;
  messageProvider?: string;
  trigger?: string;
  channelId?: string;
};

export type LlmInputEvent = {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  prompt: string;
  historyMessages: unknown[];
  imagesCount: number;
};

export type LlmOutputEvent = {
  runId: string;
  sessionId: string;
  provider: string;
  model: string;
  assistantTexts: string[];
  lastAssistant?: unknown;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
};

export type HermesLlmAuditRecord = {
  timestamp?: string;
  session_id?: string;
  task_id?: string;
  platform?: string;
  provider?: string;
  model?: string;
  api_mode?: string;
  turn_index?: number | null;
  api_call_count?: number;
  duration_ms?: number | null;
  request?: unknown;
  response?: unknown;
  assistant_message?: unknown;
  usage?: unknown;
  finish_reason?: string | null;
  error?: unknown;
};

export type OpenClawPluginServiceContext = {
  stateDir: string;
  workspaceDir?: string;
  logger?: HostLogger;
};

export type OpenClawPluginApi = {
  id: string;
  name: string;
  version?: string;
  pluginConfig?: Record<string, unknown>;
  logger: HostLogger;
  on: (
    hookName: "llm_input" | "llm_output",
    handler: (event: never, ctx: PluginHookAgentContext) => void | Promise<void>,
    opts?: { priority?: number },
  ) => void;
  registerService: (service: {
    id: string;
    name?: string;
    start?: (ctx: OpenClawPluginServiceContext) => void | Promise<void>;
    stop?: (ctx: OpenClawPluginServiceContext) => void | Promise<void>;
  }) => void;
};

export type LlmAuditConfig = {
  enabled: boolean;
  host: string;
  port: number;
  auditHome?: string;
};
