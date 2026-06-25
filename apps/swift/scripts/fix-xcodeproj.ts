#!/usr/bin/env bun
/**
 * Workaround for XcodeGen bug: XCLocalSwiftPackageReference entries are generated
 * but not linked back in XCSwiftPackageProductDependency nodes. Run after xcodegen.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const pbxproj = 'PackRat.xcodeproj/project.pbxproj';
let content = readFileSync(pbxproj, 'utf8');
let patched = 0;

for (const [, uuid, name] of content.matchAll(
  /(\w+) \/\* XCLocalSwiftPackageReference "(\w+)" \*\//g,
)) {
  const before = content;
  content = content.replace(
    new RegExp(`(isa = XCSwiftPackageProductDependency;\\n\\t\\t\\t)(productName = ${name};)`, 'g'),
    `$1package = ${uuid} /* XCLocalSwiftPackageReference "${name}" */;\n\t\t\t$2`,
  );
  if (content !== before) patched++;
}

writeFileSync(pbxproj, content);
if (patched) console.log(`fix-xcodeproj: patched ${patched} local package reference(s)`);
