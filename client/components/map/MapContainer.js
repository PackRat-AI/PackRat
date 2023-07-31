import React, { useEffect, useState, useRef } from "react";
import { Platform, StyleSheet, Text, View, Picker } from "react-native";

import Mapbox from "@rnmapbox/maps";
import { Select, Center, Box, CheckIcon } from "native-base";

// get mapbox access token from .env file
import { MAPBOX_ACCESS_TOKEN } from "@env";
console.log("MAPBOX_ACCESS_TOKEN", MAPBOX_ACCESS_TOKEN);

Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);

// MapboxGL.setConnected(true);

console.log("Mapbox:", Mapbox);
console.log("Mapbox.MapView:", Mapbox?.MapView);

export function BasicMap() {
  return (
    <View style={{ flex: 1 }}>
      <Mapbox.MapView style={{ flex: 1 }} />
    </View>
  );
}

export function CustomizedMap() {
  const mapViewRef = useRef(null);

  const [style, setStyle] = React.useState(
    "mapbox://styles/mapbox/outdoors-v11"
  );

  useEffect(() => {
    console.log("StyleURL:", Mapbox?.StyleURL);
  }, []);

  const [lng, setLng] = useState(103.8519599);
  const [lat, setLat] = useState(1.29027);

  const [mapViewLoaded, setMapViewLoaded] = useState(false);

  function handleMapViewLayout() {
    setMapViewLoaded(true);
  }

  const handleStyleChange = (value) => {
    setStyle(value);
  };

  function getShapeSourceBounds(shape) {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    shape.features[0].geometry.coordinates.forEach((coord) => {
      const lng = coord[0];
      const lat = coord[1];

      if (lng < minLng) {
        minLng = lng;
      }
      if (lng > maxLng) {
        maxLng = lng;
      }
      if (lat < minLat) {
        minLat = lat;
      }
      if (lat > maxLat) {
        maxLat = lat;
      }
    });

    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
  }

  const [shapeSourceBounds, setShapeSourceBounds] = useState(null);

  function handleShapeSourceLoad() {
    const shape = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: [
              [-77.044211, 38.852924],
              [-77.045659, 38.860158],
              [-77.044232, 38.862326],
              [-77.040879, 38.865454],
              [-77.039936, 38.867698],
              [-77.040338, 38.86943],
              [-77.04264, 38.872528],
              [-77.03696, 38.878424],
              [-77.032309, 38.87937],
              [-77.030056, 38.880945],
              [-77.027645, 38.881779],
              [-77.026946, 38.882645],
              [-77.026942, 38.885502],
              [-77.028054, 38.887449],
              [-77.02806, 38.892088],
              [-77.03364, 38.892108],
              [-77.033643, 38.899926],
            ],
          },
        },
      ],
    };

    const bounds = getShapeSourceBounds(shape);

    mapViewRef.current.fitBounds(bounds, {
      edgePadding: {
        top: 5,
        right: 5,
        bottom: 5,
        left: 5,
      },
    });

    mapViewRef.current.setCamera({
      centerCoordinate: mapViewRef.current.getCenter(),
      zoomLevel: Math.min(
        mapViewRef.current.zoomLevel,
        mapViewRef.current.getZoomForBounds(bounds, { padding: 50 })
      ),
    });
  }

  // function handleMapIdle() {
  //   if (shapeSourceBounds) {
  //     mapViewRef.current.setCamera({
  //       centerCoordinate: mapViewRef.current.getCenter(),
  //       zoomLevel: Math.min(
  //         mapViewRef.current.zoomLevel,
  //         mapViewRef.current.getZoomForBounds(shapeSourceBounds, { padding: 50 })
  //       )
  //     });
  //   }
  // }

  function handleShapePress(event) {
    // Get the ID of the clicked feature
    const featureId = event.features[0].id;

    // Do something with the ID, e.g. display an info window
    console.log(`Shape with ID ${featureId} was clicked!`);
  }

  return (
    <View style={{ flex: 1 }}>
      <Select
        selectedValue={style}
        minWidth="200"
        accessibilityLabel="Choose Service"
        placeholder="Choose Service"
        _selectedItem={{
          bg: "teal.600",
          endIcon: <CheckIcon size="5" />,
        }}
        mt={1}
        onValueChange={(itemValue) => setStyle(itemValue)}
      >
        <Select.Item
          label="mapbox://styles/mapbox/dark-v10"
          value="mapbox://styles/mapbox/dark-v10"
        />
        <Select.Item
          label="mapbox://styles/mapbox/light-v10"
          value="mapbox://styles/mapbox/light-v10"
        />
        <Select.Item
          label="mapbox://styles/mapbox/outdoors-v11"
          value="mapbox://styles/mapbox/outdoors-v11"
        />
        <Select.Item
          label="mapbox://styles/mapbox/satellite-v9"
          value="mapbox://styles/mapbox/satellite-v9"
        />
        <Select.Item
          label="mapbox://styles/mapbox/satellite-streets-v11"
          value="mapbox://styles/mapbox/satellite-streets-v11"
        />
        <Select.Item
          label="mapbox://styles/mapbox/streets-v11"
          value="mapbox://styles/mapbox/streets-v11"
        />
      </Select>

      <Mapbox.MapView
        style={styles.map}
        styleURL={style}
        // zoomLevel={10}
        centerCoordinate={[lng, lat]}
        x={0}
        y={0}
        onLayout={handleMapViewLayout}
        compassEnabled={true}
        logoEnabled={false}
        // onMapIdle={handleMapIdle}
        ref={mapViewRef}
      >
        <Mapbox.Camera
          centerCoordinate={[-77.035, 38.875]}
          // zoomLevel={12}
        />

        <Mapbox.PointAnnotation
          coordinate={[-77.044211, 38.852924]}
          id="pt-ann"
          title={"this is a point annotation"}
        ></Mapbox.PointAnnotation>

        <Mapbox.MarkerView
          id={"test-marker"}
          coordinate={[-77.044211, 38.852924]}
        >
          <Mapbox.PointAnnotation
            id={"test-marker-pointer"}
            title={"this is a marker view"}
            coordinate={[-77.044211, 38.852924]}
          />
        </Mapbox.MarkerView>

        <Mapbox.ShapeSource
          id="source1"
          lineMetrics={true}
          shape={{
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [
                [-77.044211, 38.852924],
                [-77.045659, 38.860158],
                [-77.044232, 38.862326],
                [-77.040879, 38.865454],
                [-77.039936, 38.867698],
                [-77.040338, 38.86943],
                [-77.04264, 38.872528],
                [-77.03696, 38.878424],
                [-77.032309, 38.87937],
                [-77.030056, 38.880945],
                [-77.027645, 38.881779],
                [-77.026946, 38.882645],
                [-77.026942, 38.885502],
                [-77.028054, 38.887449],
                [-77.02806, 38.892088],
                [-77.03364, 38.892108],
                [-77.033643, 38.899926],
              ],
            },
          }}
          onPress={handleShapePress}
          onLoad={handleShapeSourceLoad}
        >
          <Mapbox.LineLayer id="layer1" style={styles.lineLayer} />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
    </View>
  );
}

export function MapContainer() {
  if (Platform.OS === "web") {
    return (
      <View style={styles.page}>
        <Text>Mapbox maps are not supported on web yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text>Map - Basic</Text>
      <BasicMap />

      <Text>Map - Customized</Text>
      <CustomizedMap />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F5FCFF",
  },
  container: {
    height: 500,
    width: "100%",
    backgroundColor: "tomato",
    marginBottom: 20,
  },
  map: {
    flex: 1,
  },
  lineLayer: {
    lineColor: "red",
    lineWidth: 3,
    lineOpacity: 0.84,
  },
});
