import { type ImageProps, type ImageStyle, Platform } from 'react-native';

function getResizeModeObjectFit(resizeMode: ImageProps['resizeMode']): ImageStyle['objectFit'] {
  if (resizeMode === 'contain' || resizeMode === 'cover') return resizeMode;
  if (resizeMode === 'stretch') return 'fill';
  return 'cover';
}

export function getWebImageContainmentStyle(
  resizeMode: ImageProps['resizeMode'],
): ImageStyle | undefined {
  return Platform.select({
    web: {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: getResizeModeObjectFit(resizeMode),
    } as ImageStyle,
    default: undefined,
  });
}
