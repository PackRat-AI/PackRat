import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findDeviceUDIDFromJson, isUDID, listBootedFromJson, SimctlError } from '../lib/simctl';

const FIXTURE = readFileSync(resolve(__dirname, 'fixtures/devices-booted.json'), 'utf8');

describe('listBootedFromJson', () => {
  it('extracts Booted device UDIDs from simctl JSON', () => {
    expect(listBootedFromJson(FIXTURE)).toEqual(['626B2C47-CC06-46AF-8132-70E9D866AEA8']);
  });

  it('returns empty array when no devices are booted', () => {
    expect(listBootedFromJson('{"devices": {}}')).toEqual([]);
  });

  it('returns empty array when the devices key is missing entirely', () => {
    expect(listBootedFromJson('{}')).toEqual([]);
  });

  it('throws SimctlError on malformed JSON', () => {
    expect(() => listBootedFromJson('not json')).toThrow(SimctlError);
  });
});

describe('findDeviceUDIDFromJson', () => {
  it('returns the UDID of the named device', () => {
    expect(findDeviceUDIDFromJson({ json: FIXTURE, name: 'iPhone 17 Pro Max' })).toBe(
      '80CB45AB-289A-49C9-BCF6-DC2FEE265A68',
    );
  });

  it('throws a SimctlError listing available device names when no match exists', () => {
    expect(() => findDeviceUDIDFromJson({ json: FIXTURE, name: 'iPhone 99' })).toThrow(
      /iPhone 17 Pro/,
    );
  });

  it('throws SimctlError on malformed JSON', () => {
    expect(() => findDeviceUDIDFromJson({ json: 'not json', name: 'iPhone 17 Pro' })).toThrow(
      SimctlError,
    );
  });
});

describe('isUDID', () => {
  it('accepts a canonical UUID', () => {
    expect(isUDID('626B2C47-CC06-46AF-8132-70E9D866AEA8')).toBe(true);
  });

  it('rejects shell-metachar payloads', () => {
    expect(isUDID('626B2C47-CC06-46AF-8132-70E9D866AEA8; rm -rf /')).toBe(false);
  });

  it('rejects short strings', () => {
    expect(isUDID('abc')).toBe(false);
  });

  it('rejects lowercase hex (simctl emits uppercase only)', () => {
    expect(isUDID('626b2c47-cc06-46af-8132-70e9d866aea8')).toBe(false);
  });
});
