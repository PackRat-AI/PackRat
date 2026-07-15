import { describe, expect, it } from 'vitest';
import { ArgsError, parseArgs } from '../lib/args';

describe('parseArgs', () => {
  it('returns no plan and empty passthrough for empty argv', () => {
    expect(parseArgs([])).toEqual({ passthrough: [] });
  });

  it('resolves --plan smoke to iOS-Smoke', () => {
    expect(parseArgs(['--plan', 'smoke'])).toEqual({ plan: 'iOS-Smoke', passthrough: [] });
  });

  it('resolves --plan full to iOS-Full', () => {
    expect(parseArgs(['--plan', 'full'])).toEqual({ plan: 'iOS-Full', passthrough: [] });
  });

  it('accepts the canonical iOS-Smoke and iOS-Full names', () => {
    expect(parseArgs(['--plan', 'iOS-Smoke']).plan).toBe('iOS-Smoke');
    expect(parseArgs(['--plan', 'iOS-Full']).plan).toBe('iOS-Full');
  });

  it('accepts --plan=value form', () => {
    expect(parseArgs(['--plan=smoke']).plan).toBe('iOS-Smoke');
  });

  it('accepts legacy positional iOS mode aliases used by package scripts', () => {
    expect(parseArgs(['ios-ui'])).toEqual({ plan: 'iOS-Full', passthrough: [] });
    expect(parseArgs(['ios-smoke'])).toEqual({ plan: 'iOS-Smoke', passthrough: [] });
  });

  it('maps unit mode to the iOS unit test target instead of an xcodebuild action', () => {
    expect(parseArgs(['unit'])).toEqual({
      passthrough: ['-only-testing:PackRatTests'],
    });
    expect(parseArgs(['ios-unit'])).toEqual({
      passthrough: ['-only-testing:PackRatTests'],
    });
  });

  it('preserves an explicit plan before a unit positional mode', () => {
    expect(parseArgs(['--plan', 'smoke', 'unit'])).toEqual({
      plan: 'iOS-Smoke',
      passthrough: ['-only-testing:PackRatTests'],
    });
  });

  it('preserves an explicit plan after a unit positional mode', () => {
    expect(parseArgs(['ios-unit', '--plan=full'])).toEqual({
      plan: 'iOS-Full',
      passthrough: ['-only-testing:PackRatTests'],
    });
  });

  it('case-insensitive alias matching', () => {
    expect(parseArgs(['--plan', 'SMOKE']).plan).toBe('iOS-Smoke');
    expect(parseArgs(['--plan', 'FULL']).plan).toBe('iOS-Full');
  });

  it('preserves unknown args as passthrough so xcodebuild sees them', () => {
    expect(parseArgs(['-only-testing:PackRatUITests/AuthTests']).passthrough).toEqual([
      '-only-testing:PackRatUITests/AuthTests',
    ]);
  });

  it('mixes --plan with passthrough flags', () => {
    expect(parseArgs(['--plan', 'smoke', '-only-testing:PackRatUITests/AuthTests'])).toEqual({
      plan: 'iOS-Smoke',
      passthrough: ['-only-testing:PackRatUITests/AuthTests'],
    });
  });

  it('throws ArgsError on unknown plan', () => {
    expect(() => parseArgs(['--plan', 'fake'])).toThrow(ArgsError);
    expect(() => parseArgs(['--plan', 'fake'])).toThrow(/Valid plans/);
  });

  it('throws when --plan is missing its value', () => {
    expect(() => parseArgs(['--plan'])).toThrow(/requires a value/);
  });

  it('throws when --plan is followed by another flag', () => {
    expect(() => parseArgs(['--plan', '-only-testing:foo'])).toThrow(/requires a value/);
  });
});
