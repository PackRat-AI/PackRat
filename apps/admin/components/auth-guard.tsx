'use client';

import { getStoredToken } from 'admin-app/lib/auth';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!getStoredToken()) router.replace('/login');
  }, [router]);

  if (!getStoredToken()) return null;
  return <>{children}</>;
}
