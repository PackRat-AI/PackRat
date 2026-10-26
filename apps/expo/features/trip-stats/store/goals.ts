import { observable, syncState } from '@legendapp/state';
import { syncObservable } from '@legendapp/state/sync';
import { syncedCrud } from '@legendapp/state/sync-plugins/crud';
import { type TripGoal, TripGoalSchema } from '@packrat/schemas/tripStats';
import { isAuthed } from 'expo-app/features/auth/store';
import { apiClient } from 'expo-app/lib/api/packrat';
import { persistPlugin } from 'expo-app/lib/persist-plugin';

export const tripGoalsStore = observable<Record<string, TripGoal>>({});

/** Create and replace both carry the whole goal, so the server can check its window. */
function goalBody(goal: TripGoal) {
  return {
    kind: goal.kind,
    metric: goal.metric,
    target: goal.target,
    year: goal.year ?? null,
    name: goal.name ?? null,
    startDate: goal.startDate ?? null,
    endDate: goal.endDate ?? null,
    trailCode: goal.trailCode ?? null,
    peaks: goal.peaks ?? null,
    parkCodes: goal.parkCodes ?? null,
  };
}

const listGoals = async () => {
  const { data, error } = await apiClient['trip-stats'].goals.get();
  if (error) throw new Error(`Failed to list trip goals: ${error.value}`);
  return TripGoalSchema.array().parse(data);
};

const createGoal = async (goal: TripGoal) => {
  const now = new Date().toISOString();
  const { data, error, status } = await apiClient['trip-stats'].goals.post({
    id: goal.id,
    ...goalBody(goal),
    localCreatedAt: goal.localCreatedAt ?? now,
    localUpdatedAt: goal.localUpdatedAt ?? now,
  });
  // A retried create the server already holds is a success.
  if (status === 409) return goal;
  if (error) throw new Error(`Failed to create trip goal: ${error.value}`);
  return TripGoalSchema.parse(data);
};

const updateGoal = async (changes: Partial<TripGoal>) => {
  // Changes can be partial; the server replaces the whole goal, so send the stored one with them.
  const id = String(changes.id);
  const stored = tripGoalsStore.peek()[id];
  if (!stored) throw new Error(`Trip goal ${id} is not in the store`);
  const goal: TripGoal = { ...stored, ...changes };
  if (goal.deleted) {
    const { error, status } = await apiClient['trip-stats'].goals({ goalId: id }).delete();
    if (error && status !== 404) throw new Error(`Failed to delete trip goal: ${error.value}`);
    return goal;
  }
  const { data, error } = await apiClient['trip-stats'].goals({ goalId: id }).put({
    ...goalBody(goal),
    localUpdatedAt: goal.localUpdatedAt ?? new Date().toISOString(),
  });
  if (error) throw new Error(`Failed to update trip goal: ${error.value}`);
  return TripGoalSchema.parse(data);
};

syncObservable(
  tripGoalsStore,
  syncedCrud({
    fieldUpdatedAt: 'updatedAt',
    fieldCreatedAt: 'createdAt',
    fieldDeleted: 'deleted',
    // The server lists live goals only, so a full replace is how a delete made on another
    // device reaches this one. Pending local changes are kept on top of it.
    mode: 'set',
    persist: { plugin: persistPlugin, retrySync: true, name: 'tripGoals' },
    waitFor: isAuthed,
    waitForSet: isAuthed,
    retry: { infinite: true, backoff: 'exponential', maxDelay: 30000 },
    list: listGoals,
    create: createGoal,
    update: updateGoal,
  }),
);

export const tripGoalsSyncState = syncState(tripGoalsStore);
