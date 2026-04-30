import { z } from 'zod';
import { ExperienceLevel, PackCategory, PackStyle, WeightPriority } from './enums';
import type { AgentContext } from './types';

export function registerPrompts(agent: AgentContext): void {
  // ── Trip planning prompt ──────────────────────────────────────────────────

  agent.server.registerPrompt(
    'plan_trip',
    {
      description:
        'Generate a comprehensive trip plan with gear checklist, weather considerations, and packing recommendations. Guides the AI to use available tools to research the destination and build a complete pack.',
      argsSchema: {
        destination: z.string().describe('Trip destination (e.g. "John Muir Trail, CA")'),
        duration_days: z.string().describe('Number of days (e.g. "7")'),
        activity: z
          .nativeEnum(PackCategory)
          .default(PackCategory.Backpacking)
          .describe('Primary activity type'),
        season: z.string().optional().describe('Season or month (e.g. "July", "winter")'),
        experience_level: z
          .nativeEnum(ExperienceLevel)
          .default(ExperienceLevel.Intermediate)
          .describe('User experience level'),
        pack_style: z
          .nativeEnum(PackStyle)
          .default(PackStyle.Lightweight)
          .describe('Preferred gear weight philosophy'),
      },
    },
    ({ destination, duration_days, activity, season, experience_level, pack_style }) => {
      const seasonStr = season ? ` in ${season}` : '';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `I'm planning a ${duration_days}-day ${activity} trip to ${destination}${seasonStr}. I'm a ${experience_level} outdoorsperson and prefer ${pack_style} gear.

Please help me plan this trip by:

1. **Weather Check**: Use \`get_weather\` to check current and forecasted conditions for ${destination}.

2. **Destination Research**: Search \`search_outdoor_guides\` for guides and tips specific to ${destination} and ${activity}.

3. **Trail Conditions**: Check \`get_trail_conditions\` for any recent reports from ${destination}.

4. **Gear Research**: Use \`semantic_gear_search\` to find ${pack_style} gear suitable for ${activity} in the expected conditions.

5. **Pack Creation**: Create a new pack with \`create_pack\` and populate it with appropriate gear using \`add_pack_item\`. Focus on:
   - Shelter and sleep system
   - Clothing and layering system
   - Navigation tools
   - Safety and first aid
   - Food and water
   - Category-appropriate specialty gear

6. **Weight Analysis**: After building the pack, run \`analyze_pack_weight\` and provide a summary.

7. **Gap Check**: Identify any essential gear missing for ${activity} using \`analyze_pack_gaps\`.

At the end, provide:
- A complete trip itinerary overview
- Safety considerations specific to ${destination}
- Permit or reservation requirements
- Emergency contacts and leave no trace notes`,
            },
          },
        ],
      };
    },
  );

  // ── Pack optimization prompt ──────────────────────────────────────────────

  agent.server.registerPrompt(
    'optimize_pack_weight',
    {
      description:
        'Analyze an existing pack and suggest specific gear swaps to reduce weight. Finds lighter alternatives in the catalog for the heaviest items.',
      argsSchema: {
        pack_id: z.string().describe('The pack ID to optimize'),
        target_weight_kg: z
          .string()
          .optional()
          .describe('Target base weight in kg (e.g. "5.0" for 5kg base weight)'),
        budget_usd: z.string().optional().describe('Budget for gear upgrades in USD (e.g. "500")'),
      },
    },
    ({ pack_id, target_weight_kg, budget_usd }) => {
      const targetStr = target_weight_kg
        ? ` with a target base weight of ${target_weight_kg}kg`
        : '';
      const budgetStr = budget_usd ? ` within a $${budget_usd} upgrade budget` : '';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Please analyze my pack (ID: ${pack_id}) and suggest weight optimizations${targetStr}${budgetStr}.

Steps:
1. Get the full pack details with \`get_pack\`
2. Run \`analyze_pack_weight\` to see the weight breakdown by category
3. For the 3-5 heaviest items, use \`semantic_gear_search\` to find lighter alternatives
4. For each replacement candidate, retrieve full specs with \`get_catalog_item\`
5. Present a prioritized upgrade plan showing:
   - Current item weight vs. recommended replacement weight
   - Weight savings per swap
   - Estimated cost of each upgrade
   - Total potential weight reduction
   - Estimated cost of full upgrade plan

Prioritize the highest weight-savings-per-dollar swaps. Flag any items that are already ultralight.`,
            },
          },
        ],
      };
    },
  );

  // ── Gear recommendations prompt ───────────────────────────────────────────

  agent.server.registerPrompt(
    'recommend_gear',
    {
      description:
        'Get personalized gear recommendations for a specific activity, condition, or need. Uses semantic search to find the best options.',
      argsSchema: {
        activity: z.string().describe('Activity or use-case (e.g. "winter mountaineering")'),
        conditions: z
          .string()
          .optional()
          .describe(
            'Specific conditions (e.g. "temperatures down to -10°F, high wind, multi-day")',
          ),
        category: z
          .string()
          .optional()
          .describe('Specific gear category (e.g. "sleeping bag", "shell jacket")'),
        budget_usd: z.string().optional().describe('Maximum budget in USD'),
        weight_priority: z
          .nativeEnum(WeightPriority)
          .default(WeightPriority.WeightConscious)
          .describe('Weight vs durability tradeoff preference'),
      },
    },
    ({ activity, conditions, category, budget_usd, weight_priority }) => {
      const condStr = conditions ? ` in conditions: ${conditions}` : '';
      const catStr = category ? ` specifically looking for ${category}` : '';
      const budgetStr = budget_usd ? ` Budget: under $${budget_usd}.` : '';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `I need gear recommendations for ${activity}${condStr}${catStr}. I prefer a ${weight_priority} approach.${budgetStr}

Please:
1. Search for relevant guides with \`search_outdoor_guides\` to understand what's needed for ${activity}
2. Use \`semantic_gear_search\` to find top options — run multiple searches to cover different aspects
3. Get full specs for the top 3-5 candidates with \`get_catalog_item\`
4. Use \`compare_gear_items\` to create a side-by-side comparison
5. Provide ranked recommendations with pros/cons for each option

Format the response as:
- **Top Pick**: best overall option with rationale
- **Budget Pick**: best value option
- **Ultralight Pick**: lightest viable option (if different from top pick)
- **Comparison table** with key specs`,
            },
          },
        ],
      };
    },
  );

  // ── Trail research prompt ─────────────────────────────────────────────────

  agent.server.registerPrompt(
    'trail_research',
    {
      description:
        'Research a trail comprehensively — current conditions, weather, permits, gear needs, and safety considerations.',
      argsSchema: {
        trail_name: z
          .string()
          .describe('Trail or route name (e.g. "Pacific Crest Trail Section A")'),
        start_date: z.string().optional().describe('Planned start date (e.g. "July 15, 2025")'),
      },
    },
    ({ trail_name, start_date }) => {
      const dateStr = start_date ? ` starting ${start_date}` : '';
      return {
        messages: [
          {
            role: 'user' as const,
            content: {
              type: 'text' as const,
              text: `Help me research ${trail_name}${dateStr} for trip planning.

Please gather:
1. **Current Conditions**: Check \`get_trail_conditions\` for recent user reports
2. **Weather**: Get forecast with \`get_weather\` for the trail area
3. **Guide Information**: Search \`search_outdoor_guides\` for route details, difficulty, permits
4. **Current News**: Use \`web_search\` for recent news about "${trail_name} conditions ${new Date().getFullYear()}"
5. **Gear Needs**: Based on conditions and season, identify critical gear needs

Summarize:
- Trail difficulty and length
- Current conditions and hazards
- Permit requirements
- Water source availability
- Recommended camp spots or permits needed
- Essential gear for current conditions
- Safety considerations`,
            },
          },
        ],
      };
    },
  );
}
