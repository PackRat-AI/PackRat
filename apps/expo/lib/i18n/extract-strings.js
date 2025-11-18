#!/usr/bin/env node

/**
 * String Extraction Helper
 * 
 * This script helps identify hardcoded strings in components that should
 * be moved to the translation system.
 * 
 * Usage:
 *   node lib/i18n/extract-strings.js
 * 
 * This will scan components and identify potential strings that need translation.
 */

const fs = require('fs');
const path = require('path');

// Patterns that often indicate user-facing strings
const STRING_PATTERNS = [
  // Text content in JSX
  /<Text[^>]*>([^<]+)<\/Text>/g,
  // Button titles
  /title=['"]([^'"]+)['"]/g,
  // Placeholder text
  /placeholder=['"]([^'"]+)['"]/g,
  // Labels
  /label=['"]([^'"]+)['"]/g,
  // Error messages
  /message=['"]([^'"]+)['"]/g,
];

// Strings to ignore (technical/variable content)
const IGNORE_PATTERNS = [
  /^[\d\s]+$/,           // Numbers and whitespace only
  /^\{.*\}$/,            // JSX expressions
  /^[a-z-]+$/,           // CSS class names
  /^\$\{.*\}$/,          // Template literals
  /^https?:\/\//,        // URLs
  /^[A-Z_]+$/,           // Constants
];

function shouldIgnoreString(str) {
  return IGNORE_PATTERNS.some(pattern => pattern.test(str));
}

function extractStringsFromFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const strings = new Set();

  STRING_PATTERNS.forEach(pattern => {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const str = match[1].trim();
      if (str && !shouldIgnoreString(str)) {
        strings.add(str);
      }
    }
  });

  return Array.from(strings);
}

function scanDirectory(dirPath, results = []) {
  const items = fs.readdirSync(dirPath);

  items.forEach(item => {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Skip node_modules and hidden directories
      if (!item.startsWith('.') && item !== 'node_modules') {
        scanDirectory(fullPath, results);
      }
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      const strings = extractStringsFromFile(fullPath);
      if (strings.length > 0) {
        results.push({
          file: fullPath,
          strings,
        });
      }
    }
  });

  return results;
}

// Main execution
console.log('🔍 Scanning for hardcoded strings...\n');

const componentsDir = path.join(__dirname, '..', '..', 'components');
const screensDir = path.join(__dirname, '..', '..', 'screens');
const appDir = path.join(__dirname, '..', '..', 'app');

const results = [
  ...scanDirectory(componentsDir),
  ...scanDirectory(screensDir),
  ...scanDirectory(appDir),
];

console.log(`Found ${results.length} files with potential strings to translate:\n`);

results.forEach(({ file, strings }) => {
  console.log(`📄 ${file}`);
  strings.forEach(str => {
    console.log(`   - "${str}"`);
  });
  console.log('');
});

console.log('\n✨ Next steps:');
console.log('1. Review the strings above');
console.log('2. Add appropriate keys to lib/i18n/locales/en.json');
console.log('3. Replace hardcoded strings with t("your.key")');
console.log('4. Import useTranslation hook in components\n');
