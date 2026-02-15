# Compound Engineering Workflow

Andrew discovered this pattern using the **Compound Engineering plugin** for OpenCode/Claude Code.

## The Cycle: Plan → Work → Review → Compound → Repeat

| Command | Purpose |
|---------|---------|
| `/workflows:plan` | Turn feature ideas into detailed implementation plans |
| `/workflows:work` | Execute plans with worktrees and task tracking |
| `/workflows:review` | Multi-agent code review before merging |
| `/workflows:compound` | Document learnings to make future work easier |

## Installation (OpenCode)

```bash
# Install the compound engineering plugin for OpenCode
bunx @every-env/compound-plugin install compound-engineering --to opencode

# Sync personal Claude Code config to OpenCode
bunx @every-env/compound-plugin sync --target opencode
```

## Workflow Pattern

### Step 1: Plan (No Instructions)
```bash
/workflows:plan
```
Let the tool analyze the codebase and generate a plan without your instructions.

### Step 2: Add Instructions
After reviewing the plan, add your specific instructions based on what it generated.

## Why This Works

1. **Context First**: The tool analyzes the codebase first, understanding structure
2. **Plan Review**: You see what it plans before it executes
3. **Informed Instructions**: You can refine instructions based on its analysis
4. **Document Learnings**: Capture patterns for future work

## Core Philosophy

> "Each unit of engineering work should make subsequent units easier—not harder."

Traditional development: each feature adds complexity, codebase gets harder over time.
Compound engineering inverts this: 80% planning/review, 20% execution.

## Use Cases

- Complex refactoring tasks
- Architecture decisions
- Multi-file changes
- Feature planning
- Large-scale modifications

## Example Session

```bash
# 1. Let it analyze and plan
$ /workflows:plan
Analyzing codebase...
Found 12 TypeScript files, 8 components...
Plan:
- Phase 1: Update types in shared/
- Phase 2: Refactor components/
- Phase 3: Update tests/

# 2. Review plan, then add instructions
$ /workflows:work "Proceed with Phase 1, but skip deprecated types"
```

## Related Patterns

- **Research → Connect → Build → Deliver** (bisque's pattern)
- **Plan → Execute → Review** (compound engineering)

## Resources

- [GitHub Repository](https://github.com/EveryInc/compound-engineering-plugin)
- [Full Documentation](https://every.to/guides/compound-engineering)
