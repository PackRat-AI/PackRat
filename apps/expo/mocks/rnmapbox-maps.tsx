// Web stub for @rnmapbox/maps, whose web build needs mapbox-gl. Offline maps are an Android
// feature; on web the map renders as an empty view and the offline manager does nothing.
// This file is only bundled on web via the metro WEB_STUBS resolver.

import type React from 'react';
import { View, type ViewProps } from 'react-native';

const Nothing = (_props: { children?: React.ReactNode }) => null;

const MapView = ({ style, testID }: ViewProps) => <View style={style} testID={testID} />;

const noop = () => Promise.resolve();

const offlineManager = {
  createPack: noop,
  deletePack: noop,
  getPack: () => Promise.resolve(null),
  setProgressEventThrottle: () => undefined,
  subscribe: noop,
};

const Mapbox = {
  Camera: Nothing,
  CircleLayer: Nothing,
  LineLayer: Nothing,
  LocationPuck: Nothing,
  MapView,
  ShapeSource: Nothing,
  offlineManager,
  setAccessToken: noop,
};

export default Mapbox;
