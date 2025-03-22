import React, { useRef, type FC } from 'react';
import MapboxGL, { Camera } from '@rnmapbox/maps';
import { MAPBOX_ACCESS_TOKEN } from '@packrat/config';
import { type MapViewProps } from './model';
import { getBoundingBoxFromShape } from '../utils';
import { View } from 'react-native';
import flat from 'lodash/flatten';

MapboxGL.setAccessToken(MAPBOX_ACCESS_TOKEN);

export const MapView: FC<MapViewProps> = ({
  shape,
  shapeURI,
  isInteractive,
  mapStyle,
  initialBounds,
  onVisibleBoundsChange,
}) => {
  const mapView = useRef<MapboxGL.MapView>(null);
  const bounds = Array.isArray(initialBounds)
    ? flat(initialBounds)
    : getBoundingBoxFromShape(shape);
  const onCameraChange = ({ properties: { visibleBounds } }) => {
    onVisibleBoundsChange(visibleBounds);
  };

  return (
    <View style={{ flexDirection: 'row', width: '100%', height: '100%' }}>
      <MapboxGL.MapView
        ref={mapView as any}
        styleURL={mapStyle}
        compassEnabled={false}
        style={{ flex: 1 }}
        logoEnabled={false}
        onRegionDidChange={onCameraChange}
        zoomEnabled={isInteractive}
        scrollEnabled={isInteractive}
        rotateEnabled={isInteractive}
      >
        <Camera
          zoomLevel={9}
          animationMode="flyTo"
          bounds={
            bounds
              ? { sw: [bounds[0], bounds[1]], ne: [bounds[2], bounds[3]] }
              : undefined
          }
        />
        <MapboxGL.ShapeSource shape={shape} url={shapeURI} id="geojson">
          <MapboxGL.FillLayer id="place" style={{ fillOpacity: 0.3 }} />
        </MapboxGL.ShapeSource>
      </MapboxGL.MapView>
    </View>
  );
};
