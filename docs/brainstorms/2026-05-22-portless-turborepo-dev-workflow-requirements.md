---
date: 2026-05-22
topic: portless-turborepo-dev-workflow
---

# Portless Turborepo Dev Workflow

## Summary

PackRat's Turborepo development workflow should use Portless so local services get stable named URLs instead of fixed, colliding ports. The ready state includes web apps, Cloudflare Worker services, MCP, and Expo development, with Expo simulator support first and physical-device LAN support before the workflow is considered complete.

---

## Problem Frame

PackRat is moving toward a Turborepo-based monorepo workflow, and the current local development shape still relies on package-level commands and fixed or implicit ports. That is workable for one human running one service, but it becomes fragile when multiple agents or worktrees start services independently.

Subagents need predictable service addresses that do not conflict with each other. Without that, agents either reuse occupied ports, silently point at the wrong local process, or require manual port cleanup and environment edits before they can test changes.

Expo raises the bar beyond browser-only development. The mobile app consumes a configured API URL, and local readiness is incomplete if web/API services have named URLs but the Expo app still depends on manual API URL juggling.

---

## Actors

- A1. Human developer: Starts local PackRat workflows, reviews agent output, and may run Expo on simulator or physical devices.
- A2. Coding agent or subagent: Starts and tests local services in a worktree without coordinating ports manually.
- A3. PackRat local services: Web apps, Cloudflare Worker services, MCP, and Expo Metro processes that need stable local addresses.
- A4. Mobile test device or simulator: Runs the Expo app and connects to the local API during development.

---

## Key Flows

- F1. Multi-agent web/API development
  - **Trigger:** A human or agent starts the PackRat dev workflow in a worktree.
  - **Actors:** A1, A2, A3
  - **Steps:** Services start through the Turborepo dev workflow, each service receives a stable named local URL, and agents use those URLs instead of guessing ports.
  - **Outcome:** Multiple worktrees or agents can run dev services at the same time without local port collisions.
  - **Covered by:** R1, R2, R3, R4, R9

- F2. Expo simulator local API development
  - **Trigger:** A developer or agent runs the Expo app locally against the development API.
  - **Actors:** A1, A2, A3, A4
  - **Steps:** The local API service starts with a named Portless URL, Expo receives a matching local API URL, and the simulator or emulator can make authenticated API calls to that local service.
  - **Outcome:** Expo local development works without manually editing API ports.
  - **Covered by:** R5, R6, R8, R9

- F3. Expo physical-device local API development
  - **Trigger:** A developer tests the Expo app on a phone or tablet on the same network as the development machine.
  - **Actors:** A1, A3, A4
  - **Steps:** Portless LAN mode exposes the local API through a device-reachable local name, the Expo app uses that URL, and platform networking requirements are satisfied.
  - **Outcome:** Physical-device testing can use the same local development stack without falling back to production or manual IP-address wiring.
  - **Covered by:** R6, R7, R8, R10

---

## Requirements

**Named local services**

- R1. The PackRat dev workflow must expose runnable local services through stable names rather than requiring humans or agents to know fixed localhost ports.
- R2. The workflow must support running multiple services from the monorepo through the Turborepo development task.
- R3. The workflow must preserve direct service-level development for contributors who only want to start one app or service.
- R4. Service names must be predictable enough for agents to infer the intended target, such as web, admin, guides, API, and MCP roles.

**Agent and worktree behavior**

- R5. Worktree-local development must avoid collisions with the main checkout and with other active worktrees.
- R6. Agents must be able to discover or be given the active local service URL without reading terminal output from another process.
- R7. The workflow must include cleanup or stale-process handling expectations so abandoned agent sessions do not keep breaking later runs.

**Expo readiness**

- R8. Expo local development must be able to target the local PackRat API through the same named-service strategy used by the rest of the dev workflow.
- R9. Simulator and emulator support must be part of the first usable Portless workflow, not an optional later integration.
- R10. Physical-device support must be included before the workflow is considered complete, using LAN-reachable local service names where appropriate.
- R11. Expo readiness must not require broad API client redesign; the goal is reliable local URL selection for development.

**Compatibility and validation**

- R12. Next.js-based apps must work through the named URL workflow without losing normal development server behavior.
- R13. Cloudflare Worker services must be explicitly validated because their local server behavior may differ from standard Node or Next.js apps.
- R14. The workflow must retain a bypass path for contributors who need to run the underlying dev command directly.
- R15. Documentation must explain the normal local workflow, the Expo simulator workflow, the physical-device LAN workflow, and recovery steps for stale local services.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R4, R5.** Given one agent is running PackRat services in one worktree, when another agent starts the dev workflow in a second worktree, both get distinct reachable service URLs and neither fails because a port is already occupied.
- AE2. **Covers R3, R14.** Given a contributor only wants to work on one web app, when they start that service directly, they can still use the underlying dev command without being forced through the full monorepo workflow.
- AE3. **Covers R8, R9.** Given the local API is running through the named-service workflow, when the Expo app runs in a simulator or emulator, API calls target the local API without manually editing a hardcoded port.
- AE4. **Covers R10.** Given Portless LAN mode is enabled and a phone is on the same network, when the Expo app runs on the phone, it can reach the local API through a LAN-reachable local service URL.
- AE5. **Covers R13.** Given a Cloudflare Worker service is started through the workflow, when an agent calls its named local URL, the request reaches the intended worker service and not a stale or unrelated process.

---

## Success Criteria

- Developers and agents can run PackRat local services from multiple worktrees without manual port assignment or cleanup as the normal path.
- Expo development can target the local API in simulator/emulator mode and has a documented path for physical-device testing.
- A downstream planner can identify the required services, validation scenarios, and non-goals without inventing product behavior.
- The workflow remains understandable for humans who do not use subagents heavily.

---

## Scope Boundaries

- Local development only; production, staging, and deployed preview URL strategy are out of scope.
- No broad rewrite of the Expo API client or environment system unless required to select the local API URL reliably.
- No requirement to Portless-manage packages that do not run a persistent dev server.
- No requirement to make physical-device LAN mode the first delivered slice, but it is required before declaring the workflow complete.
- No replacement of Turborepo as the monorepo task runner.

---

## Key Decisions

- Portless should be part of the Turborepo development workflow rather than a separate optional convention because the primary value is predictable service discovery for agents and worktrees.
- Expo is a readiness requirement because PackRat's local development surface includes the mobile app, not just browser apps.
- Physical-device support can follow simulator support, but it should remain in the same requirements scope so it does not disappear after the easier web/API work lands.
- Direct underlying dev commands should remain available as a bypass path because contributors may need to debug Portless, Turborepo, or framework-specific server behavior independently.

---

## Dependencies / Assumptions

- The Turborepo branch remains the base for this work.
- Portless supports Bun workspaces and Turborepo-style package scripts.
- Portless documentation says Expo and React Native receive injected port handling, and LAN mode changes Expo host behavior for device access.
- Expo currently consumes its API base URL from public development environment configuration.
- Cloudflare Worker services need validation because documentation confidence is lower than for Next.js and Expo.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R6, R8][Technical] What is the cleanest way for Expo to receive the active named API URL in simulator mode without weakening existing environment validation?
- [Affects R10][Needs research] Which exact iOS and Android networking configuration is required for Portless LAN mode on physical devices?
- [Affects R13][Needs research] Do the Cloudflare Worker services accept Portless-injected ports automatically, or do they require explicit local dev flags?
- [Affects R15][Technical] Should stale-process recovery be documented as a manual command, wrapped in a repo script, or both?
