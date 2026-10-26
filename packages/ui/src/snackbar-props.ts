import type { Ref } from 'react';

export type SnackbarResult = 'actionPerformed' | 'dismissed';

export interface SnackbarShowOptions {
  message: string;
  /** One short action, e.g. "Undo". Omit for an informational snackbar. */
  actionLabel?: string;
}

export interface SnackbarHandle {
  /** Resolves when the snackbar closes: `actionPerformed` if its action was tapped. */
  show: (options: SnackbarShowOptions) => Promise<SnackbarResult>;
}

export interface SnackbarProps {
  ref?: Ref<SnackbarHandle>;
  testID: string;
  /** Distance from the bottom edge, e.g. the safe-area inset. */
  bottomOffset?: number;
}
