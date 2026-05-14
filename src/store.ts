import Database from "better-sqlite3";

import type {
  HermesLlmAuditRecord,
  LlmInputEvent,
  LlmOutputEvent,
  PluginHookAgentContext,
} from "./types.js";
import { resolveLlmAuditPaths, type LlmAuditPaths } from "./paths.js";
import { sanitizeAuditValue } from "./sanitize.js";

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

type DbRow = {
  id: number;
  task_id: string;
  call_index: number;
  status: LlmAuditCallStatus;
  created_at: string;
  updated_at: string;
  agent_id: string | null;
  session_key: string | null;
  session_id: string | null;
  workspace_dir: string | null;
  provider: string | null;
  model: string | null;
  system_prompt_json: string | null;
  prompt_json: string | null;
  history_json: string | null;
  images_count: number | null;
  output_json: string | null;
  assistant_texts_json: string | null;
  last_assistant_json: string | null;
  usage_json: string | null;
  error_json: string | null;
  source_key: string | null;
};

type TaskRow = {
  task_id: string;
  calls: number;
  first_seen_at: string;
  last_seen_at: string;
  has_pending: number;
  models: string | null;
  provider: string | null;
  session_key: string | null;
};

export class LlmAuditStore {
  readonly paths: LlmAuditPaths;
  private readonly db: Database.Database;

  constructor(options: { stateDir?: string; auditHome?: string; dbFile?: string } = {}) {
    this.paths = options.dbFile
      ? { root: "", dbFile: options.dbFile }
      : resolveLlmAuditPaths({ stateDir: options.stateDir, auditHome: options.auditHome });
    this.db = new Database(this.paths.dbFile);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.migrate();
  }

  close(): void {
    this.db.close();
  }

  recordInput(event: LlmInputEvent, ctx: PluginHookAgentContext): LlmAuditCall {
    const taskId = taskIdFrom(event.runId, ctx.runId);
    const now = new Date().toISOString();
    const id = this.db.transaction(() => {
      const callIndex = this.nextCallIndex(taskId);
      const info = this.db
        .prepare(
          `INSERT INTO llm_audit_calls (
            task_id, call_index, status, created_at, updated_at,
            agent_id, session_key, session_id, workspace_dir, provider, model,
            system_prompt_json, prompt_json, history_json, images_count
          ) VALUES (
            @taskId, @callIndex, 'pending', @now, @now,
            @agentId, @sessionKey, @sessionId, @workspaceDir, @provider, @model,
            @systemPrompt, @prompt, @history, @imagesCount
          )`,
        )
        .run({
          taskId,
          callIndex,
          now,
          agentId: ctx.agentId ?? null,
          sessionKey: ctx.sessionKey ?? null,
          sessionId: event.sessionId ?? ctx.sessionId ?? null,
          workspaceDir: ctx.workspaceDir ?? null,
          provider: event.provider ?? null,
          model: event.model ?? null,
          systemPrompt: toJson(event.systemPrompt ?? null),
          prompt: toJson(event.prompt),
          history: toJson(event.historyMessages ?? []),
          imagesCount: event.imagesCount ?? 0,
        });
      return Number(info.lastInsertRowid);
    })();
    return this.getCallById(id)!;
  }

  recordOutput(event: LlmOutputEvent, ctx: PluginHookAgentContext): LlmAuditCall {
    const taskId = taskIdFrom(event.runId, ctx.runId);
    const now = new Date().toISOString();
    const output = {
      runId: event.runId,
      sessionId: event.sessionId,
      provider: event.provider,
      model: event.model,
      assistantTexts: event.assistantTexts,
      lastAssistant: event.lastAssistant ?? null,
      usage: event.usage ?? null,
    };
    const id = this.db.transaction(() => {
      const pending = this.findPendingCall(taskId, event, ctx);
      if (pending) {
        this.db
          .prepare(
            `UPDATE llm_audit_calls
             SET status = 'success',
                 updated_at = @now,
                 output_json = @output,
                 assistant_texts_json = @assistantTexts,
                 last_assistant_json = @lastAssistant,
                 usage_json = @usage,
                 provider = COALESCE(provider, @provider),
                 model = COALESCE(model, @model),
                 session_id = COALESCE(session_id, @sessionId)
             WHERE id = @id`,
          )
          .run({
            id: pending.id,
            now,
            output: toJson(output),
            assistantTexts: toJson(event.assistantTexts ?? []),
            lastAssistant: toJson(event.lastAssistant ?? null),
            usage: toJson(event.usage ?? null),
            provider: event.provider ?? null,
            model: event.model ?? null,
            sessionId: event.sessionId ?? ctx.sessionId ?? null,
          });
        return pending.id;
      }

      const callIndex = this.nextCallIndex(taskId);
      const info = this.db
        .prepare(
          `INSERT INTO llm_audit_calls (
            task_id, call_index, status, created_at, updated_at,
            agent_id, session_key, session_id, workspace_dir, provider, model,
            output_json, assistant_texts_json, last_assistant_json, usage_json
          ) VALUES (
            @taskId, @callIndex, 'success', @now, @now,
            @agentId, @sessionKey, @sessionId, @workspaceDir, @provider, @model,
            @output, @assistantTexts, @lastAssistant, @usage
          )`,
        )
        .run({
          taskId,
          callIndex,
          now,
          agentId: ctx.agentId ?? null,
          sessionKey: ctx.sessionKey ?? null,
          sessionId: event.sessionId ?? ctx.sessionId ?? null,
          workspaceDir: ctx.workspaceDir ?? null,
          provider: event.provider ?? null,
          model: event.model ?? null,
          output: toJson(output),
          assistantTexts: toJson(event.assistantTexts ?? []),
          lastAssistant: toJson(event.lastAssistant ?? null),
          usage: toJson(event.usage ?? null),
        });
      return Number(info.lastInsertRowid);
    })();
    return this.getCallById(id)!;
  }

  recordHermesAuditRecord(record: HermesLlmAuditRecord, sourceKey: string): LlmAuditCall | null {
    const existing = this.getCallBySourceKey(sourceKey);
    if (existing) return existing;

    const taskId = typeof record.task_id === "string" ? record.task_id.trim() : "";
    if (!taskId) return null;

    const sessionId = record.session_id || null;
    const requestBody = getRecordObject(record.request, "body") ?? record.request ?? null;
    const messages = extractMessages(requestBody);
    const output = {
      platform: record.platform ?? "hermes",
      apiMode: record.api_mode ?? null,
      apiCallCount: record.api_call_count ?? null,
      turnIndex: record.turn_index ?? null,
      durationMs: record.duration_ms ?? null,
      finishReason: record.finish_reason ?? null,
      request: record.request ?? null,
      response: record.response ?? null,
    };
    const now = typeof record.timestamp === "string" && record.timestamp.trim() ? record.timestamp : new Date().toISOString();

    const id = this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT OR IGNORE INTO llm_audit_calls (
            task_id, call_index, status, created_at, updated_at,
            agent_id, session_key, session_id, workspace_dir, provider, model,
            system_prompt_json, prompt_json, history_json, images_count,
            output_json, assistant_texts_json, last_assistant_json, usage_json, error_json,
            source_key
          ) VALUES (
            @taskId, @callIndex, 'success', @now, @now,
            'hermes', @sessionKey, @sessionId, NULL, @provider, @model,
            @systemPrompt, @prompt, @history, 0,
            @output, @assistantTexts, @lastAssistant, @usage, @error,
            @sourceKey
          )`,
        )
        .run({
          taskId,
          callIndex: this.nextCallIndex(taskId),
          now,
          sessionKey: sessionId,
          sessionId,
          provider: record.provider ?? null,
          model: record.model ?? null,
          systemPrompt: toJson(firstMessageContent(messages, "system")),
          prompt: toJson(lastUserPrompt(messages) ?? requestBody),
          history: toJson(messages),
          output: toJson(output),
          assistantTexts: toJson(extractAssistantTexts(record.assistant_message)),
          lastAssistant: toJson(record.assistant_message ?? null),
          usage: toJson(record.usage ?? null),
          error: toJson(record.error ?? null),
          sourceKey,
        });
      return Number(info.lastInsertRowid);
    })();

    return (id ? this.getCallById(id) : this.getCallBySourceKey(sourceKey))!;
  }

  listTasks(limit = 50): LlmAuditTaskSummary[] {
    const rows = this.db
      .prepare(
        `SELECT
           task_id,
           COUNT(*) AS calls,
           MIN(created_at) AS first_seen_at,
           MAX(updated_at) AS last_seen_at,
           MAX(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS has_pending,
           GROUP_CONCAT(DISTINCT model) AS models,
           MAX(provider) AS provider,
           MAX(session_key) AS session_key
         FROM llm_audit_calls
         GROUP BY task_id
         ORDER BY last_seen_at DESC
         LIMIT @limit`,
      )
      .all({ limit }) as TaskRow[];
    return rows.map((row) => ({
      taskId: row.task_id,
      calls: row.calls,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      hasPending: Boolean(row.has_pending),
      models: row.models ? row.models.split(",").filter(Boolean) : [],
      provider: row.provider,
      sessionKey: row.session_key,
    }));
  }

  getTaskCalls(taskId: string): LlmAuditCall[] {
    const rows = this.db
      .prepare(`SELECT * FROM llm_audit_calls WHERE task_id = @taskId ORDER BY call_index ASC`)
      .all({ taskId }) as DbRow[];
    return rows.map(rowToCall);
  }

  getCallById(id: number): LlmAuditCall | null {
    const row = this.db.prepare(`SELECT * FROM llm_audit_calls WHERE id = @id`).get({ id }) as
      | DbRow
      | undefined;
    return row ? rowToCall(row) : null;
  }

  getCallBySourceKey(sourceKey: string): LlmAuditCall | null {
    const row = this.db
      .prepare(`SELECT * FROM llm_audit_calls WHERE source_key = @sourceKey`)
      .get({ sourceKey }) as DbRow | undefined;
    return row ? rowToCall(row) : null;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS llm_audit_calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id TEXT NOT NULL,
        call_index INTEGER NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'success')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        agent_id TEXT,
        session_key TEXT,
        session_id TEXT,
        workspace_dir TEXT,
        provider TEXT,
        model TEXT,
        system_prompt_json TEXT,
        prompt_json TEXT,
        history_json TEXT,
        images_count INTEGER DEFAULT 0,
        output_json TEXT,
        assistant_texts_json TEXT,
        last_assistant_json TEXT,
        usage_json TEXT,
        error_json TEXT,
        source_key TEXT,
        UNIQUE(task_id, call_index)
      );
      CREATE INDEX IF NOT EXISTS idx_llm_audit_calls_task_call ON llm_audit_calls(task_id, call_index);
      CREATE INDEX IF NOT EXISTS idx_llm_audit_calls_session_key ON llm_audit_calls(session_key);
      CREATE INDEX IF NOT EXISTS idx_llm_audit_calls_created_at ON llm_audit_calls(created_at);
      CREATE INDEX IF NOT EXISTS idx_llm_audit_calls_status ON llm_audit_calls(status);
    `);
    const columns = this.db.prepare(`PRAGMA table_info(llm_audit_calls)`).all() as Array<{ name: string }>;
    if (!columns.some((column) => column.name === "source_key")) {
      this.db.exec(`ALTER TABLE llm_audit_calls ADD COLUMN source_key TEXT`);
    }
    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_llm_audit_calls_source_key
        ON llm_audit_calls(source_key)
        WHERE source_key IS NOT NULL;
      PRAGMA user_version = 2;
    `);
  }

  private nextCallIndex(taskId: string): number {
    const row = this.db
      .prepare(
        `SELECT COALESCE(MAX(call_index), 0) + 1 AS nextIndex FROM llm_audit_calls WHERE task_id = @taskId`,
      )
      .get({ taskId }) as { nextIndex: number };
    return row.nextIndex;
  }

  private findPendingCall(
    taskId: string,
    event: LlmOutputEvent,
    ctx: PluginHookAgentContext,
  ): { id: number } | null {
    const row = this.db
      .prepare(
        `SELECT id
         FROM llm_audit_calls
         WHERE task_id = @taskId
           AND status = 'pending'
           AND (provider = @provider OR provider IS NULL)
           AND (model = @model OR model IS NULL)
           AND (session_id = @sessionId OR session_id IS NULL)
           AND (session_key = @sessionKey OR session_key IS NULL OR @sessionKey IS NULL)
         ORDER BY call_index ASC
         LIMIT 1`,
      )
      .get({
        taskId,
        provider: event.provider ?? null,
        model: event.model ?? null,
        sessionId: event.sessionId ?? ctx.sessionId ?? null,
        sessionKey: ctx.sessionKey ?? null,
      }) as { id: number } | undefined;
    return row ?? null;
  }
}

function taskIdFrom(eventRunId?: string, ctxRunId?: string): string {
  return (eventRunId || ctxRunId || "unknown").trim() || "unknown";
}

function toJson(value: unknown): string {
  return JSON.stringify(sanitizeAuditValue(value));
}

function fromJson(value: string | null): unknown {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function rowToCall(row: DbRow): LlmAuditCall {
  return {
    id: row.id,
    taskId: row.task_id,
    callIndex: row.call_index,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    agentId: row.agent_id,
    sessionKey: row.session_key,
    sessionId: row.session_id,
    workspaceDir: row.workspace_dir,
    provider: row.provider,
    model: row.model,
    systemPrompt: fromJson(row.system_prompt_json),
    prompt: fromJson(row.prompt_json),
    history: fromJson(row.history_json),
    imagesCount: row.images_count ?? 0,
    output: fromJson(row.output_json),
    assistantTexts: fromJson(row.assistant_texts_json),
    lastAssistant: fromJson(row.last_assistant_json),
    usage: fromJson(row.usage_json),
    error: fromJson(row.error_json),
    sourceKey: row.source_key,
  };
}

function getRecordObject(value: unknown, key: string): unknown {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)[key]
    : undefined;
}

function extractMessages(requestBody: unknown): unknown[] {
  const messages = getRecordObject(requestBody, "messages");
  return Array.isArray(messages) ? messages : [];
}

function firstMessageContent(messages: unknown[], role: string): unknown {
  const match = messages.find((message) => getRecordObject(message, "role") === role);
  return match ? getRecordObject(match, "content") ?? match : null;
}

function lastUserPrompt(messages: unknown[]): unknown {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (getRecordObject(message, "role") === "user") {
      return getRecordObject(message, "content") ?? message;
    }
  }
  return null;
}

function extractAssistantTexts(assistantMessage: unknown): string[] {
  const content = getRecordObject(assistantMessage, "content");
  if (typeof content === "string") return [content];
  if (!Array.isArray(content)) return [];
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      const text = getRecordObject(part, "text") ?? getRecordObject(part, "content");
      return typeof text === "string" ? text : "";
    })
    .filter(Boolean);
}
