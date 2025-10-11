import { useObservable, use$ } from '@legendapp/state/react';

/**
 * Type for the trip location.
 */
export type TripLocation = {
    name: string;
    latitude: number;
    longitude: number;
};

/**
 * Simple reactive store for the current trip location.
 * Fully local, no backend sync.
 */
export const tripLocationStore = useObservable<TripLocation | null>(null);

/**
 * Hook to use trip location in any component.
 */
export function useTripLocation() {
    const location = use$(() => tripLocationStore.get());

    const setLocation = (loc: TripLocation | null) => {
        tripLocationStore.set(loc);
    };

    return { location, setLocation };
}
