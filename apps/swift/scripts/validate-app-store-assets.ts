import { resolve } from 'node:path';
import { validateAppIconSet } from './lib/app-store-assets';

const repoRoot = resolve(import.meta.dir, '../../..');
const iconSetDir = resolve(repoRoot, 'apps/swift/Resources/Assets.xcassets/AppIcon.appiconset');

const issues = validateAppIconSet(iconSetDir);

if (issues.length > 0) {
  console.error('App Store asset validation failed:');
  for (const issue of issues) {
    console.error(`- ${issue.file ? `${issue.file}: ` : ''}${issue.message}`);
  }
  process.exit(1);
}

console.log('App Store asset validation passed.');
