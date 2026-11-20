/** A device permission the user can turn off for PackRat in system settings. */
export type DeniedPermission = 'camera' | 'photos';

/** The user has refused a permission, so the action can only go ahead after a trip to Settings. */
export class PermissionDeniedError extends Error {
  constructor(readonly permission: DeniedPermission) {
    super(
      permission === 'camera'
        ? 'Permission to access camera was denied'
        : 'Permission to access media library was denied',
    );
    this.name = 'PermissionDeniedError';
  }
}

export function isPermissionDeniedError(error: unknown): error is PermissionDeniedError {
  return error instanceof PermissionDeniedError;
}

/** Translation keys for the "access is off" dialog of each permission. */
export const PERMISSION_DENIED_COPY = Object.freeze({
  camera: Object.freeze({
    title: 'permissions.cameraOffTitle',
    message: 'permissions.cameraOffMessage',
  } as const),
  photos: Object.freeze({
    title: 'permissions.photosOffTitle',
    message: 'permissions.photosOffMessage',
  } as const),
} as const);
