#!/bin/bash
set -e

# package-artifact.sh
# Packages an artifact project's TypeScript SOURCE into a tarball that a user can
# compile themselves with a clean `npm install && npm run build`. This is the
# counterpart to bundle-artifact.sh: instead of producing a single inlined
# bundle.html, it ships the editable source.
#
# It performs three things:
#   1. Makes the project compile standalone with npm (patches a tsc deprecation
#      that breaks `tsc -b`, prunes unused scaffold stubs that fail type-check).
#   2. Produces a clean source tarball (no node_modules / dist / caches / lockfiles).
#   3. Optionally verifies the tarball in a clean room (--verify).
#
# Usage:
#   bash package-artifact.sh [--verify] [--out FILE]
#   (run from the project root, where package.json lives)

VERIFY=0
OUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --verify) VERIFY=1; shift ;;
    --out) OUT="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: bash package-artifact.sh [--verify] [--out FILE]"
      exit 0 ;;
    *) echo "❌ Unknown argument: $1"; exit 1 ;;
  esac
done

echo "📦 Packaging artifact source for standalone npm build..."

# --- preconditions ---------------------------------------------------------
if [ ! -f "package.json" ]; then
  echo "❌ Error: No package.json found. Run this script from your project root."
  exit 1
fi

PROJ_DIR="$(pwd)"
PROJ_NAME="$(basename "$PROJ_DIR")"
[ -z "$OUT" ] && OUT="$PROJ_DIR/${PROJ_NAME}-src.tar.gz"

# --- 1. make the project compile standalone --------------------------------

# 1a. `tsc -b` errors on the scaffold's deprecated "baseUrl" (TS5101). Silence it
#     by adding ignoreDeprecations to any tsconfig that sets baseUrl.
echo "🔧 Patching tsconfig for standalone tsc..."
node -e '
const fs = require("fs");
for (const f of ["tsconfig.json", "tsconfig.app.json", "tsconfig.node.json"]) {
  if (!fs.existsSync(f)) continue;
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("\"ignoreDeprecations\"")) continue;
  if (s.includes("\"baseUrl\"")) {
    s = s.replace(/(\s*)("baseUrl")/, "$1\"ignoreDeprecations\": \"6.0\",$1$2");
    fs.writeFileSync(f, s);
    console.log("   • added ignoreDeprecations to " + f);
  }
}
'

# 1b. The scaffold ships ~40 shadcn/ui components and helper hooks. If your app
#     imports none of them, some of their stubs fail type-check against
#     npm-resolved dependency versions. Prune any prunable dir that nothing
#     outside the prunable dirs imports.
prune_if_unused() {
  local dir="$1" alias="$2"
  [ -d "$dir" ] || return 0
  # search all source EXCEPT the prunable dirs for an import of this alias
  if grep -rqE "$alias" --include='*.ts' --include='*.tsx' src \
       --exclude-dir=ui --exclude-dir=hooks 2>/dev/null; then
    echo "   • keeping $dir (referenced by app code)"
  else
    rm -rf "$dir"
    echo "   • removed unused $dir"
  fi
}
echo "🧹 Pruning unused scaffold stubs..."
prune_if_unused "src/components/ui" '@/components/ui'
# hooks are commonly imported BY ui components, so only prune them once ui is gone
if [ ! -d "src/components/ui" ]; then
  prune_if_unused "src/hooks" '@/hooks'
elif [ -d "src/hooks" ]; then
  echo "   • keeping src/hooks (ui components may depend on it)"
fi

# 1c. Sanity type-check with whatever node_modules are already present (fast,
#     no install). Warn but don't abort — the clean-room --verify is authoritative.
if [ -d "node_modules" ]; then
  echo "🔎 Type-checking with existing node_modules..."
  if npx --no-install tsc -b >/tmp/pkg_tsc.log 2>&1; then
    echo "   • tsc -b passed"
  else
    echo "   ⚠️  tsc -b reported issues (see below). Packaging will continue."
    sed 's/^/      /' /tmp/pkg_tsc.log | head -20
  fi
fi

# --- 2. build the source tarball -------------------------------------------
echo "🗜️  Creating source tarball..."
rm -f "$OUT"
tar \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='build' \
  --exclude='bundle.html' \
  --exclude='.parcel-cache' \
  --exclude='.parcelrc' \
  --exclude='.git' \
  --exclude='*.tsbuildinfo' \
  --exclude='.DS_Store' \
  --exclude='pnpm-lock.yaml' \
  --exclude='pnpm-workspace.yaml' \
  --exclude='yarn.lock' \
  -czf "$OUT" -C "$PROJ_DIR/.." "$PROJ_NAME"

FILE_SIZE=$(du -h "$OUT" | cut -f1)
echo ""
echo "✅ Source package complete!"
echo "📄 Output: $OUT ($FILE_SIZE)"
echo "   Contents:"
tar -tzf "$OUT" | grep -v '/$' | sed 's/^/      /' | head -40

# --- 3. optional clean-room verification -----------------------------------
if [ "$VERIFY" -eq 1 ]; then
  echo ""
  echo "🧪 Verifying tarball with a clean npm install && npm run build..."
  TMP="$(mktemp -d)"
  tar -xzf "$OUT" -C "$TMP"
  (
    cd "$TMP/$PROJ_NAME"
    npm install --no-audit --no-fund
    npm run build
  )
  rm -rf "$TMP"
  echo "✅ Clean-room build succeeded — the tarball compiles with npm."
fi

echo ""
echo "Recipient builds it with:"
echo "   tar -xzf $(basename "$OUT")"
echo "   cd $PROJ_NAME"
echo "   npm install && npm run build   # -> dist/   (or: npm run dev)"
