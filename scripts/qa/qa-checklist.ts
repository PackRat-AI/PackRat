#!/usr/bin/env bun
//
// qa-checklist.ts — turns the prose beta test plans in `docs/qa/` into
// per-platform GitHub issue checklists, plus a rollup release gate.
//
// The plans are the single source of truth. They get rewritten between
// rounds, so the checklists are *generated* rather than hand-copied — run
// this again after a plan changes and the bodies are regenerated from the
// current markdown.
//
// Each `- ` bullet in a plan is one test item and becomes one `- [ ]`
// checkbox. Bullets under "Before you start" are setup instructions rather
// than tests, so they're skipped.
//
// The two plans are shaped differently, which is why splitting is
// configured per plan rather than inferred:
//
//   apple-platforms — `##` sections *are* the platforms (iPhone / Mac /
//                     Apple Watch), so each becomes its own issue.
//   pack-tools      — `##` sections are features (Ask AI, Add from
//                     Catalog, ...) with a single trailing `## Mac`. The
//                     feature sections are the iPhone pass; `## Mac` is
//                     the Mac pass, which also says to re-run the iPhone
//                     list. So: two issues, split at `## Mac`.
//
// Usage:
//   bun run qa:checklist                    # print bodies to stdout
//   bun run qa:checklist --create           # create the issues on GitHub
//   bun run qa:checklist --plan pack-tools  # limit to one plan
//
// `--create` is deliberately opt-in: without it the script only prints,
// so the output can be reviewed before anything reaches the tracker.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** A single `- ` bullet from a plan: one thing a tester does. */
export interface TestItem {
  /** The `###` (or `##`) heading the bullet sits under, for grouping. */
  section: string;
  /** Bullet text, newlines collapsed to single spaces. */
  text: string;
}

/** One generated issue: a platform's worth of test items. */
export interface Checklist {
  /** Issue title, e.g. `[QA] Pack tools — Mac`. */
  title: string;
  /** Platform label used in the body's attribution line. */
  platform: string;
  items: TestItem[];
  /** Repo-relative path of the plan this came from. */
  source: string;
  /** Rendered when the Mac/Watch pass also re-runs another platform's list. */
  alsoRun?: string;
}

/**
 * How a plan splits into per-platform issues.
 *
 * `splitAt` names the `##` headings that open a new platform. Sections
 * before the first one belong to `leadPlatform` — that covers pack-tools,
 * where the feature sections are the iPhone pass.
 */
interface PlanConfig {
  file: string;
  /** Short name used in issue titles. */
  label: string;
  splitAt: readonly string[];
  leadPlatform?: string;
  /** Platform → the other platform whose list it also re-runs. */
  alsoRun?: Readonly<Record<string, string>>;
}

/** Bullets here are tester setup, not test items. */
const SETUP_SECTIONS = Object.freeze(['Before you start', 'Reporting'] as const);

// Hoisted: `parsePlan` runs these per line, and recompiling in the loop is
// what `lint/performance/useTopLevelRegex` exists to catch.
const H2 = /^## (.+)$/;
const H3 = /^### (.+)$/;
const BULLET = /^- (.+)$/;
/** An indented, non-empty line: the continuation of a wrapped bullet. */
const CONTINUATION = /^\s+\S/;

export const PLANS: Readonly<Record<string, PlanConfig>> = Object.freeze({
  'apple-platforms': {
    file: 'docs/qa/apple-platforms-beta-test-plan.md',
    label: 'Apple platforms',
    splitAt: ['iPhone', 'Mac', 'Apple Watch'],
    alsoRun: Object.freeze({ Mac: 'iPhone' }),
  },
  'pack-tools': {
    file: 'docs/qa/pack-tools-beta-test-plan.md',
    label: 'Pack tools',
    splitAt: ['Mac'],
    leadPlatform: 'iPhone',
    alsoRun: Object.freeze({ Mac: 'iPhone' }),
  },
  'native-controls': {
    file: 'docs/qa/native-controls-beta-test-plan.md',
    label: 'Native controls',
    splitAt: ['Mac'],
    leadPlatform: 'iPhone',
    alsoRun: Object.freeze({ Mac: 'iPhone' }),
  },
});

/**
 * Splits a plan's markdown into per-platform checklists.
 *
 * Walks the document line by line tracking the current `##` platform and
 * `###` subsection. A `- ` bullet may wrap across lines in these plans, so
 * continuation lines (indented, not a new bullet) are folded into the
 * bullet they belong to.
 */
export function parsePlan(markdown: string, config: PlanConfig): Checklist[] {
  const splitAt = new Set(config.splitAt);
  const setup = new Set<string>(SETUP_SECTIONS);

  const byPlatform = new Map<string, TestItem[]>();
  let platform = config.leadPlatform ?? null;
  let section = '';
  // Index into the current platform's items, so wrapped bullets can be
  // appended to the item already in flight.
  let openItem: TestItem | null = null;

  const push = (item: TestItem) => {
    if (!platform) return;
    const items = byPlatform.get(platform) ?? [];
    items.push(item);
    byPlatform.set(platform, items);
  };

  for (const line of markdown.split('\n')) {
    const h2 = H2.exec(line);
    if (h2) {
      const heading = h2[1].trim();
      openItem = null;
      section = heading;
      if (splitAt.has(heading)) platform = heading;
      else if (setup.has(heading)) platform = null;
      // A non-splitting `##` (a pack-tools feature section) keeps the
      // current platform and just renames the section.
      else if (config.leadPlatform && platform === null) platform = config.leadPlatform;
      continue;
    }

    const h3 = H3.exec(line);
    if (h3) {
      section = h3[1].trim();
      openItem = null;
      continue;
    }

    if (setup.has(section)) continue;

    const bullet = BULLET.exec(line);
    if (bullet) {
      openItem = { section, text: bullet[1].trim() };
      push(openItem);
      continue;
    }

    // Continuation of a wrapped bullet: indented, non-empty, and we have a
    // bullet open. A blank line closes the bullet.
    if (openItem && CONTINUATION.test(line)) {
      openItem.text = `${openItem.text} ${line.trim()}`;
      continue;
    }
    if (line.trim() === '') openItem = null;
  }

  return [...byPlatform].map(([name, items]) => ({
    title: `[QA] ${config.label} — ${name}`,
    platform: name,
    items,
    source: config.file,
    alsoRun: config.alsoRun?.[name],
  }));
}

/**
 * Renders a checklist as a GitHub issue body.
 *
 * Items are grouped under their plan section so a tester can work through
 * it in the same order as the prose guide. Each checkbox keeps the plan's
 * wording verbatim — the plan is the spec, and paraphrasing it here would
 * be a second source of truth.
 */
export function renderBody(list: Checklist): string {
  const lines: string[] = [];

  lines.push(
    `Generated from \`${list.source}\` — that plan is the source of truth.`,
    'Regenerate with `bun run qa:checklist` after the plan changes.',
    '',
    `**Platform:** ${list.platform}`,
    '**OS version:** _fill this in before you start_',
    '**Tester:** _your name_',
    '',
    `Tick each box you have actually run and seen pass. ${list.items.length} items.`,
    '',
    'If something fails, leave the box unticked, open a normal bug issue, and',
    'link it on that line — an unticked box with no link reads as "not tested',
    'yet", which is a different thing from "tested and broken".',
    '',
  );

  if (list.alsoRun) {
    lines.push(
      `> This is a separate app from ${list.alsoRun} with its own cache, so passing`,
      `> on ${list.alsoRun} says nothing about passing here. Run the ${list.alsoRun}`,
      '> checklist against this platform too, then the items below.',
      '',
    );
  }

  let current = '';
  for (const item of list.items) {
    if (item.section !== current) {
      current = item.section;
      // Blank line before the heading, or GitHub renders it tight against
      // the preceding checkbox list.
      if (lines.at(-1) !== '') lines.push('');
      lines.push(`### ${current}`, '');
    }
    lines.push(`- [ ] ${item.text}`);
  }

  lines.push('', '---', '', 'Reports go to GitHub issues as usual.');
  if (list.platform === 'Apple Watch') {
    lines.push(
      'To screenshot on the watch, press the Digital Crown and the side button',
      "together. It lands in your phone's photos.",
    );
  }
  lines.push('', 'Anything merely annoying rather than broken is still worth reporting.');

  return lines.join('\n');
}

/** Renders the rollup issue that gates the release on the others. */
export function renderGate(checklists: Checklist[], issueNumbers: readonly number[]): string {
  const lines: string[] = [
    'Release gate for the Swift (iPhone / Mac / Apple Watch) apps.',
    '',
    'Every checklist below has to be fully ticked before we ship. GitHub shows',
    'the rollup progress on this issue as the sub-issues get completed.',
    '',
    '## Checklists',
    '',
  ];

  checklists.forEach((list, i) => {
    const ref = issueNumbers[i] ? `#${issueNumbers[i]}` : list.title;
    lines.push(`- [ ] ${ref} — ${list.items.length} items`);
  });

  const total = checklists.reduce((sum, l) => sum + l.items.length, 0);
  lines.push(
    '',
    `${total} test items across ${checklists.length} platform checklists.`,
    '',
    '## Ship criteria',
    '',
    'Every box on every checklist above is ticked, and every bug found is',
    'either fixed or explicitly labelled `NonReleaseBlocker`. An open',
    '`ReleaseBlocker` means we do not ship, regardless of the tick count.',
    '',
    'Checklists are generated from `docs/qa/*.md` by `bun run qa:checklist`.',
    'If a plan changes mid-round, regenerate rather than editing bodies by hand.',
  );

  return lines.join('\n');
}

/** Loads and parses one plan by its `PLANS` key. */
export function buildChecklists(planKey: string): Checklist[] {
  const config = PLANS[planKey];
  if (!config) {
    throw new Error(`Unknown plan "${planKey}". Known: ${Object.keys(PLANS).join(', ')}`);
  }
  const markdown = readFileSync(join(REPO_ROOT, config.file), 'utf8');
  return parsePlan(markdown, config);
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const create = argv.includes('--create');
  const planArg = argv.indexOf('--plan');
  const keys = planArg === -1 ? Object.keys(PLANS) : [argv[planArg + 1]];

  const checklists = keys.flatMap(buildChecklists);

  if (!create) {
    for (const list of checklists) {
      console.log(
        `\n${'='.repeat(70)}\n${list.title}  (${list.items.length} items)\n${'='.repeat(70)}`,
      );
      console.log(renderBody(list));
    }
    console.log(`\n${'='.repeat(70)}\nRELEASE GATE\n${'='.repeat(70)}`);
    console.log(renderGate(checklists, []));
    console.log(
      `\n${checklists.length} checklists, ` +
        `${checklists.reduce((s, l) => s + l.items.length, 0)} items. ` +
        'Re-run with --create to open these on GitHub.',
    );
    process.exit(0);
  }

  // --create: the caller has reviewed the printed output.
  const { spawnSync } = await import('node:child_process');
  const numbers: number[] = [];

  for (const list of checklists) {
    const result = spawnSync(
      'gh',
      ['issue', 'create', '--title', list.title, '--body', renderBody(list), '--label', 'qa'],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      console.error(`Failed to create "${list.title}":\n${result.stderr}`);
      process.exit(1);
    }
    const url = result.stdout.trim();
    const num = Number(url.split('/').pop());
    numbers.push(num);
    console.log(`created #${num}  ${list.title}`);
  }

  const gate = spawnSync(
    'gh',
    [
      'issue',
      'create',
      '--title',
      '[QA] Swift release gate — iPhone, Mac and Apple Watch',
      '--body',
      renderGate(checklists, numbers),
      '--label',
      'qa',
      '--label',
      'release',
    ],
    { encoding: 'utf8' },
  );
  if (gate.status !== 0) {
    console.error(`Failed to create the release gate:\n${gate.stderr}`);
    process.exit(1);
  }
  console.log(`created gate  ${gate.stdout.trim()}`);
}
