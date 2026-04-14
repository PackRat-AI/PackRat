'use client';

import { getStoredCredentials } from 'admin-app/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getStoredCredentials() ? '/dashboard' : '/login');
  }, [router]);

  return null;
}
