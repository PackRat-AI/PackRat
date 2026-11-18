import type { OfflineDownloadFailure } from '../types';

export type ConnectionKind = 'wifi' | 'cellular' | 'none' | 'other';

/**
 * Whether a download may run on this connection. The Android SDK binding downloads over any
 * network, so the Wi-Fi-only default is enforced here: on cellular a download waits for Wi-Fi
 * unless the user allowed cellular. With no connection it waits rather than failing.
 */
export function mayDownload({
  connection,
  allowCellular,
}: {
  connection: ConnectionKind;
  allowCellular: boolean;
}): boolean {
  if (connection === 'none') return false;
  if (connection === 'cellular') return allowCellular;
  return true;
}

const CANCELED = /cancel/i;
const TOO_LARGE = /tile ?count|tile.*limit|exceed/i;
const DISK_FULL = /disk|space|storage full/i;

/**
 * Reads a tile store error message as what the user can act on, or `canceled` when the download
 * was stopped on purpose (paused for Wi-Fi, cancelled, or replaced by an update).
 */
export function failureFromMessage(message: string): OfflineDownloadFailure | 'canceled' {
  if (CANCELED.test(message)) return 'canceled';
  if (TOO_LARGE.test(message)) return 'tooLarge';
  if (DISK_FULL.test(message)) return 'diskFull';
  return 'failed';
}
