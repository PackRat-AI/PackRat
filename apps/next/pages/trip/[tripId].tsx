import { TripDetails } from 'app/screens/trip/TripDetails';
import { AuthWrapper } from 'auth/authWrapper';

export default function Trip() {
  return (
    <>
      <TripDetails />
    </>
  );
}

Trip.getLayout = function getLayout(page: any) {
  return <AuthWrapper>{page}</AuthWrapper>;
};
