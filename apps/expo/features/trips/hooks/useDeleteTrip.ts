import { tripsStore } from 'expo-app/features/trips/store/trips';
import { useCallback } from 'react';

export function useDeleteTrip() {
    const deleteTrip = useCallback((id: string) => {
        // Soft delete by setting deleted flag
        // @ts-ignore: Safe because Legend-State uses Proxy
        if (tripsStore[id]) {
            tripsStore[id].deleted.set(true);
        }
    }, []);

    return deleteTrip;
}
