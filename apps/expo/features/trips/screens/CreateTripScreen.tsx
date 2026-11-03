import { type StartingTrail, TripForm } from '../components/TripForm';

export function CreateTripScreen({ startingTrail }: { startingTrail?: StartingTrail }) {
  return <TripForm startingTrail={startingTrail} />;
}
