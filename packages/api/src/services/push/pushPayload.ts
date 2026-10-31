/** What every push carries, whichever gateway delivers it. The app routes a tap by the id present. */
export type PushPayload = {
  alert: { title: string; body: string };
  sound?: string;
  badge?: number;
} & (
  | { weatherLocationId: number }
  // reportId: a trail report on that trip, opened over it.
  | { tripId: string; reportId?: string }
  | { postId: number }
);
