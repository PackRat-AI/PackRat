'use client';

import { getStoredToken } from 'admin-app/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace(getStoredToken() ? '/dashboard' : '/login');
  }, [router]);

  return null;
}
