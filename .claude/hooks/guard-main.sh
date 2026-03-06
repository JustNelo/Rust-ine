#!/bin/bash
# Enforces CLAUDE.md rule: never push directly to main.

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -qE 'git push.*(origin\s+)?main'; then
  echo '{"decision":"block","reason":"CLAUDE.md rule: never push directly to main. Push to develop or a feature branch (feat/name or fix/name) and open a PR instead."}'
fi
