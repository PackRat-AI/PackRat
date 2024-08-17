import React from 'react';
import { DashboardScreen } from 'app/modules/dashboard';
import LandingPage from 'app/components/landing_page';
import { createFileRoute } from '@tanstack/react-router';
import { AuthWrapper } from 'app/modules/auth';

export const Route = createFileRoute('/')({
  component: Home,
});

export default function Home() {
  return (
    <AuthWrapper unauthorizedElement={<LandingPage />}>
      <DashboardScreen />
    </AuthWrapper>
  );
}
