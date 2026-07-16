import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type ImageInfo, parseSipsImageInfo, validateAppIconSet } from '../lib/app-store-assets';

function createIconSet(images: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), 'packrat-icons-'));
  writeFileSync(join(dir, 'Contents.json'), JSON.stringify({ images, info: { version: 1 } }));
  return dir;
}

function writePlaceholder(dir: string, file: string) {
  writeFileSync(join(dir, file), 'png');
}

function inspector(infoByFile: Record<string, ImageInfo>) {
  return (path: string) => {
    const info = infoByFile[basename(path)];
    if (!info) {
      throw new Error(`No test image info for ${path}`);
    }
    return info;
  };
}

describe('parseSipsImageInfo', () => {
  it('parses dimensions and alpha state from sips output', () => {
    expect(
      parseSipsImageInfo(
        '/tmp/icon.png\n  pixelWidth: 1024\n  pixelHeight: 1024\n  hasAlpha: no\n',
      ),
    ).toEqual({ width: 1024, height: 1024, hasAlpha: false });
  });
});

describe('validateAppIconSet', () => {
  it('accepts flattened icons with matching dimensions', () => {
    const dir = createIconSet([
      { filename: 'AppIcon-iOS-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
      { filename: 'AppIcon-mac-16@2x.png', idiom: 'mac', scale: '2x', size: '16x16' },
    ]);
    writePlaceholder(dir, 'AppIcon-iOS-1024.png');
    writePlaceholder(dir, 'AppIcon-mac-16@2x.png');

    expect(
      validateAppIconSet(
        dir,
        inspector({
          'AppIcon-iOS-1024.png': { width: 1024, height: 1024, hasAlpha: false },
          'AppIcon-mac-16@2x.png': { width: 32, height: 32, hasAlpha: false },
        }),
      ),
    ).toEqual([]);
  });

  it('reports missing filenames and referenced files', () => {
    const dir = createIconSet([
      { idiom: 'universal', platform: 'ios', size: '1024x1024' },
      { filename: 'Missing.png', idiom: 'mac', scale: '1x', size: '16x16' },
    ]);

    expect(validateAppIconSet(dir, inspector({})).map((issue) => issue.message)).toEqual([
      'ios 1024x1024 1x is missing a filename.',
      'Missing.png is referenced by Contents.json but missing.',
    ]);
  });

  it('reports wrong dimensions and alpha channels', () => {
    const dir = createIconSet([
      { filename: 'AppIcon-iOS-1024.png', idiom: 'universal', platform: 'ios', size: '1024x1024' },
    ]);
    writePlaceholder(dir, 'AppIcon-iOS-1024.png');

    expect(
      validateAppIconSet(
        dir,
        inspector({
          'AppIcon-iOS-1024.png': { width: 1023, height: 1024, hasAlpha: true },
        }),
      ).map((issue) => issue.message),
    ).toEqual([
      'AppIcon-iOS-1024.png is 1023x1024; expected 1024x1024.',
      'AppIcon-iOS-1024.png has an alpha channel; App Store app icons must be flattened.',
    ]);
  });

  it('accepts fractional Apple icon point sizes', () => {
    const dir = createIconSet([
      { filename: 'AppIcon-iPad-83.5@2x.png', idiom: 'ipad', scale: '2x', size: '83.5x83.5' },
      {
        filename: 'AppIcon-watch-notification-27.5@2x.png',
        idiom: 'watch',
        scale: '2x',
        size: '27.5x27.5',
      },
    ]);
    writePlaceholder(dir, 'AppIcon-iPad-83.5@2x.png');
    writePlaceholder(dir, 'AppIcon-watch-notification-27.5@2x.png');

    expect(
      validateAppIconSet(
        dir,
        inspector({
          'AppIcon-iPad-83.5@2x.png': { width: 167, height: 167, hasAlpha: false },
          'AppIcon-watch-notification-27.5@2x.png': {
            width: 55,
            height: 55,
            hasAlpha: false,
          },
        }),
      ),
    ).toEqual([]);
  });
});
