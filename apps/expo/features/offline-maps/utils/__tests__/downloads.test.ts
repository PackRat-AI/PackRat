import { describe, expect, it } from 'vitest';
import { failureFromMessage, mayDownload } from '../downloads';

describe('mayDownload', () => {
  it.each([
    { connection: 'wifi', allowCellular: false, expected: true },
    { connection: 'other', allowCellular: false, expected: true },
    { connection: 'cellular', allowCellular: false, expected: false },
    { connection: 'cellular', allowCellular: true, expected: true },
    { connection: 'none', allowCellular: true, expected: false },
  ] as const)('on $connection with cellular allowed $allowCellular: $expected', (row) => {
    expect(mayDownload(row)).toBe(row.expected);
  });
});

describe('failureFromMessage', () => {
  it.each([
    ['Operation was canceled', 'canceled'],
    ['Tile count exceeded the limit', 'tooLarge'],
    ['TileCountExceeded: 812 packs', 'tooLarge'],
    ['Disk is full', 'diskFull'],
    ['Not enough space', 'diskFull'],
    ['Network error', 'failed'],
  ] as const)('reads "%s" as %s', (message, expected) => {
    expect(failureFromMessage(message)).toBe(expected);
  });
});
