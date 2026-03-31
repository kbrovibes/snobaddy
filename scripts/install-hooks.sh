#!/bin/bash
# install-hooks.sh — installs git hooks from scripts/ into .git/hooks/
# Run once after cloning: bash scripts/install-hooks.sh

REPO_ROOT=$(git rev-parse --show-toplevel)
HOOKS_DIR="$REPO_ROOT/.git/hooks"

cp "$REPO_ROOT/scripts/pre-commit" "$HOOKS_DIR/pre-commit"
chmod +x "$HOOKS_DIR/pre-commit"

echo "Git hooks installed:"
echo "  .git/hooks/pre-commit — blocks commits that change src/ without updating CHANGELOG.md"
