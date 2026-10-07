import { APP_STORE_URL, PLAY_STORE_URL } from 'landing-app/lib/shared-post';
import { Apple, Backpack, Store } from 'lucide-react';

/**
 * Call to action under a shared post. `appUrl` opens the post in the app for
 * visitors who already have it; the store links are for everyone else.
 */
export function GetTheApp({ appUrl, title }: { appUrl?: string; title: string }) {
  return (
    <section className="apple-card p-6 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-apple-blue/10">
        <Backpack className="h-5 w-5 text-apple-blue" aria-hidden="true" />
      </span>
      <h2 className="mt-3 font-semibold text-lg tracking-tight">{title}</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        Plan trips, build lighter packs, and share your adventures with other hikers.
      </p>
      <div className="mt-5 flex flex-col gap-3">
        {appUrl ? (
          <a
            href={appUrl}
            className="inline-flex h-12 items-center justify-center rounded-full bg-apple-blue px-8 font-medium text-sm text-white transition-colors hover:bg-apple-blue/90"
          >
            Open in PackRat
          </a>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 font-medium text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Apple className="h-5 w-5" aria-hidden="true" />
            App Store
          </a>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 font-medium text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10"
          >
            <Store className="h-5 w-5" aria-hidden="true" />
            Google Play
          </a>
        </div>
      </div>
    </section>
  );
}
