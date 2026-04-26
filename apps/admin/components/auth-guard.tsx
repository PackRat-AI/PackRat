'use client';

import { getStoredToken } from 'admin-app/lib/auth';
import { useCFAccessIdentity } from 'admin-app/lib/cfAccess';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: cfIdentity, isPending } = useCFAccessIdentity();

  useEffect(() => {
    if (isPending) return;
    if (cfIdentity) return; // CF Access session active — allow through
    if (!getStoredToken()) router.replace('/login');
  }, [isPending, cfIdentity, router]);

  if (isPending || (!cfIdentity && !getStoredToken())) return null;
  return <>{children}</>;
}
