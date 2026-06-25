import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fromZod } from '@packrat/guards';
import { safeJsonParse } from '@packrat/utils';
import { z } from 'zod';

export type ImageInfo = {
  width: number;
  height: number;
  hasAlpha: boolean;
};

export type AppIconIssue = {
  file?: string;
  message: string;
};

const AppIconImageSchema = z
  .object({
    filename: z.string().optional(),
    idiom: z.string().optional(),
    platform: z.string().optional(),
    scale: z.string().optional(),
    size: z.string().optional(),
  })
  .passthrough();

const AppIconContentsSchema = z
  .object({
    images: z.array(AppIconImageSchema).optional(),
  })
  .passthrough();

const parseAppIconContents = fromZod(AppIconContentsSchema);

export type ImageInspector = (path: string) => ImageInfo;

const PIXEL_WIDTH_RE = /pixelWidth:\s*([0-9.]+)/;
const PIXEL_HEIGHT_RE = /pixelHeight:\s*([0-9.]+)/;
const HAS_ALPHA_RE = /hasAlpha:\s*(yes|no)/;
const ICON_SIZE_RE = /^(\d+)x(\d+)$/;
const ICON_SCALE_RE = /^(\d+)x$/;

export function parseSipsImageInfo(output: string): ImageInfo {
  const width = output.match(PIXEL_WIDTH_RE)?.[1];
  const height = output.match(PIXEL_HEIGHT_RE)?.[1];
  const hasAlpha = output.match(HAS_ALPHA_RE)?.[1];

  if (!width || !height) {
    throw new Error('Unable to parse image dimensions from sips output.');
  }

  return {
    width: Math.round(Number(width)),
    height: Math.round(Number(height)),
    hasAlpha: hasAlpha === 'yes',
  };
}

export function inspectImageWithSips(path: string): ImageInfo {
  const output = execFileSync(
    'sips',
    ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', path],
    { encoding: 'utf8' },
  );
  return parseSipsImageInfo(output);
}

export function validateAppIconSet(
  iconSetDir: string,
  inspectImage: ImageInspector = inspectImageWithSips,
): AppIconIssue[] {
  const contentsPath = join(iconSetDir, 'Contents.json');
  const issues: AppIconIssue[] = [];

  if (!existsSync(contentsPath)) {
    return [{ file: contentsPath, message: 'App icon set is missing Contents.json.' }];
  }

  const contents = parseAppIconContents(
    safeJsonParse(readFileSync(contentsPath, 'utf8'), { strict: true }),
  );
  if (!contents) {
    return [{ file: contentsPath, message: 'App icon Contents.json has an invalid shape.' }];
  }
  const images = contents.images ?? [];

  if (images.length === 0) {
    issues.push({ file: contentsPath, message: 'App icon set does not define any image slots.' });
  }

  for (const image of images) {
    const slot = `${image.platform ?? image.idiom ?? 'icon'} ${image.size ?? 'unknown'} ${
      image.scale ?? '1x'
    }`;

    if (!image.filename) {
      issues.push({ file: contentsPath, message: `${slot} is missing a filename.` });
      continue;
    }

    const file = join(iconSetDir, image.filename);
    if (!existsSync(file)) {
      issues.push({
        file,
        message: `${image.filename} is referenced by Contents.json but missing.`,
      });
      continue;
    }

    const expectedPoints = image.size?.match(ICON_SIZE_RE);
    const scale = image.scale?.match(ICON_SCALE_RE)?.[1] ?? '1';

    if (!expectedPoints) {
      issues.push({ file: contentsPath, message: `${slot} has an invalid size declaration.` });
      continue;
    }

    const expectedWidth = Number(expectedPoints[1]) * Number(scale);
    const expectedHeight = Number(expectedPoints[2]) * Number(scale);
    const info = inspectImage(file);

    if (info.width !== expectedWidth || info.height !== expectedHeight) {
      issues.push({
        file,
        message: `${basename(file)} is ${info.width}x${info.height}; expected ${expectedWidth}x${expectedHeight}.`,
      });
    }

    if (info.hasAlpha) {
      issues.push({
        file,
        message: `${basename(file)} has an alpha channel; App Store app icons must be flattened.`,
      });
    }
  }

  return issues;
}
