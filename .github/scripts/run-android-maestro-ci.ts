import { mkdir } from 'node:fs/promises';
import { nodeEnv } from '@packrat/env/node';

async function run(command: string[], opts: { allowFailure?: boolean } = {}) {
  const child = Bun.spawn(command, {
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const exitCode = await child.exited;
  if (exitCode !== 0 && !opts.allowFailure) {
    throw new Error(`${command.join(' ')} exited with ${exitCode}`);
  }
  return exitCode;
}

async function output(command: string[]) {
  const child = Bun.spawn(command, {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, exitCode] = await Promise.all([new Response(child.stdout).text(), child.exited]);
  if (exitCode !== 0) return '';
  return stdout.trim();
}

async function waitForReadyDevice() {
  await run(['adb', 'wait-for-device']);

  for (let i = 0; i < 30; i++) {
    const state = await output(['adb', 'get-state']);
    const boot = (await output(['adb', 'shell', 'getprop', 'sys.boot_completed'])).replace(
      /\r/g,
      '',
    );

    if (state === 'device' && boot === '1') return;
    await Bun.sleep(1000);
  }

  console.error('Android device did not become ready. adb devices:');
  await run(['adb', 'devices', '-l'], { allowFailure: true });
  throw new Error('Android device did not become ready');
}

await mkdir('test-results', { recursive: true });
const appId = nodeEnv.APP_ID;
if (!appId) {
  throw new Error('APP_ID is required for Android Maestro CI');
}

await waitForReadyDevice();
await run(['adb', 'install', '-r', '-d', 'apps/expo/build/PackRat.apk']);
await waitForReadyDevice();
await run(['adb', 'shell', 'pm', 'path', appId]);
await run(['adb', 'shell', 'monkey', '-p', appId, '-c', 'android.intent.category.LAUNCHER', '1']);
await waitForReadyDevice();
await run(['adb', 'shell', 'input', 'keyevent', 'KEYCODE_BACK'], { allowFailure: true });
await run(['adb', 'shell', 'input', 'keyevent', 'KEYCODE_BACK'], { allowFailure: true });
await run([
  'bun',
  'run',
  '.maestro/run-suite.ts',
  'android',
  '--format',
  'junit',
  '--output',
  'test-results/maestro-results.xml',
]);
