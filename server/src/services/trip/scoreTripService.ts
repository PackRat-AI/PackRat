import { calculateTripScore } from '../../utils/scoreTrip';
import { Trip } from '../../drizzle/methods/trip';

export async function scoreTripService(tripId: string) {
  try {
    const tripClass = new Trip();
    const trip = await tripClass.findById(tripId);

    if (!trip) {
      throw new Error('Pack not found');
    }
    const tripScore = calculateTripScore({
      startDate: trip.start_date,
      endDate: trip.end_date,
      activity: trip.activity || null,
    });

    const updatedPack = await tripClass.update({
      ...trip,
      scores: tripScore || null,
    });

    return updatedPack;
  } catch (error) {
    throw new Error('Unable to score trip: ' + error.message);
  }
}
