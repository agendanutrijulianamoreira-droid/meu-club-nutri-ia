#!/bin/bash
set -uo pipefail

cd "$CLAUDE_PROJECT_DIR"

# Plain `npm install` fails in this environment because the `supabase`
# devDependency's postinstall script tries to download the Supabase CLI
# binary directly from GitHub releases, which the network policy blocks.
# We don't need that CLI binary for typecheck/build/test, so fall back to
# skipping install scripts if the first attempt fails.
if ! npm install; then
    echo "npm install failed (likely the supabase CLI postinstall download) — retrying with --ignore-scripts" >&2
    npm install --ignore-scripts
fi
