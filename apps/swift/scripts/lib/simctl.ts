import { execFileSync } from 'node:child_process';

const UDID_RE = /^[0-9A-F-]{36}$/;

type Device = {
  udid: string;
  name: string;
  state: string;
  runtime: string;
};

type DevicesByRuntime = Record<string, Array<Omit<Device, 'runtime'>>>;

export class SimctlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SimctlError';
  }
}

function runSimctl(args: readonly string[]): string {
  try {
    return execFileSync('xcrun', ['simctl', ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new SimctlError(`xcrun simctl ${args.join(' ')} failed: ${message}`);
  }
}

function parseDeviceListJson(json: string): Device[] {
  let parsed: { devices?: DevicesByRuntime };
  try {
    parsed = JSON.parse(json) as { devices?: DevicesByRuntime };
  } catch {
    throw new SimctlError('xcrun simctl list devices -j returned malformed JSON');
  }
  const out: Device[] = [];
  for (const [runtime, devices] of Object.entries(parsed.devices ?? {})) {
    for (const d of devices) {
      out.push({ udid: d.udid, name: d.name, state: d.state, runtime });
    }
  }
  return out;
}

export function listBootedFromJson(json: string): string[] {
  return parseDeviceListJson(json)
    .filter((d) => d.state === 'Booted')
    .map((d) => d.udid);
}

export function listBootedIOSFromJson(json: string): string[] {
  return parseDeviceListJson(json)
    .filter((d) => d.state === 'Booted' && d.runtime.includes('SimRuntime.iOS'))
    .map((d) => d.udid);
}

export function listBooted(): string[] {
  return listBootedFromJson(runSimctl(['list', 'devices', '-j']));
}

export function listBootedIOS(): string[] {
  return listBootedIOSFromJson(runSimctl(['list', 'devices', '-j']));
}

export function findDeviceUDIDFromJson({ json, name }: { json: string; name: string }): string {
  const devices = parseDeviceListJson(json);
  const match = devices.find((d) => d.name === name);
  if (!match) {
    const available = devices.map((d) => d.name).join(', ');
    throw new SimctlError(
      `No simulator named "${name}" is registered. Available: ${available || '<none>'}`,
    );
  }
  return match.udid;
}

export function findDeviceUDID(name: string): string {
  return findDeviceUDIDFromJson({ json: runSimctl(['list', 'devices', '-j']), name });
}

export function isUDID(value: string): boolean {
  return UDID_RE.test(value);
}

export function boot(udid: string): void {
  if (!isUDID(udid)) {
    throw new SimctlError(`Refusing to boot non-UDID value "${udid}"`);
  }
  runSimctl(['boot', udid]);
}

export function shutdown(udid: string): void {
  if (!isUDID(udid)) {
    throw new SimctlError(`Refusing to shutdown non-UDID value "${udid}"`);
  }
  runSimctl(['shutdown', udid]);
}

export function ensureBooted(name: string): string {
  const booted = listBooted();
  const first = booted[0];
  if (first !== undefined) return first;
  const udid = findDeviceUDID(name);
  boot(udid);
  return udid;
}
