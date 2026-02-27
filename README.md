# session-replay

> A flight data recorder for Claude Code sessions.

When an AI agent breaks something, you have no forensics. You just start over.

`session-replay` turns every Claude Code session into an interactive visual timeline — every file edited, every command run, every decision made. Find the exact step where things went wrong, then **fork from there** instead of starting over.

---

## Demo

```
Session Replay — auth-service — 2026-02-25
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1  user      Fix the refresh token bug
  2  thinking  (thinking)                              1s
  3  Bash      Run tests to see current state          0.8s
  4  Read      src/auth/AuthService.ts
  5  Edit      AuthService.ts
  6  Bash      Run tests again                 ❌      1.2s
  7  Edit      AuthService.ts
  8  Bash      Run tests again                         0.9s
  ─── ⑂  User intervened ───
  9  user      no wait, we need to use RS256 not HS256
 10  thinking  (thinking)
 11  Edit      AuthService.ts
 ...
47 steps  8 files  1 error  2m 14s
```

---

## Install

```bash
# In any repo
npx session-replay@latest install
# or
git clone https://github.com/RajuRoopani/session-replay
./session-replay/install.sh
```

After install, every Claude Code session auto-generates a replay. No manual steps.

---

## Usage

```bash
# View latest session (opens browser)
npx session-replay

# List all sessions
npx session-replay list

# View specific session
npx session-replay show <session-id>

# Terminal mode (no browser)
npx session-replay show --terminal

# Export as standalone HTML (share with team)
npx session-replay export <id> > replay.html

# Generate a fork prompt from step N
npx session-replay fork <id> <step>
```

---

## VS Code Extension

A VS Code extension is included in `vscode-extension/` that renders replays directly inside your editor.

**Features:**
- Status bar button — click to open the latest replay in a side panel
- `Cmd+Shift+R` / `Ctrl+Shift+R` keyboard shortcut
- **Auto-notification** — pops a toast whenever a new session finishes
- Session picker — command `Session Replay: Pick Session…` to browse all replays
- **Auto-refresh** — the panel live-reloads if the underlying HTML file changes
- Fork files are saved to `~/Downloads/` and opened directly in the editor

**Install from `.vsix`:**
```bash
code --install-extension vscode-extension/session-replay-vscode-0.1.0.vsix
```

**Build from source:**
```bash
cd vscode-extension
npm install -g @vscode/vsce
vsce package
code --install-extension session-replay-vscode-*.vsix
```

---

## The "Fork from here" feature

Every step in the timeline has a **Fork from here** button (keyboard: `f`). Click it and you get a `.md` file with the full context up to that point — ready to paste as a new Claude Code session prompt.

```markdown
# Session Fork — auth-service from step 6

## What happened before this point (steps 1–6)

**Files changed:**
- src/auth/AuthService.ts
- src/auth/types.ts

**Last commands run:**
  $ npm test
  $ npm test
  $ npm run build

**Last user message:**
> Fix the refresh token bug

## At step 6
The agent was executing: Bash: npm test

## Continue from here
Pick up this session from step 6. The files listed above have been modified.
```

---

## What gets recorded

Everything in a Claude Code session is already stored as a JSONL transcript at
`~/.claude/projects/{project}/{session-id}.jsonl`. `session-replay` reads and
visualizes it — no extra recording needed.

| Event | What's shown |
|---|---|
| User messages | Full text, branch point markers |
| Thinking blocks | Collapsible (Claude's reasoning) |
| File edits (Edit/Write) | Filename, language badge, before/after diff blocks |
| Bash commands | Styled terminal: prompt, stdout, stderr |
| Read/Glob/Grep | Query and result count |
| WebFetch/Task | URL or subagent description |
| Failed steps | Red highlight, error details, `failed` badge |

---

## How it works

```
Claude Code session ends
  → Stop hook fires (hooks/on-stop.sh)
  → session-replay reads ~/.claude/projects/{project}/{session-id}.jsonl
  → parse.mjs: two-pass JSONL → TimelineEvent[]
      Pass 1 — build tool_use_id → result map
      Pass 2 — emit chronological events (user / thinking / tool_call)
  → analyze.mjs: tag failures + branch points
  → render-html.mjs: build self-contained HTML via template.mjs
  → Saves to ~/.session-replays/{session-id}.html
  → Opens in browser (or VS Code panel)
```

---

## Viewer keyboard shortcuts

| Key | Action |
|---|---|
| `j` / `↓` | Next step |
| `k` / `↑` | Previous step |
| `Enter` | Expand / collapse step |
| `f` | Fork from current step |
| `/` | Focus search bar |
| `Esc` | Collapse all / clear search |

---

## Org-wide auto-capture

Deploy via MDM to `/Library/Application Support/ClaudeCode/managed-settings.json`:

```json
{
  "hooks": {
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "/usr/local/share/session-replay/on-stop.sh",
        "timeout": 30,
        "async": true
      }]
    }]
  }
}
```

Every engineer's sessions are captured automatically. Replays go to `~/.session-replays/` on each machine.

---

## Developer Guide

### Requirements

- Node.js ≥ 18 (no build step, pure ESM)
- `jq` (used by `hooks/on-stop.sh`)
- Zero runtime dependencies

### Project structure

```
session-replay/
├── src/
│   ├── cli.mjs          # Entry point — routes show/list/export/fork commands
│   ├── parse.mjs        # JSONL transcript → TimelineEvent[]
│   ├── analyze.mjs      # Failure detection + branch point tagging
│   ├── template.mjs     # Self-contained HTML/CSS/JS viewer (single function)
│   ├── render-html.mjs  # Calls template.mjs, writes ~/.session-replays/*.html
│   ├── render-term.mjs  # ANSI terminal renderer (--terminal flag)
│   └── store.mjs        # Session discovery in ~/.claude/projects/
├── hooks/
│   └── on-stop.sh       # Claude Code Stop hook — fires after every session
├── vscode-extension/
│   ├── extension.js     # VS Code extension (CommonJS, no build required)
│   ├── package.json     # Extension manifest
│   └── *.vsix           # Pre-built installable package
├── .claude/
│   └── settings.json    # Wires hooks/on-stop.sh as a Stop hook locally
└── install.sh           # One-command installer
```

### Data model

**`TimelineEvent`** — one entry per step in the timeline:

```js
{
  step:          number,        // 1-based sequential index
  type:          'user' | 'thinking' | 'tool_call',
  uuid:          string | null, // Claude message UUID
  timestamp:     string | null, // ISO 8601
  durationMs:    number | null, // wall time for this step
  tool: {
    name:        string,        // e.g. 'Bash', 'Edit', 'Read', 'Task'
    input:       object,        // raw tool input from transcript
    description: string | null,
  } | null,
  result: {
    stdout:      string,
    stderr:      string,
    interrupted: boolean,
    isError:     boolean,
  } | null,
  text:          string | null, // user message text
  thinking:      string | null, // Claude's thinking block text
  failed:        boolean,       // true if stderr / exit code / interrupted
  isBranchPoint: boolean,       // true if user intervened mid-session
  toolUseId:     string | null, // matches tool_use_id in JSONL
}
```

**`SessionMeta`** — attached to `DATA.meta` in the HTML:

```js
{
  sessionId:   string | null,
  cwd:         string | null,
  project:     string,         // derived from cwd basename
  branch:      string,         // from `git rev-parse --abbrev-ref HEAD`
  date:        string,         // formatted for display
  startTime:   number | null,  // epoch ms
  endTime:     number | null,
  durationMs:  number | null,
  filesEdited: string[],       // sorted list of Edit/Write paths
  totalSteps:  number,
  errorCount:  number,
}
```

**`Summary`** — attached to `DATA.summary` in the HTML:

```js
{
  totalSteps:   number,
  errorCount:   number,
  branchPoints: number,
  filesEdited:  string[],
  toolCounts:   { [toolName]: number },
  durationMs:   number | null,
}
```

### Module responsibilities

#### `parse.mjs`

Two-pass streaming JSONL parser.

- **Pass 1** — scans all `user`-type entries to build a `Map<tool_use_id, result>` (stdout, stderr, interrupted, timestamp).
- **Pass 2** — iterates `assistant` entries chronologically, emitting one `TimelineEvent` per `thinking` block and per `tool_use` block. User messages (non-tool-result) also emit events.
- Failure detection: a tool call is marked `failed` if it has non-empty, non-warning stderr or was interrupted.
- Duration: computed from `result.timestamp - call.timestamp`; fallback to next event timestamp.

#### `analyze.mjs`

Enriches events in-place after parsing.

- **Branch points**: any `user` event following at least one tool call is a branch point (user intervened mid-session).
- **Additional failure signals**: scans stdout+stderr for `/exit code [1-9]/`, `Error:`, `failed`, or `interrupted`.
- **`summarize(events, meta)`** — computes `Summary` stats used by the viewer's header and filter bar.

#### `template.mjs`

Single exported function `buildHtml(replayData)` — returns a fully self-contained HTML string.

The entire viewer (CSS + JS + data) is embedded inline. No external requests. The `DATA` constant is injected as:
```js
const DATA = <sanitized-json>;
```
JSON is sanitized to escape `</script>` and `<!--` sequences to prevent early script termination.

**Viewer features (all in-page JS):**
- Stats header (Steps / Errors / Branch pts / Files changed / Duration)
- Filter bar — filter by tool type or errors-only; live search across step descriptions
- Timeline — dot-on-rail layout with per-tool color coding
- Lazy body rendering — step details are rendered on first expand
- Bash steps: styled terminal with `$` prompt, stdout, stderr
- Edit/Write steps: file path, language badge, removed/added diff blocks
- Read/Glob/Grep steps: query input + results
- Expand All / Collapse All / Errors Only buttons
- Keyboard navigation: `j`/`k`, `Enter`, `f`, `/`, `Esc`
- Fork feature: generates a `.md` context file and triggers a browser download

#### `render-html.mjs`

- Calls `parseTranscript` + `analyze` + `summarize`
- Calls `buildHtml(replayData)` with `{ events, meta, summary }`
- Writes to `~/.session-replays/{sessionId}.html`
- Returns the file path

#### `store.mjs`

- `latestSession(cwd)` — finds the most recent session for a given project directory
- `findSession(id, cwd)` — looks up a session by partial ID
- `listAllSessions()` — scans all projects under `~/.claude/projects/`
- Sessions are resolved by matching `cwd` to the hashed project directory names Claude uses

#### `hooks/on-stop.sh`

Receives the Claude Code Stop hook payload via stdin (JSON with `session_id`, `cwd`, `transcript_path`). Delegates to `npx session-replay show --cwd $CWD`. Always exits 0 to avoid blocking Claude from stopping.

Logs errors to `/tmp/session-replay-stop.log`.

#### `vscode-extension/extension.js`

VS Code extension (CommonJS, no transpilation needed).

Key behaviors:
- **Status bar** — always-visible "Session Replay" button
- **Dir watcher** — watches `~/.session-replays/` for new `.html` files and shows a toast notification with an "Open" button
- **File watcher** — when a panel is open, watches that specific file and auto-reloads on change (400ms debounce)
- **HTML adaptation** — injects a CSP `<meta>` (required by VS Code's webview sandbox) and overrides `window.forkFrom` to use `postMessage` instead of a Blob download
- **Fork handling** — receives `{ command: 'fork', filename, content }` from the webview, writes to `~/Downloads/{filename}`, and opens it in the editor

### Adding a new tool type

1. Add an icon to `ICONS` in `template.mjs`
2. Add a CSS dot class `dot-<toolkey>` and accent class `acc-<toolkey>` in the `<style>` block
3. Add a tool badge class `tb-<toolkey>`
4. Add `safeKey` recognition if needed
5. Add a body renderer case in `renderBody(ev, el)` for rich expand content
6. Add a filter chip in `filterDefs` if useful

### Running locally

```bash
# Clone and link globally
git clone https://github.com/RajuRoopani/session-replay
cd session-replay
npm link

# Replay the latest session in any project
cd ~/my-project
session-replay

# Replay in terminal (no browser needed)
session-replay show --terminal

# Export to HTML
session-replay export > /tmp/replay.html
```

### Testing changes to the viewer

The viewer is entirely in `template.mjs`. The fastest iteration loop:

```bash
# Generate a fresh replay from any session
session-replay export <session-id> > /tmp/test.html

# Edit template.mjs, then re-generate
session-replay export <session-id> > /tmp/test.html && open /tmp/test.html
```

No build step required — edits to `template.mjs` take effect immediately on the next `export` or `show` run.

---

## Structure

```
session-replay/
├── src/
│   ├── cli.mjs          # entry point (show/list/export/fork)
│   ├── parse.mjs        # JSONL → linked timeline events
│   ├── analyze.mjs      # failure + branch point detection
│   ├── template.mjs     # self-contained HTML/CSS/JS viewer
│   ├── render-html.mjs  # generates HTML file
│   ├── render-term.mjs  # terminal ANSI renderer
│   └── store.mjs        # session discovery
├── hooks/
│   └── on-stop.sh       # Claude Code Stop hook
├── vscode-extension/    # VS Code extension
├── .claude/
│   └── settings.json    # hook wiring
└── install.sh           # one-command install
```

**Zero dependencies.** Pure Node.js ≥ 18. No build step. Works via `npx`.

---

## License

MIT
