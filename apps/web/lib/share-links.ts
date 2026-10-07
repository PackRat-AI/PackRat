/** Public origin share links are minted on; the iOS app's universal links point here. */
export const SITE_URL = 'https://packrat.world';

export const APP_STORE_URL = 'https://apps.apple.com/us/app/packrat-ai/id6499243187';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.packratai.mobile';

/** iOS app identity for `apple-app-site-association` — team ID + production bundle ID. */
export const IOS_APP_ID = '666HGMV2LU.com.andrewbierman.packrat';

export function sharedPostUrl(publicId: string): string {
  return `${SITE_URL}/p/${publicId}`;
}

/** Custom-scheme fallback for opening the post from the web page itself, where a tap on a
 *  same-domain link never triggers the universal link. */
export function sharedPostAppUrl(publicId: string): string {
  return `packrat://post/${publicId}`;
}
