/**
 * Web stub for react-native-maps.
 * Map features are not yet supported on web. Components render null.
 */
const React = require('react');

const MapView = React.forwardRef((_props, _ref) => null);
MapView.displayName = 'MapView';

const Marker = (_props) => null;
Marker.displayName = 'Marker';

const Callout = (_props) => null;
Callout.displayName = 'Callout';

const Polyline = (_props) => null;
Polyline.displayName = 'Polyline';

const PROVIDER_GOOGLE = 'google';
const PROVIDER_DEFAULT = null;

module.exports = {
  default: MapView,
  MapView,
  Marker,
  Callout,
  Polyline,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
};
