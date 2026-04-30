import React from 'react';
import { View } from 'react-native';

const MapView = ({
  children,
  style,
  ...props
}: {
  children?: React.ReactNode;
  style?: unknown;
  [key: string]: unknown;
}) =>
  React.createElement(
    View,
    { style: [{ backgroundColor: '#e0e0e0', flex: 1 }, style], ...props },
    children,
  );

const Marker = () => null;

export default MapView;
export { Marker };
