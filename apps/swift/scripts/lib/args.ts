export type TestPlanName = 'iOS-Full' | 'iOS-Smoke' | 'iOS-Sanity';

export type ParsedArgs = {
  plan?: TestPlanName;
  passthrough: string[];
};

const KNOWN_PLANS: TestPlanName[] = ['iOS-Full', 'iOS-Smoke', 'iOS-Sanity'];

const ALIASES: Record<string, TestPlanName> = {
  full: 'iOS-Full',
  smoke: 'iOS-Smoke',
  sanity: 'iOS-Sanity',
  'ios-ui': 'iOS-Full',
  'ios-full': 'iOS-Full',
  'ios-smoke': 'iOS-Smoke',
  'ios-sanity': 'iOS-Sanity',
};

const POSITIONAL_MODES: Record<string, ParsedArgs> = {
  unit: { passthrough: ['-only-testing:PackRatTests'] },
  'ios-unit': { passthrough: ['-only-testing:PackRatTests'] },
};

export class ArgsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArgsError';
  }
}

function isKnownPlan(name: string): name is TestPlanName {
  // safe-cast: KNOWN_PLANS is a literal TestPlanName[]; widening to readonly string[] is
  // the canonical "string-in-set" predicate and the cast back is justified by the includes() check.
  return (KNOWN_PLANS as readonly string[]).includes(name);
}

function resolvePlan(name: string): TestPlanName {
  if (isKnownPlan(name)) return name;
  const alias = ALIASES[name.toLowerCase()];
  if (alias) return alias;
  throw new ArgsError(
    `Unknown --plan "${name}". Valid plans: ${KNOWN_PLANS.join(', ')} (also: smoke, full).`,
  );
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  const passthrough: string[] = [];
  let plan: TestPlanName | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === '--plan') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new ArgsError(
          '--plan requires a value (sanity | smoke | full | iOS-Sanity | iOS-Smoke | iOS-Full)',
        );
      }
      plan = resolvePlan(next);
      i++;
      continue;
    }
    if (a.startsWith('--plan=')) {
      plan = resolvePlan(a.slice('--plan='.length));
      continue;
    }
    const positionalPlan = ALIASES[a.toLowerCase()];
    if (positionalPlan) {
      plan = positionalPlan;
      continue;
    }
    const positionalMode = POSITIONAL_MODES[a.toLowerCase()];
    if (positionalMode) {
      if (positionalMode.plan) plan = positionalMode.plan;
      passthrough.push(...positionalMode.passthrough);
      continue;
    }
    passthrough.push(a);
  }
  return { plan, passthrough };
}
