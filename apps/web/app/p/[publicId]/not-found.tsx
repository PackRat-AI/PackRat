import { ImageOff } from 'lucide-react';
import { GetTheApp, ShareHeader } from 'web-app/components/shared-post/get-the-app';

export default function SharedPostNotFound() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-[560px] pb-10">
        <ShareHeader />
        <div className="flex flex-col items-center px-6 pt-16 pb-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <ImageOff className="size-6 text-muted-foreground" />
          </span>
          <h1 className="mt-5 font-semibold text-xl">This post isn't available</h1>
          <p className="mt-2 max-w-xs text-muted-foreground text-sm">
            It may have been removed by the person who shared it, or the link may be incomplete.
          </p>
        </div>
        <div className="px-4 sm:px-0">
          <GetTheApp title="Find more adventures on PackRat" />
        </div>
      </div>
    </div>
  );
}
