/**
 * Returns the Expo Router `push` arguments for navigating to a trip detail screen.
 *
 * The Expo Router route is `/trip/[id]` (singular).  Using this helper keeps
 * the route string in one place and makes it trivially testable.
 */
export function getTripNavigationParams(tripId: string) {
  return {
    pathname: '/trip/[id]' as const,
    params: { id: tripId },
  };
}
