import { describe, expect, it } from 'vitest';
import { ArgsError } from '../lib/args';
import { normalizeMacOSTestSelectors, parseMacOSArgs } from '../lib/macos-args';

describe('parseMacOSArgs', () => {
  it('resolves smoke and full plan aliases', () => {
    expect(parseMacOSArgs(['--plan', 'smoke'])).toEqual({
      plan: 'macOS-Smoke',
      passthrough: [],
    });
    expect(parseMacOSArgs(['--plan=full']).plan).toBe('macOS-Full');
  });

  it('preserves passthrough xcodebuild selectors', () => {
    expect(parseMacOSArgs(['-only-testing:PackRatUITests/AuthTests']).passthrough).toEqual([
      '-only-testing:PackRatUITests/AuthTests',
    ]);
  });

  it('throws on bad or missing plans', () => {
    expect(() => parseMacOSArgs(['--plan', 'fake'])).toThrow(ArgsError);
    expect(() => parseMacOSArgs(['--plan'])).toThrow(/requires a value/);
  });
});

describe('normalizeMacOSTestSelectors', () => {
  it('maps iOS target names to macOS target names', () => {
    expect(
      normalizeMacOSTestSelectors([
        '-only-testing:PackRatUITests/WeatherMacOSTests/testSavedLocationAppearsAsChip',
        '-skip-testing:PackRatUITests/AuthTests',
        '-only-testing:PackRatTests/OfflineStoreTests',
        '-skip-testing:PackRatTests/VisualSampleDataTests',
      ]),
    ).toEqual([
      '-only-testing:PackRatMacOSUITests/WeatherMacOSTests/testSavedLocationAppearsAsChip',
      '-skip-testing:PackRatMacOSUITests/AuthTests',
      '-only-testing:PackRatMacOSTests/OfflineStoreTests',
      '-skip-testing:PackRatMacOSTests/VisualSampleDataTests',
    ]);
  });

  it('leaves non-test arguments untouched', () => {
    expect(normalizeMacOSTestSelectors(['CODE_SIGNING_ALLOWED=NO'])).toEqual([
      'CODE_SIGNING_ALLOWED=NO',
    ]);
  });
});
