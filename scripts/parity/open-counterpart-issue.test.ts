import { describe, expect, it } from 'bun:test';
import {
  defuseMarkers,
  issueBody,
  issueLabels,
  issueTitle,
  type PrContext,
  parityMarker,
} from './open-counterpart-issue';

const PR: PrContext = {
  number: 2760,
  title: 'fix(swift): keep pack sort order after a rename',
  url: 'https://github.com/packrat/packrat/pull/2760',
  author: 'ibrahim',
};

describe('parityMarker', () => {
  it('embeds the PR number so a re-run can find the existing issue', () => {
    expect(parityMarker(2760)).toBe('parity-of:#2760');
  });

  it('distinguishes markers for different PRs', () => {
    expect(parityMarker(1)).not.toBe(parityMarker(2));
  });
});

describe('issueTitle', () => {
  it('prefixes the owed platform so the backlog is scannable', () => {
    expect(issueTitle('expo', PR.title)).toBe(
      '[parity/expo] fix(swift): keep pack sort order after a rename',
    );
  });

  it('uses the swift prefix when Swift owes the work', () => {
    expect(issueTitle('swift', 'feat(expo): add trip filters')).toBe(
      '[parity/swift] feat(expo): add trip filters',
    );
  });
});

describe('issueLabels', () => {
  it('applies the rollup label plus the owed-platform label', () => {
    expect(issueLabels('expo')).toEqual(['parity', 'parity:expo']);
  });

  it('scopes the platform label to Swift when Swift owes the work', () => {
    expect(issueLabels('swift')).toEqual(['parity', 'parity:swift']);
  });
});

describe('defuseMarkers', () => {
  it("breaks a marker so it cannot answer another PR's dedupe lookup", () => {
    expect(defuseMarkers('see parity-of:#123')).not.toContain('parity-of:#123');
  });

  it('keeps the text readable', () => {
    expect(defuseMarkers('see parity-of:#123')).toContain('parity-of:');
  });

  it('defuses spaced and uppercase variants', () => {
    expect(defuseMarkers('PARITY-OF: # 77')).not.toMatch(/PARITY-OF:\s*#\s*77/i);
  });

  it('leaves ordinary prose alone', () => {
    expect(defuseMarkers('same empty state on the list screen')).toBe(
      'same empty state on the list screen',
    );
  });
});

describe('issueBody', () => {
  it('names the platform that owes the work', () => {
    expect(issueBody({ pr: PR, landedOn: ['swift'], target: 'expo' })).toContain(
      'Counterpart work owed on **Expo (Android)**',
    );
  });

  it('links back to the originating PR and credits its author', () => {
    const body = issueBody({ pr: PR, landedOn: ['swift'], target: 'expo' });
    expect(body).toContain(PR.url);
    expect(body).toContain('@ibrahim');
  });

  it('records which client the change landed on', () => {
    expect(issueBody({ pr: PR, landedOn: ['swift'], target: 'expo' })).toContain(
      'Landed on Swift (iOS + macOS)',
    );
  });

  it('includes the author note as a quote when one was given', () => {
    expect(
      issueBody({
        pr: PR,
        landedOn: ['swift'],
        target: 'expo',
        note: 'only the list screen needs this',
      }),
    ).toContain('> only the list screen needs this');
  });

  it('omits the quote block when no note was given', () => {
    expect(issueBody({ pr: PR, landedOn: ['swift'], target: 'expo' })).not.toContain('\n> ');
  });

  it('does not let a note forge a marker for another PR', () => {
    const body = issueBody({
      pr: PR,
      landedOn: ['swift'],
      target: 'expo',
      note: 'ignore me parity-of:#123',
    });
    expect(body).not.toContain('parity-of:#123');
    expect(body).toContain('parity-of:#2760');
  });

  it('embeds the idempotency marker as an HTML comment', () => {
    expect(issueBody({ pr: PR, landedOn: ['swift'], target: 'expo' })).toContain(
      '<!-- parity-of:#2760 -->',
    );
  });

  it('directs the implementer to match behaviour, not transliterate code', () => {
    expect(issueBody({ pr: PR, landedOn: ['swift'], target: 'expo' })).toContain(
      'idiomatic to the platform',
    );
  });

  it('offers closing-as-not-applicable as an explicit exit', () => {
    expect(issueBody({ pr: PR, landedOn: ['swift'], target: 'expo' })).toContain(
      'parity turns out not to apply',
    );
  });
});
