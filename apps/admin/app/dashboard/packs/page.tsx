'use client';

import { PackDetail } from 'admin-app/components/packs/pack-detail';
import { PackList } from 'admin-app/components/packs/pack-list';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// The admin app is a static export, so the detail view is `?id=` on this route
// rather than a dynamic `[id]` segment.
function PacksRoute() {
  const id = useSearchParams()?.get('id');
  return id ? <PackDetail key={id} id={id} /> : <PackList />;
}

export default function PacksPage() {
  return (
    <Suspense>
      <PacksRoute />
    </Suspense>
  );
}
