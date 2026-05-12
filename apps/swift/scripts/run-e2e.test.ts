import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  buildUITestEnv,
  buildXcodeEnv,
  loadDotEnv,
  parseArgs,
  pickIOSDestination,
  redactSecrets,
} from './run-e2e';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

function tempFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'packrat-swift-e2e-'));
  tempDirs.push(dir);
  const path = join(dir, '.env.local');
  writeFileSync(path, contents);
  return path;
}

describe('parseArgs', () => {
  test('defaults to ios-ui for legacy invocation', () => {
    expect(parseArgs(['-only-testing:PackRatUITests/AuthTests']).mode).toBe('ios-ui');
    expect(parseArgs(['-only-testing:PackRatUITests/AuthTests']).passthrough).toEqual([
      '-only-testing:PackRatUITests/AuthTests',
    ]);
  });

  test('accepts an explicit mode', () => {
    expect(parseArgs(['unit'])).toEqual({ mode: 'unit', passthrough: [] });
    expect(parseArgs(['ios-smoke'])).toEqual({ mode: 'ios-smoke', passthrough: [] });
    expect(parseArgs(['mac-build', 'CODE_SIGNING_ALLOWED=NO'])).toEqual({
      mode: 'mac-build',
      passthrough: ['CODE_SIGNING_ALLOWED=NO'],
    });
    expect(parseArgs(['mac-smoke'])).toEqual({ mode: 'mac-smoke', passthrough: [] });
    expect(parseArgs(['mac-ui'])).toEqual({ mode: 'mac-ui', passthrough: [] });
  });
});

describe('loadDotEnv', () => {
  test('loads quoted values and preserves existing environment values', () => {
    const env = { E2E_EMAIL: 'already-set@example.com' };
    loadDotEnv(
      tempFile(`
E2E_EMAIL="from-file@example.com"
E2E_PASSWORD='secret-password'
EMPTY_LINE_TEST=value
`),
      env,
    );

    expect(env.E2E_EMAIL).toBe('already-set@example.com');
    expect(env.E2E_PASSWORD).toBe('secret-password');
    expect(env.EMPTY_LINE_TEST).toBe('value');
  });
});

describe('pickIOSDestination', () => {
  test('uses a booted iPhone when one exists', () => {
    const output = `
== Devices ==
-- iOS 26.2 --
    iPhone 17 (11111111-1111-1111-1111-111111111111) (Booted)
`;

    expect(pickIOSDestination(output)).toBe(
      'platform=iOS Simulator,id=11111111-1111-1111-1111-111111111111',
    );
  });

  test('prefers an available iPhone 17 over other shutdown phones', () => {
    const output = `
== Devices ==
-- iOS 26.2 --
    iPhone 16e (22222222-2222-2222-2222-222222222222) (Shutdown)
    iPhone 17 (33333333-3333-3333-3333-333333333333) (Shutdown)
`;

    expect(pickIOSDestination(output)).toBe(
      'platform=iOS Simulator,id=33333333-3333-3333-3333-333333333333',
    );
  });

  test('falls back to an iPhone 17 name when no devices parse', () => {
    expect(pickIOSDestination('== Devices ==')).toBe('platform=iOS Simulator,name=iPhone 17');
  });
});

describe('redactSecrets', () => {
  test('redacts credential-like environment values', () => {
    const env = {
      E2E_EMAIL: 'person@example.com',
      E2E_PASSWORD: 'super-secret',
      NORMAL_VALUE: 'visible',
    };

    expect(redactSecrets('person@example.com super-secret visible', env)).toBe(
      '<redacted> <redacted> visible',
    );
  });
});

describe('buildUITestEnv', () => {
  test('injects UI test environment with configured screenshot directory when set', () => {
    expect(
      buildUITestEnv({
        email: 'person@example.com',
        password: 'secret',
        env: {
          E2E_API_BASE_URL: 'http://localhost:8788',
          E2E_SCREENSHOT_DIR: '/tmp/packrat-screenshots',
        },
      }),
    ).toEqual({
      E2E_EMAIL: 'person@example.com',
      E2E_PASSWORD: 'secret',
      E2E_API_BASE_URL: 'http://localhost:8788',
      E2E_SCREENSHOT_DIR: '/tmp/packrat-screenshots',
    });
  });

  test('defaults screenshot directory for visual smoke tests', () => {
    expect(buildUITestEnv({ email: 'person@example.com', password: 'secret' })).toMatchObject({
      E2E_EMAIL: 'person@example.com',
      E2E_PASSWORD: 'secret',
      E2E_SCREENSHOT_DIR: expect.stringContaining('apps/swift/TestResults/screenshots'),
    });
  });
});

describe('buildXcodeEnv', () => {
  test('keeps build essentials without forwarding secrets', () => {
    expect(
      buildXcodeEnv({
        HOME: '/Users/test',
        PATH: '/usr/bin',
        E2E_PASSWORD: 'secret',
        OPENAI_API_KEY: 'secret',
      }),
    ).toEqual({
      HOME: '/Users/test',
      PATH: '/usr/bin',
    });
  });
});
