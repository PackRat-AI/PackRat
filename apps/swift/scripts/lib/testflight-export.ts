import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export class TestFlightExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TestFlightExportError';
  }
}

export function findExportedIPA(exportDir: string): string {
  const ipaFiles = readdirSync(exportDir)
    .filter((file) => file.endsWith('.ipa'))
    .sort();

  if (ipaFiles.length === 0) {
    throw new TestFlightExportError(`No .ipa file found in ${exportDir}.`);
  }
  if (ipaFiles.length > 1) {
    throw new TestFlightExportError(
      `Expected one .ipa file in ${exportDir}, found: ${ipaFiles.join(', ')}.`,
    );
  }

  return join(exportDir, ipaFiles[0]);
}
