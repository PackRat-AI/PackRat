import AppearanceContainer from 'app/screens/appearance/AppearanceContainer';
import { AuthWrapper } from 'app/auth/AuthWrapper';
import { createLazyFileRoute } from '@tanstack/react-router';

export const Route = createLazyFileRoute('/appearance/')({
  component: Appearance,
});

export default function Appearance() {
  return (
    <AuthWrapper>
      <AppearanceContainer />
    </AuthWrapper>
  );
}
