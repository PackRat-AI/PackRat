'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getStoredCredentials } from 'admin-app/lib/auth';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getStoredCredentials() ? '/dashboard' : '/login');
  }, [router]);

  return null;
}
