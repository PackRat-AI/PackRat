'use client';

import { getStoredToken } from 'admin-app/lib/auth';
import { isBehindCFAccess } from 'admin-app/lib/cfAccess';
import { useRouter } from 'next/navigation';
import type React from 'react';
import { useEffect, useState } from 'react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let canceled = false;

    async function check() {
      if (await isBehindCFAccess()) {
        if (!canceled) setReady(true);
        return;
      }
      if (!getStoredToken()) {
        if (!canceled) router.replace('/login');
        return;
      }
      if (!canceled) setReady(true);
    }

    void check().catch(() => {
      if (!canceled) router.replace('/login');
    });

    return () => {
      canceled = true;
    };
  }, []); // router is stable in App Router

  if (!ready) return null;
  return <>{children}</>;
}
