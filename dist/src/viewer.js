/** OpenClaw audit viewer favicon (inline SVG data URL). */
const OPENCLAW_FAVICON_HREF = "data:image/svg+xml;charset=utf-8," +
    encodeURIComponent(`<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg"><rect width="72" height="72" rx="14" fill="#ff4500" opacity="0.12"/><rect width="72" height="72" rx="14" fill="none" stroke="#ff4500" stroke-width="1.5"/><text x="36" y="38" font-size="32" text-anchor="middle" dominant-baseline="middle">🦞</text><rect x="12" y="56" width="4" height="6" rx="2" fill="#ff4500" opacity="0.4"/><rect x="19" y="52" width="4" height="10" rx="2" fill="#ff4500" opacity="0.6"/><rect x="26" y="54" width="4" height="7" rx="2" fill="#ff4500" opacity="0.8"/><rect x="33" y="50" width="4" height="12" rx="2" fill="#ff4500"/><rect x="40" y="53" width="4" height="8" rx="2" fill="#ff4500" opacity="0.8"/><rect x="47" y="55" width="4" height="6" rx="2" fill="#ff4500" opacity="0.6"/><rect x="54" y="57" width="4" height="4" rx="2" fill="#ff4500" opacity="0.4"/></svg>`);
export function renderLlmAuditViewer(options = {}) {
    if (options.variant === "openclaw" || options.variant === "hermes") {
        return renderModernShellViewer(options);
    }
    return renderLegacyViewer(options);
}
function renderLegacyViewer(options) {
    const title = escapeTemplate(options.title ?? "Openclaw LLM Audit Viewer");
    const subtitle = escapeTemplate(options.subtitle ?? "Task ID is Openclaw runId");
    const taskPlaceholder = escapeTemplate(options.taskPlaceholder ?? "Task ID / runId");
    const autoLoadLatestTask = options.autoLoadLatestTask ?? false;
    return `<!doctype html>
<html lang="en" class="theme-system">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="${OPENCLAW_FAVICON_HREF}" type="image/svg+xml" />
  <title>${title}</title>
  <style>
    html.theme-dark {
      color-scheme: dark;
      --bg: #0b1020; --panel: #121a2f; --muted: #8fa0c0; --text: #edf2ff; --line: #263453; --accent: #7aa2ff; --ok: #4ade80; --warn: #facc15;
      --input-bg: #0f1730; --btn-bg: #1c2a52;
    }
    html.theme-light {
      color-scheme: light;
      --bg: #f6f8fa; --panel: #ffffff; --muted: #59636e; --text: #1f2328; --line: #d0d7de; --accent: #0969da; --ok: #1a7f37; --warn: #9a6700;
      --input-bg: #f6f8fa; --btn-bg: #f6f8fa;
    }
    html.theme-system {
      color-scheme: light dark;
      --bg: #0b1020; --panel: #121a2f; --muted: #8fa0c0; --text: #edf2ff; --line: #263453; --accent: #7aa2ff; --ok: #4ade80; --warn: #facc15;
      --input-bg: #0f1730; --btn-bg: #1c2a52;
    }
    @media (prefers-color-scheme: light) {
      html.theme-system {
        --bg: #f6f8fa; --panel: #ffffff; --muted: #59636e; --text: #1f2328; --line: #d0d7de; --accent: #0969da; --ok: #1a7f37; --warn: #9a6700;
        --input-bg: #f6f8fa; --btn-bg: #f6f8fa;
      }
    }
    * { box-sizing: border-box; }
    body { margin: 0; font: 14px/1.45 ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }
    header { padding: 18px 24px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; }
    .legacy-header-left { flex: 1 1 auto; min-width: 0; }
    .legacy-header-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
    .theme-bar { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
    .theme-bar .theme-btn {
      width: auto; min-width: 52px; padding: 6px 10px; font-size: 12px; font-weight: 600;
      border: 1px solid var(--line); border-radius: 8px; background: var(--btn-bg); color: var(--text); cursor: pointer;
    }
    .theme-bar .theme-btn:hover { border-color: var(--accent); }
    .theme-bar .theme-btn.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
    h1 { margin: 0; font-size: 20px; }
    h3 { margin: 14px 0 10px; }
    .subtle { color: var(--muted); }
    .layout { display: grid; grid-template-columns: 360px minmax(0, 1fr); min-height: calc(100vh - 73px); }
    aside { border-right: 1px solid var(--line); padding: 16px; overflow: auto; }
    main { padding: 16px; overflow: auto; }
    input, select, button { border: 1px solid var(--line); border-radius: 8px; background: var(--input-bg); color: var(--text); padding: 9px 10px; }
    button { cursor: pointer; background: var(--btn-bg); }
    button:hover { border-color: var(--accent); }
    .row { display: flex; gap: 8px; margin-bottom: 10px; }
    .row input { min-width: 0; flex: 1; }
    .task, .call { border: 1px solid var(--line); border-radius: 12px; padding: 12px; margin-bottom: 10px; background: var(--panel); cursor: pointer; }
    .task:hover, .call:hover, .selected { border-color: var(--accent); }
    .task-title, .call-title { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace; }
    .pill { border-radius: 999px; padding: 2px 8px; font-size: 12px; border: 1px solid var(--line); color: var(--muted); white-space: nowrap; }
    .success { color: var(--ok); }
    .pending { color: var(--warn); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 14px; }
    .card { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; }
    .card h3 { margin: 0 0 8px; font-size: 14px; color: var(--muted); }
    details { background: var(--panel); border: 1px solid var(--line); border-radius: 12px; margin-bottom: 10px; }
    summary { cursor: pointer; padding: 12px; color: var(--accent); }
    pre { margin: 0; padding: 0 12px 12px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
    .empty { padding: 32px; text-align: center; color: var(--muted); }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } aside { border-right: 0; border-bottom: 1px solid var(--line); } }
  </style>
</head>
<body>
  <header>
    <div class="legacy-header-left">
      <h1>${title}</h1>
      <div class="subtle">${subtitle}</div>
    </div>
    <div class="legacy-header-right">
      <div class="theme-bar" role="toolbar" aria-label="Color theme">
        <button type="button" class="theme-btn" data-theme="light" title="浅色">浅色</button>
        <button type="button" class="theme-btn" data-theme="dark" title="深色">深色</button>
        <button type="button" class="theme-btn" data-theme="system" title="跟随系统">系统</button>
      </div>
      <div id="health" class="subtle">Loading...</div>
    </div>
  </header>
  <div class="layout">
    <aside>
      <div class="row">
        <input id="taskInput" placeholder="${taskPlaceholder}" />
        <button id="loadTask">Load</button>
      </div>
      <div class="row">
        <input id="searchInput" placeholder="Search loaded calls" />
      </div>
      <div class="row">
        <select id="statusFilter">
          <option value="">All statuses</option>
          <option value="success">success</option>
          <option value="pending">pending</option>
        </select>
        <select id="modelFilter"><option value="">All models</option></select>
      </div>
      <h3>Recent Tasks</h3>
      <div id="tasks"></div>
    </aside>
    <main>
      <div id="summary" class="empty">Select a recent task or enter a Task ID.</div>
      <div id="calls"></div>
      <div id="detail"></div>
    </main>
  </div>
  <script>
    const THEME_KEY = "llm-audit-viewer-theme";
    function getStoredTheme() {
      const v = localStorage.getItem(THEME_KEY);
      if (v === "light" || v === "dark" || v === "system") return v;
      return "system";
    }
    function applyTheme(mode) {
      const root = document.documentElement;
      root.classList.remove("theme-light", "theme-dark", "theme-system");
      root.classList.add("theme-" + mode);
      localStorage.setItem(THEME_KEY, mode);
      document.querySelectorAll(".theme-bar .theme-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.theme === mode);
      });
    }
    function initTheme() {
      applyTheme(getStoredTheme());
      document.querySelectorAll(".theme-bar .theme-btn").forEach((btn) => {
        btn.addEventListener("click", () => applyTheme(btn.dataset.theme || "system"));
      });
    }
    const state = { tasks: [], calls: [], selected: null, taskId: "" };
    const $ = (id) => document.getElementById(id);
    const fmt = (v) => v ? new Date(v).toLocaleString() : "-";
    const json = (v) => JSON.stringify(v ?? null, null, 2);

    async function api(path) {
      const res = await fetch(path, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    }

    function matchesSearch(call) {
      const q = $("searchInput").value.trim().toLowerCase();
      const status = $("statusFilter").value;
      const model = $("modelFilter").value;
      if (status && call.status !== status) return false;
      if (model && call.model !== model) return false;
      if (!q) return true;
      return json(call).toLowerCase().includes(q);
    }

    function renderTasks() {
      $("tasks").innerHTML = state.tasks.map((task) => '<div class="task" data-task="' + encodeURIComponent(task.taskId) + '"><div class="task-title"><strong class="mono">' + escapeHtml(task.taskId) + '</strong><span class="pill">' + task.calls + ' calls</span></div><div class="subtle">' + escapeHtml((task.models || []).join(", ") || task.provider || "-") + '</div><div class="subtle">' + fmt(task.lastSeenAt) + '</div></div>').join("") || '<div class="empty">No audit tasks yet.</div>';
      document.querySelectorAll(".task").forEach((el) => el.addEventListener("click", () => loadTask(decodeURIComponent(el.dataset.task))));
    }

    function renderCalls() {
      const models = [...new Set(state.calls.map((c) => c.model).filter(Boolean))];
      $("modelFilter").innerHTML = '<option value="">All models</option>' + models.map((m) => '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>').join("");
      const filtered = state.calls.filter(matchesSearch);
      $("summary").className = "card";
      $("summary").innerHTML = '<h3>Task ID</h3><div class="mono">' + escapeHtml(state.taskId || "-") + '</div><div class="subtle">' + filtered.length + ' of ' + state.calls.length + ' calls shown</div>';
      $("calls").innerHTML = filtered.map((call) => '<div class="call" data-id="' + call.id + '"><div class="call-title"><strong>Call #' + call.callIndex + '</strong><span class="pill ' + call.status + '">' + call.status + '</span></div><div class="subtle">' + escapeHtml([call.provider, call.model].filter(Boolean).join(" / ") || "-") + '</div><div class="subtle">' + fmt(call.updatedAt) + '</div></div>').join("") || '<div class="empty">No calls match the current filters.</div>';
      document.querySelectorAll(".call").forEach((el) => el.addEventListener("click", () => selectCall(Number(el.dataset.id))));
      if (!state.selected && filtered[0]) selectCall(filtered[0].id);
    }

    function selectCall(id) {
      state.selected = state.calls.find((c) => c.id === id) || null;
      document.querySelectorAll(".call").forEach((el) => el.classList.toggle("selected", Number(el.dataset.id) === id));
      renderDetail();
    }

    function renderDetail() {
      const call = state.selected;
      if (!call) { $("detail").innerHTML = ""; return; }
      $("detail").innerHTML =
        '<div class="grid">' +
        meta("Task ID", call.taskId) + meta("Call", "#" + call.callIndex) + meta("Status", call.status) + meta("Model", [call.provider, call.model].filter(Boolean).join(" / ")) + meta("Session", call.sessionKey || call.sessionId || "-") + meta("Workspace", call.workspaceDir || "-") +
        '</div>' +
        details("Request Prompt", call.prompt, true) +
        details("System Prompt", call.systemPrompt, false) +
        details("History", call.history, false) +
        details("Assistant texts", call.assistantTexts, false) +
        details("Last Assistant", call.lastAssistant, false) +
        details("Usage", call.usage, false) +
        details("Raw Output", call.output, false) +
        details("Error", call.error, false);
    }

    function meta(k, v) { return '<div class="card"><h3>' + escapeHtml(k) + '</h3><div class="mono">' + escapeHtml(String(v || "-")) + '</div></div>'; }
    function details(title, value, open) { return '<details ' + (open ? "open" : "") + '><summary>' + escapeHtml(title) + '</summary><pre class="mono">' + escapeHtml(typeof value === "string" ? value : json(value)) + '</pre></details>'; }

    async function loadTask(taskId) {
      taskId = (taskId || $("taskInput").value || "").trim();
      if (!taskId) return;
      $("taskInput").value = taskId;
      state.taskId = taskId;
      state.selected = null;
      const payload = await api("/api/tasks/" + encodeURIComponent(taskId) + "/calls");
      state.calls = payload.calls || [];
      renderCalls();
    }

    async function boot() {
      try {
        const health = await api("/api/health");
        $("health").textContent = health.ok ? "Live on :8764" : "Unavailable";
        const tasks = await api("/api/tasks?limit=50");
        state.tasks = tasks.tasks || [];
        renderTasks();
        if (${JSON.stringify(autoLoadLatestTask)} && state.tasks[0]) {
          await loadTask(state.tasks[0].taskId);
        }
      } catch (err) {
        $("health").textContent = "Error";
        $("tasks").innerHTML = '<div class="empty">' + escapeHtml(String(err)) + '</div>';
      }
    }

    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));
    }

    $("loadTask").addEventListener("click", () => loadTask());
    $("taskInput").addEventListener("keydown", (e) => { if (e.key === "Enter") loadTask(); });
    $("searchInput").addEventListener("input", renderCalls);
    $("statusFilter").addEventListener("change", renderCalls);
    $("modelFilter").addEventListener("change", renderCalls);
    initTheme();
    boot();
  </script>
</body>
</html>`;
}
function renderModernShellViewer(options) {
    const variant = options.variant === "hermes" ? "hermes" : "openclaw";
    const title = escapeTemplate(options.title ??
        (variant === "hermes" ? "Hermes LLM Audit Monitor" : "Openclaw LLM Audit Viewer"));
    const taskPlaceholder = escapeTemplate(options.taskPlaceholder ?? (variant === "hermes" ? "Hermes task_id" : "Task ID / runId"));
    const htmlClass = variant === "hermes" ? "audit-shell audit-shell--hermes" : "audit-shell audit-shell--openclaw";
    const hint = "";
    const loadingMsg = variant === "hermes" ? "Loading recent Hermes tasks..." : "Loading recent OpenClaw tasks...";
    const script = buildModernShellScript(variant, options.autoLoadLatestTask ?? false);
    const hermesOnlyCss = variant === "hermes"
        ? `
    .audit-shell--hermes h1 {
      color: #ff3eb5;
      text-shadow: 0 0 14px rgba(255, 62, 181, 0.45);
    }
    .audit-shell--hermes button:hover { border-color: var(--accent); }
    `
        : "";
    const faviconLink = variant === "hermes"
        ? `<link rel="icon" href="/hermes-favicon.png" type="image/png">`
        : `<link rel="icon" href="${OPENCLAW_FAVICON_HREF}" type="image/svg+xml">`;
    return `<!doctype html>
<html lang="en" class="${htmlClass} theme-system">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${faviconLink}
  <title>${title}</title>
  <style>
    html.audit-shell.theme-dark {
      color-scheme: dark;
      --bg: #0f1115;
      --panel: #171a21;
      --panel-2: #20242d;
      --fg: #e8edf3;
      --muted: #9aa4b2;
      --border: #303642;
      --accent: #7aa2f7;
      --danger: #ff7b72;
      --ok: #8bd5a0;
      --warn: #facc15;
    }
    html.audit-shell.theme-light {
      color-scheme: light;
      --bg: #f6f8fa;
      --panel: #ffffff;
      --panel-2: #f0f3f6;
      --fg: #1f2328;
      --muted: #59636e;
      --border: #d0d7de;
      --accent: #0969da;
      --danger: #cf222e;
      --ok: #1a7f37;
      --warn: #9a6700;
    }
    html.audit-shell.theme-system {
      color-scheme: light dark;
      --bg: #0f1115;
      --panel: #171a21;
      --panel-2: #20242d;
      --fg: #e8edf3;
      --muted: #9aa4b2;
      --border: #303642;
      --accent: #7aa2f7;
      --danger: #ff7b72;
      --ok: #8bd5a0;
      --warn: #facc15;
    }
    @media (prefers-color-scheme: light) {
      html.audit-shell.theme-system {
        --bg: #f6f8fa;
        --panel: #ffffff;
        --panel-2: #f0f3f6;
        --fg: #1f2328;
        --muted: #59636e;
        --border: #d0d7de;
        --accent: #0969da;
        --danger: #cf222e;
        --ok: #1a7f37;
        --warn: #9a6700;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font: 14px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--bg);
      color: var(--fg);
    }
    header {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 8px;
      padding: 8px 12px 10px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
      position: sticky;
      top: 0;
      z-index: 2;
    }
    .header-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      width: 100%;
    }
    .header-top h1 { margin: 0; }
    .theme-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }
    .theme-bar .theme-btn {
      width: auto;
      min-width: 48px;
      padding: 5px 10px;
      font-size: 11px;
      font-weight: 600;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-2);
      color: var(--fg);
      cursor: pointer;
    }
    .theme-bar .theme-btn:hover { border-color: var(--accent); }
    .theme-bar .theme-btn.active {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px var(--accent);
    }
    .header-row {
      display: flex;
      gap: 12px;
      align-items: center;
      width: 100%;
    }
    h1 {
      flex: 0 0 auto;
      font-size: 16px;
      font-weight: 800;
      white-space: nowrap;
      letter-spacing: 0.01em;
    }
    .audit-shell--openclaw h1 {
      color: #2aa7c8;
      text-shadow: 0 0 14px rgba(42, 167, 200, 0.38);
    }
    ${hermesOnlyCss}
    .controls {
      flex: 1 1 auto;
      min-width: 0;
      display: grid;
      grid-template-columns: minmax(220px, 1fr) 82px minmax(180px, 1fr) repeat(2, minmax(110px, 0.7fr));
      gap: 8px;
      align-items: center;
    }
    .controls input, .controls select, .controls > button {
      width: 100%;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-2);
      color: var(--fg);
      font-size: 12px;
    }
    #taskList button.summary,
    #callList button.summary {
      width: 100%;
      min-width: 0;
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--panel-2);
      color: var(--fg);
      font-size: 12px;
    }
    button { cursor: pointer; font-weight: 600; }
    .audit-shell--openclaw .controls button:hover { border-color: #2aa7c8; }
    main {
      display: grid;
      grid-template-columns: minmax(200px, 240px) minmax(260px, 340px) minmax(0, 1fr);
      gap: 10px;
      padding: 12px;
      height: calc(100vh - 100px);
    }
    .col {
      min-height: 0;
      overflow: auto;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--panel);
    }
    .col-head {
      padding: 8px 10px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      border-bottom: 1px solid var(--border);
      background: var(--panel-2);
    }
    .summary {
      display: grid;
      gap: 4px;
      width: 100%;
      padding: 12px;
      border: 0;
      border-bottom: 1px solid var(--border);
      background: transparent;
      color: var(--fg);
      text-align: left;
      cursor: pointer;
    }
    .summary:hover, .summary.active { background: var(--panel-2); }
    .summary-title {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-weight: 600;
    }
    .meta { color: var(--muted); font-size: 12px; overflow-wrap: anywhere; }
    .pill {
      border: 1px solid var(--border);
      border-radius: 999px;
      padding: 1px 7px;
      color: var(--muted);
      white-space: nowrap;
      font-size: 12px;
    }
    .pill.success { color: var(--ok); border-color: rgba(139, 213, 160, 0.35); }
    .pill.pending { color: var(--warn); border-color: rgba(250, 204, 21, 0.35); }
    .subagent-tag {
      display: inline-block;
      margin-left: 6px;
      padding: 0 4px;
      font-size: 11px;
      font-weight: 400;
      color: var(--muted);
      letter-spacing: 0.02em;
    }
    .detail-body { padding: 16px; }
    .empty { color: var(--muted); padding: 24px; }
    section {
      margin-bottom: 16px;
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    section h2 {
      margin: 0;
      padding: 10px 12px;
      font-size: 14px;
      background: var(--panel-2);
      border-bottom: 1px solid var(--border);
    }
    pre {
      margin: 0;
      padding: 12px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .json-tree {
      padding: 12px;
      overflow: auto;
      font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }
    .json-node { margin-left: 16px; }
    .json-node details { margin: 2px 0; }
    .json-node summary {
      cursor: pointer;
      user-select: none;
      list-style-position: outside;
      white-space: nowrap;
    }
    .json-key { color: var(--accent); font-weight: 600; }
    .json-meta { color: var(--muted); }
    .json-string { color: var(--ok); white-space: pre-wrap; word-break: break-word; }
    .json-primitive { color: var(--fg); }
    .error { color: var(--danger); }
    @media (max-width: 1100px) {
      .header-row { display: block; }
      .header-top { flex-wrap: wrap; }
      h1 { margin-bottom: 0; }
      .controls { grid-template-columns: 1fr; }
      main { grid-template-columns: 1fr; height: auto; }
      .col { max-height: 420px; }
    }
  </style>
</head>
<body>
  <header>
    <div class="header-top">
      <h1>${title}</h1>
      <div class="theme-bar" role="toolbar" aria-label="配色">
        <button type="button" class="theme-btn" data-theme="light" title="浅色">浅色</button>
        <button type="button" class="theme-btn" data-theme="dark" title="深色">深色</button>
        <button type="button" class="theme-btn" data-theme="system" title="跟随系统">系统</button>
      </div>
    </div>
    <div class="header-row">
      <div class="controls">
        <input id="taskInput" type="text" placeholder="${taskPlaceholder}">
        <button id="loadTask" type="button">Load ID</button>
        <input id="searchInput" type="search" placeholder="Search prompt, output, task...">
        <select id="statusFilter">
          <option value="">All statuses</option>
          <option value="success">success</option>
          <option value="pending">pending</option>
        </select>
        <select id="modelFilter"><option value="">All models</option></select>
      </div>
    </div>
    ${hint}
  </header>
  <main>
    <div class="col" id="taskCol">
      <div class="col-head">Tasks</div>
      <div id="taskList"><div class="empty">${escapeTemplate(loadingMsg)}</div></div>
    </div>
    <div class="col" id="callCol">
      <div class="col-head">Calls</div>
      <div id="callList"><div class="empty">Select a task to list calls.</div></div>
    </div>
    <div class="col" id="detailCol">
      <div class="col-head">Detail</div>
      <div id="detail" class="detail-body"><div class="empty">Select a call to inspect payload.</div></div>
    </div>
  </main>
  <script>
${script}
  </script>
</body>
</html>`;
}
function buildModernShellScript(brand, autoLoadLatestTask) {
    const L = [];
    L.push(`const BRAND = ${JSON.stringify(brand)};`);
    L.push(`const AUTO_LOAD = ${JSON.stringify(autoLoadLatestTask)};`);
    L.push(`const state = { tasks: [], calls: [], filtered: [], selected: null, taskId: "" };`);
    L.push(`const $ = (id) => document.getElementById(id);`);
    L.push(`const fmt = (v) => (v ? new Date(v).toLocaleString() : "-");`);
    L.push(`const json = (v) => JSON.stringify(v ?? null, null, 2);`);
    L.push(`const THEME_KEY = "llm-audit-viewer-theme";`);
    L.push(`function getStoredTheme() {`);
    L.push(`  const v = localStorage.getItem(THEME_KEY);`);
    L.push(`  if (v === "light" || v === "dark" || v === "system") return v;`);
    L.push(`  return "system";`);
    L.push(`}`);
    L.push(`function applyTheme(mode) {`);
    L.push(`  const root = document.documentElement;`);
    L.push(`  root.classList.remove("theme-light", "theme-dark", "theme-system");`);
    L.push(`  root.classList.add("theme-" + mode);`);
    L.push(`  localStorage.setItem(THEME_KEY, mode);`);
    L.push(`  document.querySelectorAll(".theme-bar .theme-btn").forEach((btn) => {`);
    L.push(`    btn.classList.toggle("active", btn.dataset.theme === mode);`);
    L.push(`  });`);
    L.push(`}`);
    L.push(`function initTheme() {`);
    L.push(`  applyTheme(getStoredTheme());`);
    L.push(`  document.querySelectorAll(".theme-bar .theme-btn").forEach((btn) => {`);
    L.push(`    btn.addEventListener("click", () => applyTheme(btn.dataset.theme || "system"));`);
    L.push(`  });`);
    L.push(`}`);
    L.push(`async function api(path) {`);
    L.push(`  const res = await fetch(path, { headers: { accept: "application/json" } });`);
    L.push(`  if (!res.ok) throw new Error(await res.text());`);
    L.push(`  return res.json();`);
    L.push(`}`);
    L.push(`function matchesSearch(call) {`);
    L.push(`  const q = $("searchInput").value.trim().toLowerCase();`);
    L.push(`  const status = $("statusFilter").value;`);
    L.push(`  const model = $("modelFilter").value;`);
    L.push(`  if (status && call.status !== status) return false;`);
    L.push(`  if (model && call.model !== model) return false;`);
    L.push(`  if (!q) return true;`);
    L.push(`  return json(call).toLowerCase().includes(q);`);
    L.push(`}`);
    L.push(`function callListTitle(call) {`);
    L.push(`  const model = call.model || "(model unknown)";`);
    L.push(`  if (BRAND !== "hermes") return "API #" + call.callIndex + " · " + model;`);
    L.push(`  const out = call.output && typeof call.output === "object" ? call.output : {};`);
    L.push(`  const turn = out.turnIndex !== undefined && out.turnIndex !== null && out.turnIndex !== "" ? out.turnIndex : "?";`);
    L.push(`  const c = out.apiCallCount !== undefined && out.apiCallCount !== null && out.apiCallCount !== "" ? out.apiCallCount : "?";`);
    L.push(`  return "T" + turn + " C" + c + " · " + model + " · #" + call.callIndex;`);
    L.push(`}`);
    L.push(`function isSubagentTask(task) {`);
    L.push(`  // A task is "subagent" if either its task_id or its session_key`);
    L.push(`  // contains the OpenClaw subagent path component "subagent:<id>".`);
    L.push(`  // task_id example: announce:v1:agent:main:subagent:<sub>:<run>`);
    L.push(`  // session_key example: agent:main:subagent:<sub>`);
    L.push(`  const re = /(^|:)subagent:/i;`);
    L.push(`  if (task && typeof task.taskId === "string" && re.test(task.taskId)) return true;`);
    L.push(`  if (task && typeof task.sessionKey === "string" && re.test(task.sessionKey)) return true;`);
    L.push(`  return false;`);
    L.push(`}`);
    L.push(`function renderTaskColumn() {`);
    L.push(`  if (!state.tasks.length) {`);
    L.push(`    $("taskList").innerHTML = '<div class="empty">No audit tasks yet.</div>';`);
    L.push(`    return;`);
    L.push(`  }`);
    L.push(`  $("taskList").innerHTML = state.tasks.map((task) => {`);
    L.push(`    const subTag = isSubagentTask(task) ? '<span class="subagent-tag">subagent</span>' : '';`);
    L.push(`    return '<button type="button" class="summary' + (state.taskId === task.taskId ? ' active' : '') + '" data-task="' + encodeURIComponent(task.taskId) + '">' +`);
    L.push(`      '<span class="summary-title"><span>' + escapeHtml(task.taskId) + subTag + '</span><span class="pill">' + task.calls + '</span></span>' +`);
    L.push(`      '<span class="meta">' + escapeHtml((task.models || []).join(", ") || task.provider || "-") + '</span>' +`);
    L.push(`      '<span class="meta">' + fmt(task.lastSeenAt) + '</span>' +`);
    L.push(`    '</button>';`);
    L.push(`  }).join("");`);
    L.push(`  document.querySelectorAll("#taskList .summary").forEach((el) => el.addEventListener("click", () => loadTask(decodeURIComponent(el.dataset.task || ""))));`);
    L.push(`}`);
    L.push(`function renderCalls() {`);
    L.push(`  const models = [...new Set(state.calls.map((c) => c.model).filter(Boolean))];`);
    L.push(`  $("modelFilter").innerHTML = '<option value="">All models</option>' + models.map((m) => '<option value="' + escapeHtml(m) + '">' + escapeHtml(m) + '</option>').join("");`);
    L.push(`  state.filtered = state.calls.filter(matchesSearch);`);
    L.push(`  if (!state.filtered.length) {`);
    L.push(`    $("callList").innerHTML = '<div class="empty">No calls match filters (or task has no calls).</div>';`);
    L.push(`    $("detail").innerHTML = '<div class="empty">No call selected.</div>';`);
    L.push(`    return;`);
    L.push(`  }`);
    L.push(`  $("callList").innerHTML = state.filtered.map((call) => (`);
    L.push(`    '<button type="button" class="summary" data-id="' + call.id + '">' +`);
    L.push(`      '<span class="summary-title"><span>' + escapeHtml(callListTitle(call)) + '</span><span class="pill ' + call.status + '">' + call.status + '</span></span>' +`);
    L.push(`      '<span class="meta">' + escapeHtml([call.provider, call.model].filter(Boolean).join(" / ") || "-") + '</span>' +`);
    L.push(`      '<span class="meta">' + fmt(call.updatedAt) + '</span>' +`);
    L.push(`    '</button>'`);
    L.push(`  )).join("");`);
    L.push(`  document.querySelectorAll("#callList .summary").forEach((el) => el.addEventListener("click", () => selectCall(Number(el.dataset.id))));`);
    L.push(`  const keep = state.selected && state.filtered.some((c) => c.id === state.selected.id);`);
    L.push(`  selectCall(keep ? state.selected.id : state.filtered[0].id);`);
    L.push(`}`);
    L.push(`async function loadTask(taskId) {`);
    L.push(`  taskId = (taskId || $("taskInput").value || "").trim();`);
    L.push(`  if (!taskId) return;`);
    L.push(`  $("taskInput").value = taskId;`);
    L.push(`  state.taskId = taskId;`);
    L.push(`  state.selected = null;`);
    L.push(`  state.calls = [];`);
    L.push(`  renderTaskColumn();`);
    L.push(`  $("callList").innerHTML = '<div class="empty">Loading…</div>';`);
    L.push(`  $("detail").innerHTML = '<div class="empty">Select a call.</div>';`);
    L.push(`  try {`);
    L.push(`    const payload = await api("/api/tasks/" + encodeURIComponent(taskId) + "/calls");`);
    L.push(`    state.calls = payload.calls || [];`);
    L.push(`    renderCalls();`);
    L.push(`  } catch (err) {`);
    L.push(`    $("callList").innerHTML = '<div class="empty">' + escapeHtml(String(err)) + "</div>";`);
    L.push(`    $("detail").innerHTML = '<div class="empty">Request failed.</div>';`);
    L.push(`  }`);
    L.push(`}`);
    L.push(`function selectCall(id) {`);
    L.push(`  state.selected = state.calls.find((call) => call.id === id) || null;`);
    L.push(`  document.querySelectorAll("#callList .summary").forEach((el) => el.classList.toggle("active", Number(el.dataset.id) === id));`);
    L.push(`  renderDetail();`);
    L.push(`}`);
    L.push(`function escapeHtml(value) {`);
    L.push(`  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch]));`);
    L.push(`}`);
    L.push(`function isTreeValue(value) { return value !== null && typeof value === "object"; }`);
    L.push(`function formatScalar(value) {`);
    L.push(`  if (value === undefined) return "";`);
    L.push(`  if (typeof value === "number" || typeof value === "boolean") return String(value);`);
    L.push(`  return JSON.stringify(value);`);
    L.push(`}`);
    L.push(`function formatBlock(value) {`);
    L.push(`  if (value === undefined || value === null) return "";`);
    L.push(`  if (typeof value === "string") return value;`);
    L.push(`  return JSON.stringify(value, null, 2);`);
    L.push(`}`);
    L.push(`function renderLeaf(value, key) {`);
    L.push(`  const label = key ? '<span class="json-key">' + escapeHtml(key) + "</span>: " : "";`);
    L.push(`  if (typeof value === "string") return label + '<span class="json-string">"' + escapeHtml(value) + '"</span>';`);
    L.push(`  return label + '<span class="json-primitive">' + escapeHtml(formatScalar(value)) + "</span>";`);
    L.push(`}`);
    L.push(`function renderJsonTree(value, key, depth) {`);
    L.push(`  key = key === undefined ? "" : key;`);
    L.push(`  depth = depth || 0;`);
    L.push(`  if (Array.isArray(value)) return renderArrayNode(value, key, depth);`);
    L.push(`  if (isTreeValue(value)) return renderObjectNode(value, key, depth);`);
    L.push(`  return renderLeaf(value, key);`);
    L.push(`}`);
    L.push(`function renderArrayNode(value, key, depth) {`);
    L.push(`  const label = key ? '<span class="json-key">' + escapeHtml(key) + "</span>: " : "";`);
    L.push(`  const preview = '<span class="json-meta">Array(' + value.length + ")</span>";`);
    L.push(`  const children = value.map((item, idx) => '<div class="json-node">' + renderJsonTree(item, String(idx), depth + 1) + "</div>").join("");`);
    L.push(`  return "<details open><summary>" + label + preview + "</summary>" + children + "</details>";`);
    L.push(`}`);
    L.push(`function renderObjectNode(value, key, depth) {`);
    L.push(`  const entries = Object.entries(value);`);
    L.push(`  const label = key ? '<span class="json-key">' + escapeHtml(key) + "</span>: " : "";`);
    L.push(`  const preview = '<span class="json-meta">Object(' + entries.length + ")</span>";`);
    L.push(`  const children = entries.map(([childKey, childValue]) => '<div class="json-node">' + renderJsonTree(childValue, childKey, depth + 1) + "</div>").join("");`);
    L.push(`  return "<details open><summary>" + label + preview + "</summary>" + children + "</details>";`);
    L.push(`}`);
    L.push(`function block(title, value, cls) {`);
    L.push(`  cls = cls || "";`);
    L.push(`  if (value === undefined || value === null || (typeof value === "string" && !value.trim() && title !== "Error")) return "";`);
    L.push(`  const body = isTreeValue(value)`);
    L.push(`    ? '<div class="json-tree ' + cls + '">' + renderJsonTree(value, "", 0) + "</div>"`);
    L.push(`    : '<pre class="' + cls + '">' + escapeHtml(formatBlock(value)) + "</pre>";`);
    L.push(`  return "<section><h2>" + escapeHtml(title) + "</h2>" + body + "</section>";`);
    L.push(`}`);
    L.push(`function pick(obj, keys) {`);
    L.push(`  const out = {};`);
    L.push(`  for (const key of keys) {`);
    L.push(`    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") out[key] = obj[key];`);
    L.push(`  }`);
    L.push(`  return out;`);
    L.push(`}`);
    L.push(`function renderDetail() {`);
    L.push(`  const call = state.selected;`);
    L.push(`  if (!call) {`);
    L.push(`    $("detail").innerHTML = '<div class="empty">Select a call to inspect payload.</div>';`);
    L.push(`    return;`);
    L.push(`  }`);
    L.push(`  const metaKeys = ["taskId", "callIndex", "status", "provider", "model", "sessionId", "sessionKey", "workspaceDir", "agentId", "createdAt", "updatedAt", "sourceKey"];`);
    L.push(`  const parts = [];`);
    L.push(`  parts.push(block("Metadata", pick(call, metaKeys), ""));`);
    L.push(`  parts.push(block("Request Prompt", call.prompt, ""));`);
    L.push(`  parts.push(block("System Prompt", call.systemPrompt, ""));`);
    L.push(`  parts.push(block("History", call.history, ""));`);
    L.push(`  parts.push(block("Assistant texts", call.assistantTexts, ""));`);
    L.push(`  parts.push(block("Last Assistant", call.lastAssistant, ""));`);
    L.push(`  parts.push(block("Usage", call.usage, ""));`);
    L.push(`  parts.push(block("Raw Output", call.output, ""));`);
    L.push(`  if (call.error !== undefined && call.error !== null) parts.push(block("Error", call.error, "error"));`);
    L.push(`  $("detail").innerHTML = parts.filter(Boolean).join("");`);
    L.push(`}`);
    L.push(`async function boot() {`);
    L.push(`  try {`);
    L.push(`    const health = await api("/api/health");`);
    L.push(`    const tasks = await api("/api/tasks?limit=200");`);
    L.push(`    state.tasks = tasks.tasks || [];`);
    L.push(`    renderTaskColumn();`);
    L.push(`    if (AUTO_LOAD && state.tasks[0]) {`);
    L.push(`      try { await loadTask(state.tasks[0].taskId); } catch (e) {`);
    L.push(`        $("callList").innerHTML = '<div class="empty">' + escapeHtml(String(e)) + "</div>";`);
    L.push(`      }`);
    L.push(`    }`);
    L.push(`    document.title = health.name || document.title;`);
    L.push(`  } catch (err) {`);
    L.push(`    $("taskList").innerHTML = '<div class="empty">' + escapeHtml(String(err)) + "</div>";`);
    L.push(`  }`);
    L.push(`}`);
    L.push(`$("loadTask").addEventListener("click", () => loadTask());`);
    L.push(`$("taskInput").addEventListener("keydown", (e) => { if (e.key === "Enter") loadTask(); });`);
    L.push(`$("searchInput").addEventListener("input", () => { if (state.calls.length) renderCalls(); });`);
    L.push(`$("statusFilter").addEventListener("change", () => { if (state.calls.length) renderCalls(); });`);
    L.push(`$("modelFilter").addEventListener("change", () => { if (state.calls.length) renderCalls(); });`);
    L.push(`initTheme();`);
    L.push(`boot();`);
    return L.join("\n");
}
function escapeTemplate(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
//# sourceMappingURL=viewer.js.map