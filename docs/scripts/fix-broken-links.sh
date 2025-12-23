#!/bin/bash
# fix-broken-links.sh
# Automated link repair for nostr-BBS documentation
# Generated: 2025-12-23

set -e

DOCS_DIR="/home/devuser/workspace/nostr-BBS/docs"
WORKING_DIR="$DOCS_DIR/working"

echo "=================================="
echo "Documentation Link Fix Script"
echo "=================================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for fixes
FIXES_APPLIED=0

# ============================================
# PHASE 1: Create Missing Working Files
# ============================================

echo -e "${YELLOW}[PHASE 1]${NC} Creating missing working directory files..."
echo ""

MISSING_FILES=(
    "corpus-analysis.md"
    "automation-setup-report.md"
    "final-quality-report.md"
    "diagram-modernisation-report.md"
    "metadata-implementation-report.md"
    "spelling-audit-report.md"
    "structure-normalisation-report.md"
    "reference-consolidation-report.md"
    "cleaning-actions-applied.md"
    "content-cleaning-report.md"
    "CLEANING_SUMMARY.md"
    "README.md"
)

for file in "${MISSING_FILES[@]}"; do
    if [ ! -f "$WORKING_DIR/$file" ]; then
        TITLE="${file%.md}"
        TITLE="${TITLE//-/ }"
        TITLE="${TITLE//_/ }"

        cat > "$WORKING_DIR/$file" << EOF
# ${TITLE^}

**Status:** Archived / Stub
**Created:** 2025-12-23 (automated)
**Location:** \`docs/working/${file}\`

---

## Archive Notice

This document was referenced in the documentation but the original file was not found.
It may have been archived, consolidated, or is pending creation.

## Purpose

*To be documented*

## Current Status

This is a stub file created to resolve broken documentation links.

**Action Required:**
- [ ] Add actual content if this document is needed
- [ ] Or remove references to this file if obsolete
- [ ] Or link to the actual archived version if available

---

## See Also

- [Documentation Index](../INDEX.md) - Master documentation hub
- [Archive Index](../archive/2024-documentation-audit/INDEX.md) - Historical documentation
- [Link Validation Report](link-validation-comprehensive.md) - Link health status

---

**Navigation:** [← Back to Working Directory](README.md) | [← Back to Documentation Hub](../INDEX.md)
EOF

        echo -e "${GREEN}✓${NC} Created: working/${file}"
        ((FIXES_APPLIED++))
    else
        echo -e "  Skip: working/${file} (already exists)"
    fi
done

echo ""
echo -e "${GREEN}Phase 1 Complete:${NC} Created ${FIXES_APPLIED} stub files"
echo ""

# ============================================
# PHASE 2: Fix Architecture Link Paths
# ============================================

echo -e "${YELLOW}[PHASE 2]${NC} Fixing architecture link paths..."
echo ""

# Files with architecture link issues
ARCH_FILES=(
    "$DOCS_DIR/link-validation-actionable.md"
)

ARCH_FIXES=0

for file in "${ARCH_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing: ${file##*/}"

        # Backup original
        cp "$file" "${file}.backup"

        # Fix architecture links (0N-*.md without architecture/ prefix)
        # But only when not already correct
        sed -i 's|\](0\([2-9]\)-\([a-z-]*\)\.md)|\](architecture/0\1-\2.md)|g' "$file"

        # Check if changes were made
        if ! diff -q "$file" "${file}.backup" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Fixed architecture paths in: ${file##*/}"
            ((ARCH_FIXES++))
            rm "${file}.backup"
        else
            echo "  No changes needed in: ${file##*/}"
            mv "${file}.backup" "$file"
        fi
    fi
done

echo ""
echo -e "${GREEN}Phase 2 Complete:${NC} Fixed ${ARCH_FIXES} files"
echo ""

# ============================================
# PHASE 3: Fix Features Link Paths
# ============================================

echo -e "${YELLOW}[PHASE 3]${NC} Fixing features link paths..."
echo ""

FEATURE_FIXES=0

for file in "${ARCH_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing: ${file##*/}"

        # Backup original
        cp "$file" "${file}.backup"

        # Fix feature links that should have features/ prefix
        # Pattern: ](filename.md) where filename is a known feature
        sed -i 's|\](pwa-quick-start\.md)|\](features/pwa-quick-start.md)|g' "$file"
        sed -i 's|\](search-implementation\.md)|\](features/search-implementation.md)|g' "$file"
        sed -i 's|\](threading-implementation\.md)|\](features/threading-implementation.md)|g' "$file"
        sed -i 's|\](dm-implementation\.md)|\](features/dm-implementation.md)|g' "$file"

        # Check if changes were made
        if ! diff -q "$file" "${file}.backup" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Fixed features paths in: ${file##*/}"
            ((FEATURE_FIXES++))
            rm "${file}.backup"
        else
            echo "  No changes needed in: ${file##*/}"
            mv "${file}.backup" "$file"
        fi
    fi
done

echo ""
echo -e "${GREEN}Phase 3 Complete:${NC} Fixed ${FEATURE_FIXES} files"
echo ""

# ============================================
# PHASE 4: Fix ndk.ts References
# ============================================

echo -e "${YELLOW}[PHASE 4]${NC} Fixing ndk.ts path references..."
echo ""

NDK_FILES=(
    "$DOCS_DIR/reference/nip-protocol-reference.md"
    "$DOCS_DIR/architecture/02-architecture.md"
    "$DOCS_DIR/working/content-audit-2025.md"
)

NDK_FIXES=0

for file in "${NDK_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "Processing: ${file##*/}"

        # Backup original
        cp "$file" "${file}.backup"

        # Fix ndk.ts path: /src/lib/nostr/ndk.ts → /src/lib/stores/ndk.ts
        sed -i 's|/src/lib/nostr/ndk\.ts|/src/lib/stores/ndk.ts|g' "$file"

        # Check if changes were made
        if ! diff -q "$file" "${file}.backup" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Fixed ndk.ts path in: ${file##*/}"
            ((NDK_FIXES++))
            rm "${file}.backup"
        else
            echo "  No changes needed in: ${file##*/}"
            mv "${file}.backup" "$file"
        fi
    fi
done

echo ""
echo -e "${GREEN}Phase 4 Complete:${NC} Fixed ${NDK_FIXES} files"
echo ""

# ============================================
# Summary
# ============================================

TOTAL_FIXES=$((FIXES_APPLIED + ARCH_FIXES + FEATURE_FIXES + NDK_FIXES))

echo "=================================="
echo "Fix Summary"
echo "=================================="
echo ""
echo -e "Stub files created:        ${GREEN}${FIXES_APPLIED}${NC}"
echo -e "Architecture paths fixed:  ${GREEN}${ARCH_FIXES}${NC}"
echo -e "Features paths fixed:      ${GREEN}${FEATURE_FIXES}${NC}"
echo -e "ndk.ts references fixed:   ${GREEN}${NDK_FIXES}${NC}"
echo ""
echo -e "${GREEN}Total fixes applied:       ${TOTAL_FIXES}${NC}"
echo ""

# ============================================
# Validation
# ============================================

echo -e "${YELLOW}[VALIDATION]${NC} Re-running link validation..."
echo ""

if [ -f "/tmp/extract_links.py" ]; then
    python3 /tmp/extract_links.py | head -20
else
    echo "Link validation script not found. Skipping validation."
fi

echo ""
echo "=================================="
echo "Fix Script Complete!"
echo "=================================="
echo ""
echo "Next Steps:"
echo "1. Review the created stub files in docs/working/"
echo "2. Add actual content or remove unnecessary stubs"
echo "3. Run: git status to see changes"
echo "4. Run: git diff to review changes"
echo "5. Commit changes if satisfied"
echo ""
