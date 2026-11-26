import { describe, expect, it } from 'bun:test';
import {
  type Codebase,
  extractParityBlock,
  isPlatform,
  otherPlatform,
  parseParityDeclaration,
  platformsTouched,
  splitFollowTargets,
  stripHtmlComments,
  stripTemplateNoise,
} from './check-parity-declaration';

const SWIFT_ONLY: Codebase[] = ['swift'];
const EXPO_ONLY: Codebase[] = ['expo'];
const BOTH: Codebase[] = ['swift', 'expo'];

function body(parity: string): string {
  return `## Description\n\nSomething changed.\n\n## Parity\n\n${parity}\n\n## Testing\n\n- [x] unit\n`;
}

describe('platformsTouched', () => {
  it('detects the swift client from a source path', () => {
    expect(platformsTouched(['apps/swift/Sources/PackRat/Features/Packs/PackList.swift'])).toEqual([
      'swift',
    ]);
  });

  it('detects the expo client from a source path', () => {
    expect(platformsTouched(['apps/expo/features/packs/screens/PackList.tsx'])).toEqual(['expo']);
  });

  it('detects both clients when a PR spans them', () => {
    expect(
      platformsTouched(['apps/swift/Sources/PackRat/App.swift', 'apps/expo/app/(app)/index.tsx']),
    ).toEqual(['swift', 'expo']);
  });

  it('returns nothing for non-client changes so backend PRs are exempt', () => {
    expect(platformsTouched(['packages/api/src/routes/packs.ts', 'docs/testing.md'])).toEqual([]);
  });

  it('does not match a path that merely contains a platform name', () => {
    expect(platformsTouched(['docs/apps/swift/notes.md'])).toEqual([]);
  });
});

describe('extractParityBlock', () => {
  it('returns the section content up to the next heading', () => {
    expect(extractParityBlock(body('follow: expo'))?.trim()).toBe('follow: expo');
  });

  it('returns null when the section is absent', () => {
    expect(extractParityBlock('## Description\n\nno parity here\n')).toBeNull();
  });

  it('reads to end of body when Parity is the last section', () => {
    expect(extractParityBlock('## Parity\n\ndone-both\n')?.trim()).toBe('done-both');
  });

  it('matches the heading case-insensitively', () => {
    expect(extractParityBlock('## PARITY\n\ndone-both\n')?.trim()).toBe('done-both');
  });
});

describe('stripTemplateNoise', () => {
  it('removes HTML comments so template hints are not parsed as directives', () => {
    expect(stripTemplateNoise('<!-- follow: expo -->\ndone-both')).not.toContain('follow');
  });

  it('removes unchecked checkboxes so untouched template options are ignored', () => {
    const cleaned = stripTemplateNoise('- [ ] follow: expo\n- [x] done-both');
    expect(cleaned).not.toContain('follow');
    expect(cleaned).toContain('done-both');
  });
});

describe('stripHtmlComments', () => {
  it('removes a plain comment', () => {
    expect(stripHtmlComments('a<!-- x -->b')).toBe('ab');
  });

  it('ends a comment at the first --> , as HTML comments do not nest', () => {
    // A renderer closes at the first `-->`, leaving the tail visible. The
    // linter must agree with what a reviewer actually sees.
    expect(stripHtmlComments('<!-- <!-- --> tail -->')).toBe(' tail -->');
  });

  it('removes several comments in one string', () => {
    expect(stripHtmlComments('a<!--x-->b<!--y-->c')).toBe('abc');
  });

  it('never leaves a live comment opener behind', () => {
    expect(stripHtmlComments('<!--a--><!--b-->keep')).not.toContain('<!--');
  });

  it('drops the remainder after an unterminated comment opener', () => {
    // Renders as commented-out on GitHub, so it must not be parsed as content.
    expect(stripHtmlComments('keep<!-- hidden forever')).toBe('keep');
  });

  it('leaves text without comments untouched', () => {
    expect(stripHtmlComments('follow: expo')).toBe('follow: expo');
  });
});

describe('parseParityDeclaration — valid declarations', () => {
  it('accepts a follow directive naming the other platform', () => {
    const result = parseParityDeclaration(body('follow: expo'), SWIFT_ONLY);
    expect(result.violations).toEqual([]);
    expect(result.directive).toEqual({ kind: 'follow', targets: ['expo'] });
  });

  it('captures the trailing note on a follow directive', () => {
    const result = parseParityDeclaration(body('follow: expo needs the same empty state'), [
      'swift',
    ]);
    expect(result.directive).toEqual({
      kind: 'follow',
      targets: ['expo'],
      note: 'needs the same empty state',
    });
  });

  it('accepts done-both', () => {
    const result = parseParityDeclaration(body('done-both'), BOTH);
    expect(result.violations).toEqual([]);
    expect(result.directive).toEqual({ kind: 'done-both' });
  });

  it('accepts n/a with a reason and preserves that reason', () => {
    const result = parseParityDeclaration(body('n/a: macOS window management only'), SWIFT_ONLY);
    expect(result.violations).toEqual([]);
    expect(result.directive).toEqual({ kind: 'n-a', reason: 'macOS window management only' });
  });

  it('accepts a checked-checkbox directive as written by the PR template', () => {
    const result = parseParityDeclaration(body('- [x] follow: swift'), EXPO_ONLY);
    expect(result.directive).toEqual({ kind: 'follow', targets: ['swift'] });
  });

  it('tolerates a missing colon after follow', () => {
    const result = parseParityDeclaration(body('follow expo'), SWIFT_ONLY);
    expect(result.directive).toEqual({ kind: 'follow', targets: ['expo'] });
  });

  it('tolerates trailing punctuation on the platform name', () => {
    const result = parseParityDeclaration(body('follow: expo.'), SWIFT_ONLY);
    expect(result.directive).toEqual({ kind: 'follow', targets: ['expo'] });
  });
});

describe('parseParityDeclaration — violations', () => {
  it('flags a missing Parity section', () => {
    const result = parseParityDeclaration('## Description\n\nchanged a view\n', SWIFT_ONLY);
    expect(result.violations.map((v) => v.kind)).toEqual(['missing-block']);
    expect(result.directive).toBeNull();
  });

  it('flags a Parity section that declares nothing', () => {
    const result = parseParityDeclaration(body('<!-- pick one -->'), SWIFT_ONLY);
    expect(result.violations.map((v) => v.kind)).toEqual(['no-directive']);
  });

  it('flags an unchecked-only template block as declaring nothing', () => {
    const result = parseParityDeclaration(
      body('- [ ] follow: expo\n- [ ] done-both\n- [ ] n/a:'),
      SWIFT_ONLY,
    );
    expect(result.violations.map((v) => v.kind)).toEqual(['no-directive']);
  });

  it('ignores a directive that sits entirely inside a comment', () => {
    const result = parseParityDeclaration(body('<!-- follow: expo -->'), SWIFT_ONLY);
    expect(result.violations.map((v) => v.kind)).toEqual(['no-directive']);
  });

  it('ignores everything after an unterminated comment opener', () => {
    // Renders as commented-out, so CI must not credit it as a declaration.
    const result = parseParityDeclaration(body('<!-- oops\nfollow: expo'), SWIFT_ONLY);
    expect(result.violations.map((v) => v.kind)).toEqual(['no-directive']);
  });

  it('flags an unknown platform name', () => {
    const result = parseParityDeclaration(body('follow: android'), SWIFT_ONLY);
    expect(result.violations.map((v) => v.kind)).toEqual(['bad-platform']);
    expect(result.violations[0]?.detail).toContain('android');
  });

  it('flags following the platform the PR already landed on', () => {
    const result = parseParityDeclaration(body('follow: swift'), SWIFT_ONLY);
    expect(result.violations.map((v) => v.kind)).toEqual(['self-follow']);
    expect(result.violations[0]?.detail).toContain('follow: expo');
  });

  it('allows follow naming either platform when the PR touched both', () => {
    const result = parseParityDeclaration(body('follow: swift'), BOTH);
    expect(result.violations).toEqual([]);
    expect(result.directive).toEqual({ kind: 'follow', targets: ['swift'] });
  });

  it('flags n/a with no reason', () => {
    const result = parseParityDeclaration(body('n/a:'), SWIFT_ONLY);
    expect(result.violations.map((v) => v.kind)).toEqual(['missing-reason']);
  });

  it('flags more than one directive as ambiguous', () => {
    const result = parseParityDeclaration(body('follow: expo\ndone-both'), SWIFT_ONLY);
    expect(result.violations.map((v) => v.kind)).toEqual(['ambiguous']);
    expect(result.directive).toBeNull();
  });

  it('accepts mac alone when an iOS-only Swift change leaves the Mac behind', () => {
    const result = parseParityDeclaration(body('follow: mac'), SWIFT_ONLY);
    expect(result.violations).toEqual([]);
    expect(result.directive).toEqual({ kind: 'follow', targets: ['mac'] });
  });

  it('accepts several targets with a note, so iOS can lead and Mac and Android follow', () => {
    const result = parseParityDeclaration(body('follow: mac, expo same intro screens'), SWIFT_ONLY);
    expect(result.violations).toEqual([]);
    expect(result.directive).toEqual({
      kind: 'follow',
      targets: ['mac', 'expo'],
      note: 'same intro screens',
    });
  });

  it('drops mac when swift is also owed, since swift already covers the Mac', () => {
    const result = parseParityDeclaration(body('follow: swift+mac'), EXPO_ONLY);
    expect(result.directive).toEqual({ kind: 'follow', targets: ['swift'] });
  });

  it('flags a self-follow hidden in a target list', () => {
    const result = parseParityDeclaration(body('follow: mac, swift'), SWIFT_ONLY);
    expect(result.violations.map((v) => v.kind)).toEqual(['self-follow']);
    expect(result.violations[0]?.detail).toContain('follow: mac');
  });

  it('accepts done-all as the every-client spelling of done-both', () => {
    const result = parseParityDeclaration(body('- [x] done-all'), BOTH);
    expect(result.directive).toEqual({ kind: 'done-both' });
  });

  it('withholds a directive whenever any violation is present', () => {
    const result = parseParityDeclaration(body('follow: nonsense'), SWIFT_ONLY);
    expect(result.directive).toBeNull();
  });
});

describe('splitFollowTargets', () => {
  it('stops at the first word that is not a platform', () => {
    expect(splitFollowTargets('mac and expo, then web')).toEqual({
      targets: ['mac', 'expo'],
      unknown: null,
      note: 'then web',
    });
  });

  it('reports the first token when no platform leads', () => {
    expect(splitFollowTargets('android soon').unknown).toBe('android');
  });
});

describe('platform helpers', () => {
  it('recognises both codebases and the Mac as follow targets', () => {
    expect(isPlatform('swift')).toBe(true);
    expect(isPlatform('expo')).toBe(true);
    expect(isPlatform('mac')).toBe(true);
  });

  it('rejects OS names, which are not the unit of parity', () => {
    expect(isPlatform('ios')).toBe(false);
    expect(isPlatform('macos')).toBe(false);
  });

  it('maps each platform to its counterpart', () => {
    expect(otherPlatform('swift')).toBe('expo');
    expect(otherPlatform('expo')).toBe('swift');
  });
});
