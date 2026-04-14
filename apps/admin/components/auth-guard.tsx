'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getStoredCredentials } from 'admin-app/lib/auth';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getStoredCredentials()) {
      router.replace('/login');
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) return null;
  return <>{children}</>;
}
