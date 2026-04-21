#!/bin/bash

# Android TextInput Focus Prevention Pre-commit Hook
# This script prevents common Android keyboard focus persistence issues

echo "🔍 Checking for Android TextInput focus issues..."

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Track if any issues were found
ISSUES_FOUND=0

# 1. Check for direct TextInput imports from react-native (exclude enhanced components)
# Uses awk to handle both single-line and multiline import statements
echo "   Checking for direct React Native TextInput imports..."
DIRECT_IMPORTS=""
while IFS= read -r file; do
  if awk '
    /^import[[:space:]]/ {
      in_import = 1; block = $0
      if (/from[[:space:]]/) {
        if (/react-native/ && block ~ /[^[:alnum:]_]TextInput[^[:alnum:]_]/) { found=1; exit }
        in_import = 0; block = ""; next
      }
      next
    }
    in_import {
      block = block " " $0
      if (/from[[:space:]]/) {
        if (/react-native/ && block ~ /[^[:alnum:]_]TextInput[^[:alnum:]_]/) { found=1; exit }
        in_import = 0; block = ""
      }
    }
    END { exit (found ? 0 : 1) }
  ' "$file" 2>/dev/null; then
    DIRECT_IMPORTS="${DIRECT_IMPORTS}${file}"$'\n'
  fi
done < <(find apps/expo -name "*.tsx" -o -name "*.ts" \
  | grep -v "components/TextInput.tsx" \
  | grep -v "components/SearchInput.tsx" 2>/dev/null)

if [ -n "$DIRECT_IMPORTS" ]; then
  echo -e "${RED}❌ Error: Direct TextInput import from react-native detected!${NC}"
  echo "   Files with issues:"
  echo "$DIRECT_IMPORTS" | grep . | sed 's/^/     /'
  echo -e "   ${YELLOW}Fix: Use 'import { TextInput } from \"expo-app/components/TextInput\"' instead${NC}"
  echo ""
  ISSUES_FOUND=1
fi

# 2. Check for new input components without useKeyboardHideBlur
echo "   Checking for input components without keyboard fix..."
STAGED_FILES=$(git diff --cached --name-only --diff-filter=AM | grep -E '\.(tsx?)$' || true)

if [ -n "$STAGED_FILES" ]; then
  for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
      # Check if file contains forwardRef with Input in name but no useKeyboardHideBlur
      if grep -q "forwardRef.*Input\|Input.*forwardRef" "$file" && ! grep -q "useKeyboardHideBlur" "$file"; then
        echo -e "${YELLOW}⚠️  Warning: New input component without keyboard fix detected:${NC}"
        echo "     $file"
        echo -e "   ${YELLOW}Consider adding 'useKeyboardHideBlur' hook for Android compatibility${NC}"
        echo ""
      fi
    fi
  done
fi

# 3. Check for third-party input component imports that might need wrapping
# Uses grep -v to exclude known-safe modules (avoids PCRE lookaheads for portability)
echo "   Checking for third-party input components..."
THIRD_PARTY_INPUTS=$(find apps/expo -name "*.tsx" -o -name "*.ts" \
  | xargs grep -H -E "import.*[Ii]nput.*from ['\"]" 2>/dev/null \
  | grep -v "from ['\"]react-native['\"]" \
  | grep -v "from ['\"]expo-app" \
  | grep -v "from ['\"]@packrat" \
  || true)

if [ -n "$THIRD_PARTY_INPUTS" ]; then
  echo -e "${YELLOW}ℹ️  Info: Third-party input components found:${NC}"
  echo "$THIRD_PARTY_INPUTS" | sed 's/^/     /'
  echo -e "   ${YELLOW}Verify these components handle Android keyboard behavior correctly${NC}"
  echo ""
fi

# 4. Check for any new components with 'TextInput' in JSX without proper ref setup
echo "   Checking for TextInput components without proper refs..."
if [ -n "$STAGED_FILES" ]; then
  for file in $STAGED_FILES; do
    if [ -f "$file" ]; then
      # Look for <TextInput without ref prop
      if grep -q "<TextInput" "$file" && ! grep -q "ref.*=" "$file"; then
        echo -e "${YELLOW}⚠️  Warning: TextInput without ref found in new file:${NC}"
        echo "     $file"
        echo -e "   ${YELLOW}TextInputs should have refs for proper keyboard management${NC}"
        echo ""
      fi
    fi
  done
fi

# 5. Check for missing keyboard dismiss behavior in search components
echo "   Checking search components for keyboard behavior..."
SEARCH_FILES=$(find apps/expo -name "*[Ss]earch*.tsx" -o -name "*[Ss]earch*.ts" | head -10)
for file in $SEARCH_FILES; do
  if [ -f "$file" ] && ! grep -q "useKeyboardHideBlur\|SearchInput.*from.*expo-app" "$file"; then
    if grep -q "TextInput\|Input.*Search\|search.*Input" "$file"; then
      echo -e "${YELLOW}ℹ️  Info: Search component without enhanced input:${NC}"
      echo "     $file"  
      echo -e "   ${YELLOW}Consider using enhanced SearchInput component${NC}"
      echo ""
    fi
  fi
done

# Summary
echo "🔍 Android TextInput focus check complete"

if [ $ISSUES_FOUND -eq 1 ]; then
  echo -e "${RED}❌ Pre-commit check failed. Please fix the issues above before committing.${NC}"
  echo ""
  echo "📖 For more information, see: docs/android-keyboard-focus-prevention-strategies.md"
  exit 1
else
  echo -e "${GREEN}✅ No Android TextInput focus issues detected${NC}"
  echo ""
fi

exit 0