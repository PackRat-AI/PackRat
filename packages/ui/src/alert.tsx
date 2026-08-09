/**
 * Web/default `Alert` entry point.
 *
 * The Material-style React Native implementation lives in `alert.rn.tsx` under its own name so the
 * platform files can import it without resolving back to themselves — `alert.android.tsx` importing
 * `./alert` would resolve to `alert.android.tsx` on Android. Same reason `toggle-props.ts` exists.
 *
 * Platform routing: `alert.ios.tsx` (RN core `Alert.alert`/`Alert.prompt` → real
 * `UIAlertController`), `alert.android.tsx` (Material 3 `AlertDialog`, falling back to the RN
 * implementation for prompts and >2-button alerts), and this file for web.
 */

export type { AlertButtonDef, AlertInputValue, AlertMethods, AlertProps } from './alert.rn';
export { Alert, AlertAnchor } from './alert.rn';
