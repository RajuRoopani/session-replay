#!/usr/bin/env bash
# Fires on Claude Code Stop event.
# Auto-generates a session replay HTML after every session.

set -euo pipefail

HOOK_INPUT=$(cat)
SESSION_ID=$(echo "$HOOK_INPUT" | jq -r '.session_id // "unknown"')
CWD=$(echo "$HOOK_INPUT"        | jq -r '.cwd        // ""')

# Delegate to CLI — pipe full hook input so CLI can extract transcript_path
echo "$HOOK_INPUT" \
  | npx --yes session-replay show --cwd "$CWD" \
  2>/tmp/session-replay-stop.log || true

# Always exit 0 — never block Claude from stopping
exit 0
