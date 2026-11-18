import { describe, expect, it } from 'vitest';
import {
  isPermissionDeniedError,
  PERMISSION_DENIED_COPY,
  PermissionDeniedError,
} from '../permissionDenied';

describe('PermissionDeniedError', () => {
  it('carries which permission was refused', () => {
    const camera = new PermissionDeniedError('camera');
    const photos = new PermissionDeniedError('photos');
    expect(camera.permission).toBe('camera');
    expect(camera.name).toBe('PermissionDeniedError');
    expect(camera.message).toBe('Permission to access camera was denied');
    expect(photos.permission).toBe('photos');
    expect(photos.message).toBe('Permission to access media library was denied');
  });
});

describe('isPermissionDeniedError', () => {
  it('recognises a refused permission', () => {
    expect(isPermissionDeniedError(new PermissionDeniedError('photos'))).toBe(true);
  });

  it('leaves every other failure to the caller', () => {
    expect(isPermissionDeniedError(new Error('Permission to access camera was denied'))).toBe(
      false,
    );
    expect(isPermissionDeniedError('denied')).toBe(false);
    expect(isPermissionDeniedError(null)).toBe(false);
  });
});

describe('PERMISSION_DENIED_COPY', () => {
  it('names a title and message for each permission', () => {
    expect(PERMISSION_DENIED_COPY.camera).toEqual({
      title: 'permissions.cameraOffTitle',
      message: 'permissions.cameraOffMessage',
    });
    expect(PERMISSION_DENIED_COPY.photos).toEqual({
      title: 'permissions.photosOffTitle',
      message: 'permissions.photosOffMessage',
    });
  });

  it('cannot be changed at runtime', () => {
    expect(Object.isFrozen(PERMISSION_DENIED_COPY)).toBe(true);
    expect(Object.isFrozen(PERMISSION_DENIED_COPY.camera)).toBe(true);
  });
});
