#!/bin/bash
# Enforces CLAUDE.md rule: never create a *_ops.rs without a matching *Tab.tsx (and vice-versa).
# Only fires on Write (new/overwritten files) and only for truly new (untracked) files.

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

[[ "$TOOL_NAME" != "Write" ]] && exit 0
[[ -z "$FILE_PATH" ]] && exit 0

# Skip if the file was already tracked by git (not a newly created file)
if git -C "$CLAUDE_PROJECT_DIR" ls-files --error-unmatch "$FILE_PATH" 2>/dev/null; then
  exit 0
fi

BASENAME=$(basename "$FILE_PATH")
COMPONENTS_DIR="$CLAUDE_PROJECT_DIR/src/components"
RUST_SRC_DIR="$CLAUDE_PROJECT_DIR/src-tauri/src"

block() {
  echo "{\"decision\":\"block\",\"reason\":\"$1\"}"
}

# New *_ops.rs created → require a matching *Tab.tsx
if [[ "$FILE_PATH" == *"/src-tauri/src/"*"_ops.rs" ]]; then
  OPS_BASE="${BASENAME%_ops.rs}"
  TAB_NAME=$(echo "$OPS_BASE" | sed 's/_\([a-z]\)/\U\1/g; s/^\([a-z]\)/\U\1/')
  if [[ ! -f "$COMPONENTS_DIR/${TAB_NAME}Tab.tsx" ]]; then
    block "CLAUDE.md rule: '$BASENAME' was created without a matching '${TAB_NAME}Tab.tsx' in src/components/. Create both files together (5-step process in CLAUDE.md)."
  fi
  exit 0
fi

# New *Tab.tsx in components/ → require a matching *_ops.rs
if [[ "$FILE_PATH" == *"/src/components/"*"Tab.tsx" ]]; then
  TAB_BASE="${BASENAME%Tab.tsx}"
  OPS_BASE=$(echo "$TAB_BASE" | sed 's/\([A-Z]\)/_\L\1/g; s/^_//')
  if [[ ! -f "$RUST_SRC_DIR/${OPS_BASE}_ops.rs" ]]; then
    block "CLAUDE.md rule: '$BASENAME' was created without a matching '${OPS_BASE}_ops.rs' in src-tauri/src/. Create both files together (5-step process in CLAUDE.md)."
  fi
  exit 0
fi
