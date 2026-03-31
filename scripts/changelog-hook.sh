#!/bin/bash
# changelog-hook.sh
# Called by the Claude Code PostToolUse hook after Write or Edit tool calls.
# Reads the tool result JSON from stdin and prints a reminder when src/ files are modified.

INPUT=$(cat)
FILE=$(echo "$INPUT" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(d.get('tool_input', {}).get('file_path', ''))
" 2>/dev/null)

# Only trigger on src/ files — skip changelog itself, releases/, scripts/, docs
if echo "$FILE" | grep -qE "/src/"; then
  echo ""
  echo "=== CHANGELOG REMINDER ==================================="
  echo "Modified: $FILE"
  echo ""
  echo "If this is part of a new feature or bug fix, before finishing:"
  echo "  1. Update CHANGELOG.md with a user-facing entry"
  echo "  2. Add releases/v{version}-{slug}.md with technical details"
  echo "  3. If you changed CLAUDE.md, update GEMINI.md to match"
  echo "=========================================================="
  echo ""
fi
