#!/usr/bin/env bash
# Setup script for LibraryOS architecture fixes
# Run this once from the project root: bash scripts/setup-ui-lib.sh

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UI_LIB="$PROJECT_ROOT/lib/ui"
LIB_OS="$PROJECT_ROOT/artifacts/library-os"
ADMIN="$PROJECT_ROOT/artifacts/admin-portal"

echo "=== 1. Setting up lib/ui shared component library ==="

# Create directory structure
mkdir -p "$UI_LIB/src/components/ui"
mkdir -p "$UI_LIB/src/lib"
mkdir -p "$UI_LIB/src/hooks"

# Copy all shadcn UI components
echo "Copying shadcn components from library-os..."
cp "$LIB_OS/src/components/ui/"*.tsx "$UI_LIB/src/components/ui/"

# Copy hooks
echo "Copying shared hooks..."
cp "$LIB_OS/src/hooks/use-mobile.tsx" "$UI_LIB/src/hooks/" 2>/dev/null || true
cp "$LIB_OS/src/hooks/use-toast.ts"  "$UI_LIB/src/hooks/" 2>/dev/null || true

# Fix imports in lib/ui: change @/lib/utils -> @/lib/utils (same), @/components/ui/* -> ./*
echo "Fixing component imports in lib/ui..."
if command -v sed &>/dev/null; then
  # Fix @/components/ui/ → ./ (relative imports within UI lib)
  find "$UI_LIB/src/components/ui" -name '*.tsx' -exec sed -i \
    's|from "@/components/ui/|from "./|g' {} +

  # Fix @/lib/utils → ../../lib/utils (relative from components/ui/)
  find "$UI_LIB/src/components/ui" -name '*.tsx' -exec sed -i \
    's|from "@/lib/utils"|from "../../lib/utils"|g' {} +

  # Fix @/hooks/ → ../../hooks/ (relative from components/ui/)
  find "$UI_LIB/src/components/ui" -name '*.tsx' -exec sed -i \
    's|from "@/hooks/|from "../../hooks/|g' {} +

  # Fix imports in hooks that reference components
  find "$UI_LIB/src/hooks" -name '*.ts' -name '*.tsx' -exec sed -i \
    's|from "@/components/ui/|from "../components/ui/|g' {} + 2>/dev/null || true
fi

echo ""
echo "=== 2. Updating library-os imports to use @workspace/ui ==="
echo "  (Components in library-os/src/components/ui/ are kept as-is for now."
echo "   Gradually migrate to: import { Button } from '@workspace/ui/components/button')"
echo ""

echo "=== ✅ lib/ui setup complete ==="
echo ""
echo "Next steps:"
echo "  1. Run 'pnpm install' from project root to link the new package"
echo "  2. Gradually replace imports in library-os and admin-portal:"
echo "     - import { cn } from '@workspace/ui/utils'"
echo "     - import { Button } from '@workspace/ui/components/button'"
echo "     - import { useIsMobile } from '@workspace/ui/hooks/use-mobile'"
echo ""
