'use client';

import { Button } from '@packrat/web-ui';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

const DISMISSED_KEY = 'download_cta_dismissed';
const IOS_RE = /iphone|ipad|ipod/;
const ANDROID_RE = /android/;

function getStoreLinks() {
  if (typeof navigator === 'undefined') return { ios: false, android: false };
  const ua = navigator.userAgent.toLowerCase();
  return {
    ios: IOS_RE.test(ua),
    android: ANDROID_RE.test(ua),
  };
}

export function DownloadCTA() {
  const [visible, setVisible] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'both'>('both');

  useEffect(() => {
    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    const { ios, android } = getStoreLinks();
    if (ios) setPlatform('ios');
    else if (android) setPlatform('android');
    setVisible(true);
  }, []);

  function dismiss() {
    sessionStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 p-4 shadow-lg backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">Get more with PackRat</p>
          <p className="truncate text-xs text-muted-foreground">
            Plan trips, track gear, and explore trails — all in one app.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {(platform === 'ios' || platform === 'both') && (
            <Button asChild size="sm" variant={platform === 'both' ? 'outline' : 'default'}>
              <a
                href="https://apps.apple.com/app/packrat/id6738473781"
                target="_blank"
                rel="noreferrer"
              >
                App Store
              </a>
            </Button>
          )}
          {(platform === 'android' || platform === 'both') && (
            <Button asChild size="sm">
              <a
                href="https://play.google.com/store/apps/details?id=com.packratai.packrat"
                target="_blank"
                rel="noreferrer"
              >
                Google Play
              </a>
            </Button>
          )}
          <button
            type="button"
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
