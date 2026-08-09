// Platform dispatch only — Metro resolves loading-indicator.ios.tsx / .android.tsx at bundle
// time. This file exists purely so TypeScript (which has no platform-suffix resolution) has a
// base module to resolve `@packrat/ui/src/loading-indicator` against.

export type { ActivityIndicatorProps, ActivityIndicatorSize } from './loading-indicator.ios';
export { ActivityIndicator } from './loading-indicator.ios';
