'use client';

import { cn } from '@packrat/web-ui/lib/utils';
import Image from 'next/image';
import { useRef, useState } from 'react';

/**
 * Swipeable photo strip for a shared post. Native scroll-snap does the
 * swiping; state only tracks which photo is in view for the dots and the
 * "2 / 4" counter.
 */
export function PhotoGallery({ images, alt }: { images: string[]; alt: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const multiple = images.length > 1;

  function handleScroll() {
    const track = trackRef.current;
    if (!track || track.clientWidth === 0) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  }

  function scrollTo(index: number) {
    const track = trackRef.current;
    track?.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        onScroll={multiple ? handleScroll : undefined}
        className="flex aspect-[4/5] w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain bg-muted [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {images.map((src, index) => (
          <div key={src} className="relative h-full w-full shrink-0 snap-center">
            <Image
              src={src}
              alt={multiple ? `${alt} (photo ${index + 1} of ${images.length})` : alt}
              fill
              priority={index === 0}
              sizes="(max-width: 640px) 100vw, 560px"
              className="object-cover"
            />
          </div>
        ))}
      </div>

      {multiple ? (
        <>
          <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2.5 py-1 font-medium text-white text-xs tabular-nums backdrop-blur">
            {active + 1} / {images.length}
          </span>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((src, index) => (
              <button
                key={src}
                type="button"
                aria-label={`Show photo ${index + 1}`}
                aria-current={index === active}
                onClick={() => scrollTo(index)}
                className={cn(
                  'h-1.5 rounded-full bg-white transition-all',
                  index === active ? 'w-4 opacity-100' : 'w-1.5 opacity-50',
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
