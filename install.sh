#!/usr/bin/env bash
# install.sh — Wire session-replay into any repo in one command.
# Usage: ./install.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
CLAUDE_DIR="$REPO_ROOT/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"

echo "Installing session-replay into $REPO_ROOT"

mkdir -p "$HOOKS_DIR"
cp "$SCRIPT_DIR/hooks/on-stop.sh" "$HOOKS_DIR/on-stop.sh"
chmod +x "$HOOKS_DIR/on-stop.sh"

SETTINGS_FILE="$CLAUDE_DIR/settings.json"
NEW_HOOK='{
  "Stop": [{"hooks": [{"type":"command","command":"${CLAUDE_PROJECT_DIR}/.claude/hooks/on-stop.sh","timeout":30,"async":true,"statusMessage":"Generating session replay..."}]}]
}'

if [[ -f "$SETTINGS_FILE" ]]; then
  MERGED=$(jq --argjson h "$NEW_HOOK" '.hooks = (.hooks // {}) * $h' "$SETTINGS_FILE")
  echo "$MERGED" > "$SETTINGS_FILE"
  echo "  Updated $SETTINGS_FILE"
else
  echo '{"hooks":'"$NEW_HOOK"'}' > "$SETTINGS_FILE"
  echo "  Created $SETTINGS_FILE"
fi

echo ""
echo "Done. Session replays will be saved to ~/.session-replays/ after each session."
echo "View manually: npx session-replay"
