import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { verifyTestFlightArchive } from '../lib/testflight-binary';
import { parseTestFlightUploadConfig } from '../lib/testflight-config';

const replacementConfig = parseTestFlightUploadConfig({
  argv: ['--production'],
  env: { BUILD_NUMBER: '2026071802' },
});

function plist(values: Record<string, string>): string {
  const body = Object.entries(values)
    .map(([key, value]) => `\t<key>${key}</key>\n\t<string>${value}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${body}
</dict>
</plist>
`;
}

function writeArchive(input?: {
  iosBundleId?: string;
  packratEnv?: string;
  withWatchApp?: boolean;
}): string {
  const withWatchApp = input?.withWatchApp ?? true;
  const root = mkdtempSync(join(tmpdir(), 'packrat-archive-test-'));
  const iosApp = join(root, 'PackRat.xcarchive', 'Products', 'Applications', 'PackRat.app');
  const watchApp = join(iosApp, 'Watch', 'PackRat Watch.app');
  mkdirSync(withWatchApp ? watchApp : iosApp, { recursive: true });
  writeFileSync(
    join(iosApp, 'Info.plist'),
    plist({
      CFBundleIdentifier: input?.iosBundleId ?? 'com.andrewbierman.packrat',
      CFBundleDisplayName: 'PackRat',
      CFBundleVersion: '2026071802',
      PACKRAT_ENV: input?.packratEnv ?? 'production',
    }),
  );
  if (withWatchApp) {
    writeFileSync(
      join(watchApp, 'Info.plist'),
      plist({
        CFBundleIdentifier: 'com.andrewbierman.packrat.watchkitapp',
        CFBundleDisplayName: 'PackRat',
        CFBundleVersion: '2026071802',
        WKCompanionAppBundleIdentifier: 'com.andrewbierman.packrat',
      }),
    );
  }
  return join(root, 'PackRat.xcarchive');
}

describe('TestFlight binary verification', () => {
  it('accepts a replacement archive with production metadata', () => {
    const archivePath = writeArchive();
    try {
      const result = verifyTestFlightArchive({ archivePath, config: replacementConfig });
      expect(result).toMatchObject({
        ok: true,
        errors: [],
      });
      expect(result.iosApp).toContain('PackRat.app');
      expect(result.watchApp).toContain('PackRat Watch.app');
    } finally {
      rmSync(join(archivePath, '..'), { recursive: true, force: true });
    }
  });

  it('accepts an archive with no embedded watch app', () => {
    // The watch app is not part of the first Swift release, so an archive
    // without one is valid rather than an error.
    const archivePath = writeArchive({ withWatchApp: false });
    try {
      const result = verifyTestFlightArchive({ archivePath, config: replacementConfig });
      expect(result).toMatchObject({ ok: true, errors: [] });
      expect(result.watchApp).toBeNull();
    } finally {
      rmSync(join(archivePath, '..'), { recursive: true, force: true });
    }
  });

  it('rejects an archive with the retired beta listing or non-production metadata', () => {
    const archivePath = writeArchive({
      iosBundleId: 'com.andrewbierman.packrat.swift',
      packratEnv: 'dev',
    });
    try {
      const result = verifyTestFlightArchive({ archivePath, config: replacementConfig });
      expect(result.ok).toBe(false);
      expect(result.errors).toContain(
        'iOS bundle id: expected com.andrewbierman.packrat, got com.andrewbierman.packrat.swift.',
      );
      expect(result.errors).toContain('iOS API environment: expected production, got dev.');
    } finally {
      rmSync(join(archivePath, '..'), { recursive: true, force: true });
    }
  });
});
