/**
 * Coverage + contract test for the MCP prompt surface (`registerPrompts`).
 *
 * Strategy mirrors annotations.test.ts: rather than stand up a real
 * `McpServer`, we hand `registerPrompts` a stub agent whose `server`
 * captures every `(name, config, handler)` passed through the `prompt()`
 * wrapper. We then:
 *   - assert the four documented prompts register with their arg schemas, and
 *   - invoke each handler twice — once with every optional present, once with
 *     them absent — so both branches of each `optional ? … : ''` ternary run
 *     and the generated user-message text is asserted, not just executed.
 *
 * This exercises `prompts.ts` end-to-end and the generic `prompt()` wrapper
 * in `registerTool.ts` (the single `server.registerPrompt` call site).
 */

import { describe, expect, it } from 'vitest';
import { ExperienceLevel, PackCategory, PackStyle, WeightPriority } from '../enums';
import { registerPrompts } from '../prompts';
import type { AgentContext } from '../types';

type PromptArgs = Record<string, unknown>;
type PromptResult = { messages: { role: string; content: { type: string; text: string } }[] };
type Captured = {
  name: string;
  config: { description?: string; argsSchema?: Record<string, unknown> };
  handler: (args: PromptArgs, extra: { requestId: string }) => PromptResult;
};

function captureRegisteredPrompts(): Captured[] {
  const captured: Captured[] = [];
  const server = {
    // Rest-tuple signature (one param) mirrors the SDK's 3-arg registerPrompt
    // without tripping the max-params lint, same trick as registerFlaggedTool
    // in annotations.test.ts.
    registerPrompt: (...args: [string, Captured['config'], Captured['handler']]) => {
      const [name, config, handler] = args;
      captured.push({ name, config, handler });
    },
  };
  const agent = {
    server,
    api: {},
    apiBaseUrl: 'https://api.test',
    setFeatureFlag: () => {
      /* no-op */
    },
    registerFlaggedTool: () => {
      /* no-op */
    },
    // safe-cast: the prompt surface only touches `server.registerPrompt`; the
    // rest of AgentContext is irrelevant to prompt registration.
  } as unknown as AgentContext;

  registerPrompts(agent);
  return captured;
}

const EXTRA = { requestId: 'test-request' };

function promptByName(captured: Captured[], name: string): Captured {
  const found = captured.find((c) => c.name === name);
  if (!found) throw new Error(`prompt ${name} was not registered`);
  return found;
}

function textOf(result: PromptResult): string {
  return result.messages[0].content.text;
}

describe('registerPrompts', () => {
  const prompts = captureRegisteredPrompts();

  it('registers exactly the four documented prompts with arg schemas', () => {
    expect(prompts.map((p) => p.name).sort()).toEqual([
      'optimize_pack_weight',
      'plan_trip',
      'recommend_gear',
      'trail_research',
    ]);
    for (const p of prompts) {
      expect(typeof p.config.description).toBe('string');
      expect(p.config.argsSchema).toBeTruthy();
      expect(p.handler).toBeTypeOf('function');
    }
  });

  it('plan_trip injects the season clause only when a season is given', () => {
    const planTrip = promptByName(prompts, 'plan_trip');
    const base = {
      destination: 'John Muir Trail, CA',
      duration_days: '7',
      activity: PackCategory.Backpacking,
      experience_level: ExperienceLevel.Intermediate,
      pack_style: PackStyle.Lightweight,
    };

    const withSeason = textOf(planTrip.handler({ ...base, season: 'July' }, EXTRA));
    expect(withSeason).toContain('John Muir Trail, CA');
    expect(withSeason).toContain('in July');
    expect(withSeason).toContain('packrat_create_pack');

    const withoutSeason = textOf(planTrip.handler(base, EXTRA));
    expect(withoutSeason).toContain('7-day');
    expect(withoutSeason).not.toContain('in July');
  });

  it('optimize_pack_weight adds target-weight and budget clauses conditionally', () => {
    const optimize = promptByName(prompts, 'optimize_pack_weight');

    const full = textOf(
      optimize.handler({ pack_id: 'pack-1', target_weight_kg: '5.0', budget_usd: '500' }, EXTRA),
    );
    expect(full).toContain('pack-1');
    expect(full).toContain('target base weight of 5.0kg');
    expect(full).toContain('$500 upgrade budget');

    const bare = textOf(optimize.handler({ pack_id: 'pack-1' }, EXTRA));
    expect(bare).toContain('pack-1');
    expect(bare).not.toContain('target base weight');
    expect(bare).not.toContain('upgrade budget');
  });

  it('recommend_gear folds in conditions, category, and budget when present', () => {
    const recommend = promptByName(prompts, 'recommend_gear');

    const full = textOf(
      recommend.handler(
        {
          activity: 'winter mountaineering',
          conditions: 'down to -10°F',
          category: 'sleeping bag',
          budget_usd: '800',
          weight_priority: WeightPriority.WeightConscious,
        },
        EXTRA,
      ),
    );
    expect(full).toContain('winter mountaineering');
    expect(full).toContain('down to -10°F');
    expect(full).toContain('sleeping bag');
    expect(full).toContain('$800');

    const bare = textOf(
      recommend.handler(
        { activity: 'day hiking', weight_priority: WeightPriority.WeightConscious },
        EXTRA,
      ),
    );
    expect(bare).toContain('day hiking');
    expect(bare).not.toContain('Budget:');
  });

  it('trail_research adds the start-date clause only when supplied', () => {
    const research = promptByName(prompts, 'trail_research');

    const dated = textOf(
      research.handler({ trail_name: 'PCT Section A', start_date: 'July 15, 2025' }, EXTRA),
    );
    expect(dated).toContain('PCT Section A');
    expect(dated).toContain('starting July 15, 2025');

    const undated = textOf(research.handler({ trail_name: 'PCT Section A' }, EXTRA));
    expect(undated).toContain('PCT Section A');
    expect(undated).not.toContain('starting');
  });
});
