import { ArgsError } from './args';

const KNOWN_MACOS_PLANS: Record<string, string> = {
  full: 'macOS-Full',
  smoke: 'macOS-Smoke',
  'macos-full': 'macOS-Full',
  'macos-smoke': 'macOS-Smoke',
  'macOS-Full': 'macOS-Full',
  'macOS-Smoke': 'macOS-Smoke',
};

export function parseMacOSArgs(argv: readonly string[]): { plan?: string; passthrough: string[] } {
  const passthrough: string[] = [];
  let plan: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a) continue;
    if (a === '--plan') {
      const next = argv[i + 1];
      if (!next || next.startsWith('-')) {
        throw new ArgsError('--plan requires a value (smoke | full)');
      }
      plan = KNOWN_MACOS_PLANS[next];
      if (!plan) {
        throw new ArgsError(
          `Unknown --plan "${next}". Valid plans: macOS-Full, macOS-Smoke (also: smoke, full).`,
        );
      }
      i++;
      continue;
    }
    if (a.startsWith('--plan=')) {
      const value = a.slice('--plan='.length);
      plan = KNOWN_MACOS_PLANS[value];
      if (!plan) {
        throw new ArgsError(
          `Unknown --plan "${value}". Valid plans: macOS-Full, macOS-Smoke (also: smoke, full).`,
        );
      }
      continue;
    }
    passthrough.push(a);
  }
  return { plan, passthrough };
}

export function normalizeMacOSTestSelectors(passthrough: readonly string[]): string[] {
  return passthrough.map((arg) => {
    if (arg.startsWith('-only-testing:PackRatUITests/')) {
      return arg.replace('-only-testing:PackRatUITests/', '-only-testing:PackRatMacOSUITests/');
    }
    if (arg.startsWith('-skip-testing:PackRatUITests/')) {
      return arg.replace('-skip-testing:PackRatUITests/', '-skip-testing:PackRatMacOSUITests/');
    }
    if (arg.startsWith('-only-testing:PackRatTests/')) {
      return arg.replace('-only-testing:PackRatTests/', '-only-testing:PackRatMacOSTests/');
    }
    if (arg.startsWith('-skip-testing:PackRatTests/')) {
      return arg.replace('-skip-testing:PackRatTests/', '-skip-testing:PackRatMacOSTests/');
    }
    return arg;
  });
}
