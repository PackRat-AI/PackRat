import { buttonVariants, cn } from '@packrat/web-ui';
import Image from 'next/image';
import { APP_STORE_URL, PLAY_STORE_URL } from 'web-app/lib/share-links';

/**
 * Call to action under a shared post. `appUrl` opens the post in the app for
 * visitors who already have it; the store links are for everyone else.
 */
export function GetTheApp({ appUrl, title }: { appUrl?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 text-center">
      <h2 className="font-semibold text-lg">{title}</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Plan trips, build lighter packs, and share your adventures with other hikers.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        {appUrl ? (
          <a href={appUrl} className={cn(buttonVariants({ size: 'lg' }), 'rounded-xl')}>
            Open in PackRat
          </a>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={APP_STORE_URL}
            className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'rounded-xl px-3')}
          >
            App Store
          </a>
          <a
            href={PLAY_STORE_URL}
            className={cn(buttonVariants({ variant: 'secondary', size: 'lg' }), 'rounded-xl px-3')}
          >
            Google Play
          </a>
        </div>
      </div>
    </section>
  );
}

export function ShareHeader() {
  return (
    <header className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2 font-semibold">
        <Image src="/apple-icon.png" alt="" width={28} height={28} className="rounded-lg" />
        PackRat
      </div>
      <a
        href={APP_STORE_URL}
        className={cn(buttonVariants({ size: 'sm' }), 'h-8 rounded-full px-4 text-xs')}
      >
        Get the app
      </a>
    </header>
  );
}
