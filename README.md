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

## The "Fork from here" feature

Every step in the timeline has a **Fork from here** button. Click it and you get a `.md` file with the full context up to that point — ready to paste as a new Claude Code session prompt.

```markdown
# Session Fork — auth-service from step 6

## What happened before this point (steps 1–6)

**Files changed:**
- src/auth/AuthService.ts
- src/auth/types.ts

**Last 3 commands run:**
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
| File edits (Edit/Write) | Filename, before/after (collapsible) |
| Bash commands | Command + stdout + stderr |
| Read/Glob/Grep | Query and result count |
| WebFetch/Task | URL or subagent description |
| Failed steps | Red highlight, error details |

---

## How it works

```
Claude Code session ends
  → Stop hook fires
  → session-replay reads ~/.claude/projects/{project}/{session-id}.jsonl
  → Parses JSONL into linked timeline events (tool calls paired with results)
  → Detects failures (stderr, interrupted, non-zero exit)
  → Detects branch points (user intervened mid-session)
  → Renders self-contained HTML
  → Saves to ~/.session-replays/ and opens in browser
```

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
├── .claude/
│   └── settings.json    # hook wiring
└── install.sh           # one-command install
```

**Zero dependencies.** Pure Node.js ≥ 18. No build step. Works via `npx`.

---

## License

MIT
