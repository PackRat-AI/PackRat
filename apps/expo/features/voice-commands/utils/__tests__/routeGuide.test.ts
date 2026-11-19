import { describe, expect, it } from 'vitest';
import {
  destinationOptions,
  type GuidancePrompt,
  guidancePlan,
  isGuideOffRoute,
  maneuver,
  newGuide,
  nextTurn,
  pathTurns,
  promptKind,
  type RouteGuide,
  resolveDestination,
  TRAILHEAD,
  updateGuide,
} from '../routeGuide';
import { compassName, type GeoPoint, geoDistance } from '../routeProgress';
import type { TripWaypoint } from '../tripWaypoints';
import {
  alreadyThere,
  guidancePromptText,
  guidanceRemaining,
  navigatingAnswer,
  navigatingOtherTrip,
  navigationStopped,
  unknownDestination,
} from '../voiceAnswers';
import { parseVoiceCommand } from '../voiceCommand';

// North for about 1.1 km, then a right turn east for about 1.1 km.
const route: GeoPoint[] = [
  { latitude: 47.0, longitude: -120.0 },
  { latitude: 47.01, longitude: -120.0 },
  { latitude: 47.01, longitude: -119.985 },
];
const start = 1_800_000_000_000;
const [routeStart, , routeEnd] = route as [GeoPoint, GeoPoint, GeoPoint];

function waypoint({
  name,
  latitude,
  longitude,
}: {
  name: string;
  latitude: number;
  longitude: number;
}): TripWaypoint {
  return { id: name, name, note: null, latitude, longitude, createdAt: '2026-11-06T12:00:00Z' };
}

/** Steps a guide and hands back what it said, as text. */
function walker(destination = 'camp') {
  let guide: RouteGuide = newGuide(
    guidancePlan({ from: routeStart, to: { name: destination, point: routeEnd }, route }),
  );
  return {
    get guide() {
      return guide;
    },
    step(position: GeoPoint, seconds: number): { kinds: GuidancePrompt['kind'][]; text: string[] } {
      const result = updateGuide({ guide, position, time: start + seconds * 1_000, metric: false });
      guide = result.guide;
      return {
        kinds: result.prompts.map((p) => p.kind),
        text: result.prompts.map((prompt) =>
          guidancePromptText({ prompt, destination, metric: false }),
        ),
      };
    },
  };
}

describe('navigation phrasings', () => {
  it.each([
    ['Navigate to camp', { kind: 'navigate', to: 'camp' }],
    ['take me back to the car', { kind: 'navigate', to: 'the car' }],
    ['guide me to the end of the route', { kind: 'navigate', to: 'the end of the route' }],
    ['Stop navigating', { kind: 'stopNavigating' }],
    ['cancel navigation', { kind: 'stopNavigating' }],
    ['how far to go to camp', { kind: 'howFarToGo' }],
  ])('%s', (transcript, expected) => {
    expect(parseVoiceCommand(transcript)).toEqual(expected);
  });
});

describe('destinations', () => {
  const waypoints = [
    waypoint({ name: 'Camp', latitude: 47.01, longitude: -119.99 }),
    waypoint({ name: 'Water source', latitude: 47.005, longitude: -120.0 }),
  ];

  it('is a marked waypoint first, then an end of the route', () => {
    expect(resolveDestination({ spoken: 'camp', waypoints, route })?.name).toBe('Camp');
    expect(resolveDestination({ spoken: 'the water', waypoints, route })?.name).toBe(
      'Water source',
    );
    expect(resolveDestination({ spoken: 'the car', waypoints, route })).toEqual({
      name: TRAILHEAD,
      point: routeStart,
    });
    expect(resolveDestination({ spoken: 'end of the route', waypoints: [], route })?.point).toEqual(
      routeEnd,
    );
    expect(resolveDestination({ spoken: 'the bridge', waypoints, route })).toBeNull();
    expect(resolveDestination({ spoken: 'the trailhead', waypoints: [], route: [] })).toBeNull();
  });

  it('offers the newest plain waypoints, then the ends of the route', () => {
    const withNote = {
      ...waypoint({ name: 'Washout', latitude: 47.0, longitude: -120.0 }),
      note: 'Bridge is out',
    };
    expect(destinationOptions({ waypoints: [...waypoints, withNote], route })).toEqual([
      'Water source',
      'Camp',
      'the trailhead',
      'the end of your route',
    ]);
  });
});

describe('plan', () => {
  it('reaches a destination on the route along it, with its one real turn', () => {
    const plan = guidancePlan({
      from: routeStart,
      to: { name: 'the end of your route', point: routeEnd },
      route,
    });
    expect(plan.path?.[0]).toEqual(routeStart);
    expect(plan.path?.at(-1)).toEqual(routeEnd);
    expect(Math.abs(plan.lengthMeters - 2_250)).toBeLessThan(20);
    expect(plan.turns).toHaveLength(1);
    const [turn] = plan.turns;
    expect(Math.abs((turn?.degrees ?? 0) - 90)).toBeLessThan(5);
    expect(turn && maneuver(turn)).toBe('turn right');
    expect(compassName(turn?.headingAfter ?? 0)).toBe('east');
  });

  it('runs the route backwards to the trailhead', () => {
    const here = { latitude: 47.01, longitude: -119.99 };
    const plan = guidancePlan({ from: here, to: { name: TRAILHEAD, point: routeStart }, route });
    const first = plan.path?.[0];
    expect(first && geoDistance({ from: first, to: here })).toBeLessThan(5);
    expect(plan.path?.at(-1)).toEqual(routeStart);
    expect(plan.turns[0] && maneuver(plan.turns[0])).toBe('turn left');
  });

  it('points straight to a destination off the route', () => {
    const plan = guidancePlan({
      from: routeStart,
      to: { name: 'the lake', point: { latitude: 47.0, longitude: -119.97 } },
      route,
    });
    expect(plan.path).toBeNull();
    expect(plan.turns).toEqual([]);
    expect(navigatingAnswer({ plan, from: routeStart, metric: false })).toBe(
      "The lake is 1.4 miles east of you. I'll tell you when you're there.",
    );
  });

  it('leaves switchbacks on a climb out', () => {
    const zigzag = Array.from({ length: 9 }, (_, i) => ({
      latitude: 47.0 + i * 0.0008,
      longitude: i % 2 === 0 ? -120.0 : -119.999,
    }));
    expect(pathTurns(zigzag)).toEqual([]);
  });
});

describe('prompts', () => {
  it('says the turn once, a little before it', () => {
    const walk = walker();
    expect(walk.step({ latitude: 47.005, longitude: -120.0 }, 0).text).toEqual([]);
    expect(walk.step({ latitude: 47.009, longitude: -120.0 }, 60).text).toEqual([
      'In 350 feet, turn right, heading east.',
    ]);
    expect(walk.step({ latitude: 47.0095, longitude: -120.0 }, 90).text).toEqual([]);
  });

  it('says halfway, then arrival', () => {
    const walk = walker();
    walk.step({ latitude: 47.009, longitude: -120.0 }, 0);
    expect(walk.step({ latitude: 47.01, longitude: -119.9995 }, 60)).toEqual({
      kinds: ['milestone'],
      text: ['Halfway to camp. Three quarters of a mile to go.'],
    });
    expect(walk.step({ latitude: 47.01, longitude: -119.9852 }, 900).text).toEqual([
      "You've reached camp.",
    ]);
    expect(walk.guide.hasArrived).toBe(true);
    expect(walk.step({ latitude: 47.01, longitude: -119.9852 }, 960).text).toEqual([]);
  });

  it('says off route after a while, once, then again only further away', () => {
    const walk = walker();
    const east = { latitude: 47.005, longitude: -119.996 };
    expect(walk.step(east, 0).text).toEqual([]);
    expect(walk.step(east, 25).text).toEqual([
      "You're off route. Head west about 1,000 feet to rejoin it.",
    ]);
    expect(walk.step(east, 60).text).toEqual([]);
    expect(walk.step({ latitude: 47.005, longitude: -119.992 }, 90).kinds).toEqual(['offRoute']);
    expect(walk.step({ latitude: 47.005, longitude: -120.0 }, 120).text[0]).toBe(
      "You're back on route.",
    );
  });

  it('counts down straight to a destination off the route: halfway, then a mile out', () => {
    const lake = { name: 'the lake', point: { latitude: 47.04, longitude: -120.0 } };
    let guide = newGuide(guidancePlan({ from: routeStart, to: lake, route: [] }));
    const say = (latitude: number, seconds: number) => {
      const result = updateGuide({
        guide,
        position: { latitude, longitude: -120.0 },
        time: start + seconds * 1_000,
        metric: false,
      });
      guide = result.guide;
      return result.prompts.map((prompt) =>
        guidancePromptText({ prompt, destination: 'the lake', metric: false }),
      );
    };
    expect(say(47.021, 0)).toEqual(['Halfway to the lake. 1.3 miles to go, north.']);
    expect(say(47.03, 600)).toEqual(['Three quarters of a mile to the lake, north.']);
    expect(Math.round(guide.remainingMeters)).toBe(1_112);
  });
});

describe('card and answers', () => {
  it('groups back on route with off route in Settings', () => {
    expect(promptKind({ kind: 'backOnRoute' })).toBe('offRoute');
    expect(promptKind({ kind: 'arrived' })).toBe('arrived');
  });

  it('shows the next turn until it is passed, and whether the user is off route', () => {
    const walk = walker();
    expect(nextTurn(walk.guide)).toBeNull();
    walk.step({ latitude: 47.005, longitude: -120.0 }, 0);
    const turn = nextTurn(walk.guide);
    expect(turn && maneuver(turn)).toBe('turn right');
    expect(isGuideOffRoute(walk.guide)).toBe(false);
    walk.step({ latitude: 47.01, longitude: -119.995 }, 600);
    expect(nextTurn(walk.guide)).toBeNull();

    const strayed = walker();
    strayed.step({ latitude: 47.005, longitude: -119.996 }, 0);
    strayed.step({ latitude: 47.005, longitude: -119.996 }, 25);
    expect(isGuideOffRoute(strayed.guide)).toBe(true);
  });

  it('says how far to go, and how far off the route', () => {
    const walk = walker();
    walk.step({ latitude: 47.005, longitude: -120.0 }, 0);
    expect(guidanceRemaining({ guide: walk.guide, bearing: 0, metric: false })).toBe(
      '1.1 miles to camp.',
    );
    walk.step({ latitude: 47.005, longitude: -119.996 }, 30);
    expect(guidanceRemaining({ guide: walk.guide, bearing: 0, metric: false })).toBe(
      "1.1 miles to camp. You're 1,000 feet off your route.",
    );
  });

  it('names the places it can navigate to when it cannot find one', () => {
    expect(unknownDestination({ spoken: 'the bridge', options: ['camp', 'the trailhead'] })).toBe(
      "I couldn't find the bridge. You can navigate to camp or the trailhead.",
    );
    expect(unknownDestination({ spoken: '', options: ['camp', 'the lake', 'the trailhead'] })).toBe(
      "I couldn't find that place. You can navigate to camp, the lake or the trailhead.",
    );
    expect(unknownDestination({ spoken: 'the bridge', options: ['camp'] })).toBe(
      "I couldn't find the bridge. You can navigate to camp.",
    );
    expect(unknownDestination({ spoken: 'the bridge', options: [] })).toBe(
      "I couldn't find the bridge. There's nowhere to navigate to yet. Mark a waypoint or add a planned route first.",
    );
  });

  it('answers stop, another trip and already there', () => {
    expect(navigationStopped(true)).toBe('Navigation stopped. Tracking carries on.');
    expect(navigationStopped(false)).toBe('Navigation stopped.');
    expect(navigatingOtherTrip('Mailbox Peak')).toBe(
      "You're navigating on Mailbox Peak. Stop that first.",
    );
    expect(alreadyThere('camp')).toBe("You're already at camp.");
  });
});
