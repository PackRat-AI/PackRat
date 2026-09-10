import { describe, expect, it } from 'bun:test';
import {
  ageInDays,
  findStaleGaps,
  type GapIssue,
  platformFromLabels,
  renderReport,
  toGaps,
} from './parity-gaps-report';

const NOW = new Date('2026-09-10T12:00:00Z');

function issue(overrides: Partial<GapIssue> = {}): GapIssue {
  return {
    number: 1,
    title: 'Port pack sorting to Expo',
    url: 'https://github.com/packrat/packrat/issues/1',
    createdAt: '2026-09-01T12:00:00Z',
    labels: [{ name: 'parity' }, { name: 'parity:expo' }],
    ...overrides,
  };
}

describe('ageInDays', () => {
  it('counts whole days since creation', () => {
    expect(ageInDays('2026-09-01T12:00:00Z', NOW)).toBe(9);
  });

  it('reports zero for an issue created moments ago', () => {
    expect(ageInDays('2026-09-10T11:00:00Z', NOW)).toBe(0);
  });

  it('clamps a future timestamp to zero rather than going negative', () => {
    expect(ageInDays('2026-12-01T00:00:00Z', NOW)).toBe(0);
  });

  it('falls back to zero on an unparseable timestamp', () => {
    expect(ageInDays('not-a-date', NOW)).toBe(0);
  });
});

describe('platformFromLabels', () => {
  it('reads the owed platform from a parity:<platform> label', () => {
    expect(platformFromLabels([{ name: 'parity' }, { name: 'parity:swift' }])).toBe('swift');
  });

  it('returns unknown when only the bare parity label is present', () => {
    expect(platformFromLabels([{ name: 'parity' }])).toBe('unknown');
  });

  it('ignores a parity: label naming something that is not a platform', () => {
    expect(platformFromLabels([{ name: 'parity:ios' }])).toBe('unknown');
  });
});

describe('toGaps', () => {
  it('sorts gaps oldest first so the top of the list is what needs attention', () => {
    const gaps = toGaps(
      [
        issue({ number: 1, createdAt: '2026-09-09T12:00:00Z' }),
        issue({ number: 2, createdAt: '2026-07-01T12:00:00Z' }),
        issue({ number: 3, createdAt: '2026-08-15T12:00:00Z' }),
      ],
      NOW,
    );
    expect(gaps.map((gap) => gap.number)).toEqual([2, 3, 1]);
  });

  it('carries issue identity and computed platform through', () => {
    const [gap] = toGaps([issue({ number: 42, labels: [{ name: 'parity:swift' }] })], NOW);
    expect(gap).toMatchObject({ number: 42, platform: 'swift', ageDays: 9 });
  });

  it('returns nothing when there are no open gaps', () => {
    expect(toGaps([], NOW)).toEqual([]);
  });
});

describe('renderReport', () => {
  it('states plainly that the clients are level when there are no gaps', () => {
    const report = renderReport([], NOW);
    expect(report).toContain('**No open parity gaps.**');
    expect(report).not.toContain('| Age |');
  });

  it('marks the file as generated so nobody hand-edits it', () => {
    expect(renderReport([], NOW)).toContain('do not edit');
  });

  it('counts open gaps per platform in the summary', () => {
    const report = renderReport(
      toGaps(
        [
          issue({ number: 1, labels: [{ name: 'parity:expo' }] }),
          issue({ number: 2, labels: [{ name: 'parity:expo' }] }),
          issue({ number: 3, labels: [{ name: 'parity:swift' }] }),
        ],
        NOW,
      ),
      NOW,
    );
    expect(report).toContain('| Swift (iOS + macOS) | 1 |');
    expect(report).toContain('| Expo (Android) | 2 |');
  });

  it('flags a gap older than 30 days so it cannot sit unnoticed', () => {
    const report = renderReport(toGaps([issue({ createdAt: '2026-06-01T12:00:00Z' })], NOW), NOW);
    expect(report).toContain('⚠️ 101d');
  });

  it('leaves a recent gap unflagged', () => {
    const report = renderReport(toGaps([issue()], NOW), NOW);
    expect(report).toContain('| 9d |');
    expect(report).not.toContain('⚠️');
  });

  it('links each gap back to its issue', () => {
    const report = renderReport(toGaps([issue({ number: 77 })], NOW), NOW);
    expect(report).toContain('[#77](https://github.com/packrat/packrat/issues/1)');
  });
});

describe('findStaleGaps', () => {
  const gaps = toGaps(
    [
      issue({ number: 1, createdAt: '2026-09-08T12:00:00Z' }),
      issue({ number: 2, createdAt: '2026-06-01T12:00:00Z' }),
    ],
    NOW,
  );

  it('returns only gaps past the threshold', () => {
    expect(findStaleGaps(gaps, 30).map((gap) => gap.number)).toEqual([2]);
  });

  it('treats the threshold as exclusive', () => {
    expect(findStaleGaps(gaps, 101)).toEqual([]);
  });
});
