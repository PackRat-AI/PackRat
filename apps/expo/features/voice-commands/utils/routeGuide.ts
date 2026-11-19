import {
  type GeoPoint,
  geoBearing,
  geoDistance,
  isOnRoute,
  type RouteProgress,
  routeProgress,
} from './routeProgress';
import type { TripWaypoint } from './tripWaypoints';
import { normalizeTranscript } from './voiceCommand';

// ── Destinations ──────────────────────────────────────────────────────────

/** A place PackRat can guide the user to. `name` is as it's said aloud: "camp", "the trailhead". */
export interface GuidanceDestination {
  name: string;
  point: GeoPoint;
}

export const END_OF_ROUTE = 'the end of your route';
export const TRAILHEAD = 'the trailhead';

const END_PHRASES: ReadonlySet<string> = new Set([
  'end',
  'end of route',
  'end of my route',
  'end of the route',
  'end of your route',
  'route end',
  'finish',
  'destination',
]);
const START_PHRASES: ReadonlySet<string> = new Set([
  'trailhead',
  'trail head',
  'start',
  'start of route',
  'start of my route',
  'start of the route',
  'beginning',
  'car',
  'parking',
  'parking lot',
]);

function strippedArticles(text: string): string {
  const words = text.split(' ').filter(Boolean);
  while (words[0] && ['the', 'my', 'a', 'our'].includes(words[0])) words.shift();
  return words.join(' ');
}

export function waypointDestination(waypoint: TripWaypoint): GuidanceDestination {
  return {
    name: waypoint.name,
    point: { latitude: waypoint.latitude, longitude: waypoint.longitude },
  };
}

/** What "navigate to …" names: a waypoint the user marked, then the ends of the planned route. */
export function resolveDestination({
  spoken,
  waypoints,
  route,
}: {
  spoken: string;
  waypoints: readonly TripWaypoint[];
  route: readonly GeoPoint[];
}): GuidanceDestination | null {
  const target = strippedArticles(normalizeTranscript(spoken));
  if (!target) return null;

  // Newest first, so a second "camp" means tonight's.
  const marked = [...waypoints]
    .reverse()
    .map((waypoint) => ({ key: strippedArticles(normalizeTranscript(waypoint.name)), waypoint }));
  const padded = ` ${target} `;
  const overlaps = (key: string) =>
    key.length > 0 && (` ${key} `.includes(padded) || padded.includes(` ${key} `));
  const match = marked.find((m) => m.key === target) ?? marked.find((m) => overlaps(m.key));
  if (match) return waypointDestination(match.waypoint);

  const first = route[0];
  const last = route[route.length - 1];
  if (route.length < 2 || !first || !last) return null;
  if (END_PHRASES.has(target)) return { name: END_OF_ROUTE, point: last };
  if (START_PHRASES.has(target)) return { name: TRAILHEAD, point: first };
  return null;
}

/** What there is to navigate to, newest waypoints first, for "I couldn't find that". */
export function destinationOptions({
  waypoints,
  route,
  limit = 3,
}: {
  waypoints: readonly TripWaypoint[];
  route: readonly GeoPoint[];
  limit?: number;
}): string[] {
  const names: string[] = [];
  for (const waypoint of [...waypoints].reverse()) {
    if (names.length >= limit) break;
    if (!waypoint.note && !names.includes(waypoint.name)) names.push(waypoint.name);
  }
  if (route.length >= 2) names.push(TRAILHEAD, END_OF_ROUTE);
  return names;
}

// ── Geometry along a path ─────────────────────────────────────────────────

/** Distance from the start of `path` to each of its points. */
export function cumulative(path: readonly GeoPoint[]): number[] {
  const result = [0];
  let total = 0;
  path.forEach((point, i) => {
    const previous = path[i - 1];
    if (!previous) return;
    total += geoDistance({ from: previous, to: point });
    result.push(total);
  });
  return result;
}

export function pathLength(path: readonly GeoPoint[]): number {
  return cumulative(path).at(-1) ?? 0;
}

/** The point `along` metres down the path, clamped to its ends. */
export function pointAlong({
  along,
  path,
  distances,
}: {
  along: number;
  path: readonly GeoPoint[];
  distances: readonly number[];
}): GeoPoint {
  const first = path[0];
  const last = path[path.length - 1];
  if (!first || !last) return { latitude: 0, longitude: 0 };
  if (along <= 0) return first;
  const index = distances.findIndex((d) => d >= along);
  if (index <= 0) return last;
  const a = path[index - 1] as GeoPoint;
  const b = path[index] as GeoPoint;
  const start = distances[index - 1] ?? 0;
  const span = (distances[index] ?? start) - start;
  const t = span > 0 ? (along - start) / span : 0;
  return {
    latitude: a.latitude + t * (b.latitude - a.latitude),
    longitude: a.longitude + t * (b.longitude - a.longitude),
  };
}

/**
 * The stretch of a route between two distances along it, in the order asked for, so heading back
 * to the trailhead runs the route backwards.
 */
export function slicePath({
  route,
  from,
  to,
}: {
  route: readonly GeoPoint[];
  from: number;
  to: number;
}): GeoPoint[] {
  const distances = cumulative(route);
  const low = Math.min(from, to);
  const high = Math.max(from, to);
  const points = [pointAlong({ along: low, path: route, distances })];
  route.forEach((point, i) => {
    const along = distances[i] ?? 0;
    if (along > low && along < high) points.push(point);
  });
  points.push(pointAlong({ along: high, path: route, distances }));
  return from <= to ? points : points.reverse();
}

/** From one bearing to another, -180…180, negative to the left. */
export function signedDifference({ from, to }: { from: number; to: number }): number {
  let difference = (to - from) % 360;
  if (difference > 180) difference -= 360;
  if (difference <= -180) difference += 360;
  return difference;
}

// ── Plan ──────────────────────────────────────────────────────────────────

/** A turn worth saying out loud along a guided path. */
export interface GuidanceTurn {
  /** Metres along the path. */
  alongMeters: number;
  /** Change of heading, negative to the left. */
  degrees: number;
  /** Compass bearing after the turn. */
  headingAfter: number;
}

/** "bear left", "turn right", "make a sharp left". */
export function maneuver(turn: Pick<GuidanceTurn, 'degrees'>): string {
  const side = turn.degrees < 0 ? 'left' : 'right';
  const size = Math.abs(turn.degrees);
  if (size < 80) return `bear ${side}`;
  if (size < 135) return `turn ${side}`;
  return `make a sharp ${side}`;
}

/** The way to a destination: along the planned route when it's on it, otherwise straight there. */
export interface GuidancePlan {
  destination: GuidanceDestination;
  /** From where guidance started to the destination. Null means straight there. */
  path: GeoPoint[] | null;
  turns: GuidanceTurn[];
  /** Metres from start to destination, along the path or in a straight line. */
  lengthMeters: number;
}

/** A destination further than this from the planned route is reached straight, not along it. */
const ON_ROUTE_DESTINATION_METERS = 150;

export function guidancePlan({
  from,
  to,
  route,
}: {
  from: GeoPoint;
  to: GuidanceDestination;
  route: readonly GeoPoint[];
}): GuidancePlan {
  const here = routeProgress({ position: from, route });
  const there = routeProgress({ position: to.point, route });
  if (
    here &&
    there &&
    there.offRouteMeters <= ON_ROUTE_DESTINATION_METERS &&
    Math.abs(there.alongMeters - here.alongMeters) >= 50
  ) {
    const path = slicePath({ route, from: here.alongMeters, to: there.alongMeters });
    const end = path[path.length - 1];
    if (!end || geoDistance({ from: end, to: to.point }) > 10) path.push(to.point);
    return { destination: to, path, turns: pathTurns(path), lengthMeters: pathLength(path) };
  }
  return {
    destination: to,
    path: null,
    turns: [],
    lengthMeters: geoDistance({ from, to: to.point }),
  };
}

/**
 * Bends of 50° or more, measured 30 m either side so GPS wiggle in the track doesn't count.
 * Switchbacks are left out: a prompt at every one on a climb is noise, and the trail itself shows
 * the way.
 */
export function pathTurns(path: readonly GeoPoint[]): GuidanceTurn[] {
  if (path.length < 3) return [];
  const distances = cumulative(path);
  const total = distances.at(-1) ?? 0;
  const candidates: GuidanceTurn[] = [];
  for (let i = 1; i < path.length - 1; i++) {
    const along = distances[i] ?? 0;
    if (along < 30 || total - along < 30) continue;
    const point = path[i] as GeoPoint;
    const before = pointAlong({ along: along - 30, path, distances });
    const after = pointAlong({ along: along + 30, path, distances });
    const outbound = geoBearing({ from: point, to: after });
    const degrees = signedDifference({
      from: geoBearing({ from: before, to: point }),
      to: outbound,
    });
    if (Math.abs(degrees) < 50) continue;
    const turn = { alongMeters: along, degrees, headingAfter: outbound };
    // One bend drawn with several points is one turn: keep its sharpest.
    const last = candidates[candidates.length - 1];
    if (last && along - last.alongMeters < 40 && last.degrees < 0 === degrees < 0) {
      if (Math.abs(degrees) > Math.abs(last.degrees)) candidates[candidates.length - 1] = turn;
    } else {
      candidates.push(turn);
    }
  }
  return candidates.filter((turn, i) =>
    [candidates[i - 1], candidates[i + 1]].every(
      (other) =>
        !other ||
        Math.abs(other.alongMeters - turn.alongMeters) >= 200 ||
        other.degrees < 0 === turn.degrees < 0,
    ),
  );
}

// ── Following ─────────────────────────────────────────────────────────────

export type GuidancePromptKind = 'turn' | 'milestone' | 'offRoute' | 'arrived';

/** Something guidance says without being asked. */
export type GuidancePrompt =
  | { kind: 'turn'; turn: GuidanceTurn; aheadMeters: number }
  | {
      kind: 'milestone';
      milestone: 'half' | 'last';
      remainingMeters: number;
      bearing: number | null;
    }
  | { kind: 'offRoute'; progress: RouteProgress }
  | { kind: 'backOnRoute' }
  | { kind: 'arrived' };

/** Settings group prompts as turns, milestones and off-route; arriving is always said. */
export function promptKind(prompt: GuidancePrompt): GuidancePromptKind {
  return prompt.kind === 'backOnRoute' ? 'offRoute' : prompt.kind;
}

/** Where guidance is: what's been said, and the latest figures for the card and "how far to go". */
export interface RouteGuide {
  plan: GuidancePlan;
  announcedTurns: number[];
  announcedMilestones: ('half' | 'last')[];
  /** Epoch milliseconds the user first strayed, while they're still off. */
  offRouteSince: number | null;
  announcedOffRouteMeters: number | null;
  hasArrived: boolean;
  remainingMeters: number;
  progress: RouteProgress | null;
}

/** Said this far ahead of a turn. */
export const TURN_WARNING_METERS = 120;
/** Within this of the destination is there. */
export const ARRIVAL_RADIUS_METERS = 30;
/** Off the path this long before it's said, so a detour round a fallen tree doesn't trigger it. */
const OFF_ROUTE_DELAY_MS = 20_000;

export function newGuide(plan: GuidancePlan): RouteGuide {
  return {
    plan,
    announcedTurns: [],
    announcedMilestones: [],
    offRouteSince: null,
    announcedOffRouteMeters: null,
    hasArrived: false,
    remainingMeters: plan.lengthMeters,
    progress: null,
  };
}

export function isGuideOffRoute(guide: RouteGuide): boolean {
  return guide.announcedOffRouteMeters != null;
}

/** The next turn ahead, for the card. */
export function nextTurn(guide: RouteGuide): GuidanceTurn | null {
  const along = guide.progress?.alongMeters;
  if (along == null) return null;
  return guide.plan.turns.find((turn) => turn.alongMeters > along) ?? null;
}

/** Advances the guide to a new position and hands back what to say. Pure, so it can be tested. */
export function updateGuide({
  guide,
  position,
  time,
  metric,
}: {
  guide: RouteGuide;
  position: GeoPoint;
  time: number;
  metric: boolean;
}): { guide: RouteGuide; prompts: GuidancePrompt[] } {
  if (guide.hasArrived) return { guide, prompts: [] };
  const { plan } = guide;
  const direct = geoDistance({ from: position, to: plan.destination.point });
  const arrive = () => ({
    guide: { ...guide, hasArrived: true, remainingMeters: 0 },
    prompts: [{ kind: 'arrived' } as const],
  });

  const progress = plan.path ? routeProgress({ position, route: plan.path }) : null;
  if (!progress) {
    if (direct <= ARRIVAL_RADIUS_METERS) return arrive();
    const next = { ...guide, remainingMeters: direct };
    const milestone = milestonePrompt({
      guide: next,
      remaining: direct,
      metric,
      bearing: geoBearing({ from: position, to: plan.destination.point }),
    });
    return milestone ?? { guide: next, prompts: [] };
  }

  let next: RouteGuide = { ...guide, progress, remainingMeters: progress.remainingMeters };
  if (
    direct <= ARRIVAL_RADIUS_METERS ||
    (isOnRoute(progress) && progress.remainingMeters <= ARRIVAL_RADIUS_METERS)
  ) {
    return arrive();
  }

  const prompts: GuidancePrompt[] = [];
  if (isOnRoute(progress)) {
    next.offRouteSince = null;
    if (next.announcedOffRouteMeters != null) {
      next.announcedOffRouteMeters = null;
      prompts.push({ kind: 'backOnRoute' });
    }
    const announced = new Set(next.announcedTurns);
    for (const [index, turn] of plan.turns.entries()) {
      if (announced.has(index)) continue;
      const ahead = turn.alongMeters - progress.alongMeters;
      if (ahead < 0) {
        announced.add(index);
      } else if (ahead <= TURN_WARNING_METERS) {
        announced.add(index);
        prompts.push({ kind: 'turn', turn, aheadMeters: ahead });
        break;
      }
    }
    next.announcedTurns = [...announced];
    const milestone = milestonePrompt({
      guide: next,
      remaining: progress.remainingMeters,
      metric,
      bearing: null,
    });
    if (milestone) {
      next = milestone.guide;
      prompts.push(...milestone.prompts);
    }
  } else {
    const since = next.offRouteSince ?? time;
    next.offRouteSince = since;
    // Said once, then again only when they've strayed a good deal further.
    const said = next.announcedOffRouteMeters;
    const further = said == null || progress.offRouteMeters >= said + Math.max(50, said * 0.5);
    if (time - since >= OFF_ROUTE_DELAY_MS && further) {
      next.announcedOffRouteMeters = progress.offRouteMeters;
      prompts.push({ kind: 'offRoute', progress });
    }
  }
  return { guide: next, prompts };
}

/** Halfway, then a mile (or kilometre) out, on guidance long enough for each to mean something. */
function milestonePrompt({
  guide,
  remaining,
  metric,
  bearing,
}: {
  guide: RouteGuide;
  remaining: number;
  metric: boolean;
  bearing: number | null;
}): { guide: RouteGuide; prompts: GuidancePrompt[] } | null {
  const length = guide.plan.lengthMeters;
  const lastLeg = metric ? 1_000 : 1_609.344;
  const said = guide.announcedMilestones;
  if (length >= 800 && remaining <= length / 2 && !said.includes('half')) {
    return {
      guide: { ...guide, announcedMilestones: [...said, 'half'] },
      prompts: [{ kind: 'milestone', milestone: 'half', remainingMeters: remaining, bearing }],
    };
  }
  if (length >= lastLeg * 2 && remaining <= lastLeg && !said.includes('last')) {
    return {
      guide: { ...guide, announcedMilestones: ['half', 'last'] },
      prompts: [{ kind: 'milestone', milestone: 'last', remainingMeters: remaining, bearing }],
    };
  }
  return null;
}
