'use client';

import { FeaturedPackDetail } from 'admin-app/components/featured-packs/featured-pack-detail';
import { FeaturedPackList } from 'admin-app/components/featured-packs/featured-pack-list';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// The admin app is a static export, so the detail view is `?id=` on this route
// rather than a dynamic `[id]` segment.
function FeaturedPacksRoute() {
  const id = useSearchParams()?.get('id');
  return id ? <FeaturedPackDetail key={id} id={id} /> : <FeaturedPackList />;
}

export default function FeaturedPacksPage() {
  return (
    <Suspense>
      <FeaturedPacksRoute />
    </Suspense>
  );
}
