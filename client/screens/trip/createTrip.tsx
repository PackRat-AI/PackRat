import { RStack } from '@packrat/ui';
import { ScrollView } from 'react-native';
import { theme } from '../../theme';
import TripCard from '../../components/TripCard';
import WeatherCard from '../../components/WeatherCard';
import { FontAwesome, FontAwesome5 } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { GearList } from '../../components/GearList';
import { SaveTripContainer } from '~/components/trip/createTripModal';
import TripDateRange from '~/components/trip/TripDateRange';
import { useFetchWeather, useFetchWeatherWeak } from '~/hooks/weather';
import { usePhotonDetail } from '~/hooks/trips/usePhotonDetails';
// import MultiStepForm from "../multi_step";
import { photonDetails } from '../../store/destinationStore';
import useTheme from '../../hooks/useTheme';
import useCustomStyles from '~/hooks/useCustomStyles';
import useParks from '~/hooks/parks';
import useTrails from '~/hooks/trails';
export default function Trips() {
  const { currentTheme } = useTheme();
  const styles = useCustomStyles(loadStyles);
  // const [parksData, setParksData] = useState();
  const [trails, setTrailsData] = useState();
  const [dateRange, setDateRange] = useState({
    startDate: undefined,
    endDate: undefined,
  });
  const dispatch = useDispatch();
  const searchResult = useSelector(
    (state) => state.search.selectedSearchResult,
  );
  console.log(
    '🚀 ~ file: createTrip.tsx:32 ~ Trips ~ searchResult:',
    searchResult,
  );

  // const weatherObject = useSelector((state) => state.weather.weatherObject);
  // const weatherWeek = useSelector((state) => state.weather.weatherWeek);
  // latLng,
  const { selectedSearch } = useSelector((state) => state.weather);
  const trailsObject = useSelector((state) => state.trails.trailNames);
  const parksObject = useSelector((state) => state.parks.parkNames);
  // const photonDetailsStore = useSelector(
  //   (state) => state.destination.photonDetails,
  // );
  const latLng = {
    lat: undefined,
    lon: undefined,
  };
  if (Object.keys(searchResult).length) {
    const {
      geometry: { coordinates },
    } = searchResult;
    console.log(
      '🚀 ~ file: createTrip.tsx:50 ~ Trips ~ geometry:',
      coordinates,
      searchResult,
    );
    const [lon, lat] = coordinates;
    latLng.lat = lat;
    latLng.lon = lon;
  }
  // console.log(
  //   '🚀 ~ file: createTrip.js:41 ~ Trips ~ selectedSearch:',
  //   latLng,
  //   searchResult
  // );
  const {
    data: weatherData,
    isLoading: weatherLoading,
    isError: weatherError,
  } = useFetchWeather(latLng);

  const { data: photonDetailsStore, isLoading: photonLoading } =
    usePhotonDetail(
      searchResult?.properties?.osm_id,
      searchResult?.properties?.osm_type,
    );
  console.log(
    '🚀 ~ file: createTrip.tsx:55 ~ Trips ~ photonDetail:',
    photonDetailsStore,
    photonLoading,
  );
  const {
    data: weatherWeekData,
    isLoading: weekWeatherLoading,
    isError: weekWeatherError,
  } = useFetchWeatherWeak(latLng);
  const {
    data: parks,
    error: parksError,
    isLoading: parksLoading,
    filteredParks: parksData,
  } = useParks({
    latLng,
    selectedSearch,
  });
  console.log('filtered parks', parksData, parksError);
  const { data, filteredTrails, error, isLoading } = useTrails({
    latLng,
    selectedSearch,
  });
  // useEffect(() => {
  //   setTrailsData(trailsObject);
  // }, [trailsObject]);

  // useEffect(() => {
  // setParksData(parksObject);
  // }, [parksObject]);

  // useEffect(() => {
  //   if (searchResult?.properties) {
  //     const matchPhotonFormattingForData = {
  //       properties: {
  //         osm_id: searchResult.properties?.osm_id,
  //         osm_type: searchResult.properties?.osm_type,
  //       },
  //     };
  //     dispatch(photonDetails(matchPhotonFormattingForData));
  //   }
  // }, [searchResult]);

  const steps = [
    {
      name: 'Step 1',
      component: () => (
        <TripCard
          title="Where are you heading?"
          isSearch={true}
          Icon={() => (
            <FontAwesome
              name="map"
              size={20}
              color={theme.colors.cardIconColor}
            />
          )}
        />
      ),
      sidebarData: {
        title: 'Where are you heading?',
        Icon: () => (
          <FontAwesome
            name="map"
            size={20}
            color={theme.colors.cardIconColor}
          />
        ),
      },
    },
    {
      name: 'Step 2',
      component: () => (
        <WeatherCard weatherObject={weatherObject} weatherWeek={weatherWeek} />
      ),
    },
    {
      name: 'Step 3',
      component: () => (
        <TripCard
          title="Nearby Trails"
          value="Trail List"
          isTrail={true}
          data={trails || []}
          Icon={() => (
            <FontAwesome5
              name="hiking"
              size={20}
              color={theme.colors.cardIconColor}
            />
          )}
        />
      ),
    },
    {
      name: 'Step 4',
      component: () => (
        <TripCard
          title="Nearby Parks"
          value="Parks List"
          data={parksData}
          Icon={() => (
            <FontAwesome5
              name="mountain"
              size={20}
              color={theme.colors.cardIconColor}
            />
          )}
        />
      ),
    },
    {
      name: 'Step 5',
      component: GearList,
    },
    {
      name: 'Step 6',
      component: () => (
        <TripDateRange dateRange={dateRange} setDateRange={setDateRange} />
      ),
    },
    {
      name: 'Step 7',
      component: () => (
        <TripCard
          Icon={() => (
            <FontAwesome5
              name="route"
              size={24}
              color={theme.colors.cardIconColor}
            />
          )}
          title="Map"
          isMap={true}
        />
      ),
    },
    {
      name: 'Step 8',
      component: () => <SaveTripContainer dateRange={dateRange} />,
    },
  ];

  return (
    <ScrollView nestedScrollEnabled={true}>
      <RStack style={styles.mutualStyles}>
        {/* <MultiStepForm steps={steps} /> */}
        <RStack style={styles.container}>
          <TripCard
            title="Where are you heading?"
            isSearch={true}
            Icon={() => (
              <FontAwesome
                name="map"
                size={20}
                color={currentTheme.colors.cardIconColor}
              />
            )}
          />
          {!weekWeatherError &&
            !weatherError &&
            !weatherLoading &&
            !weekWeatherLoading && (
              <WeatherCard
                weatherObject={weatherData}
                weatherWeek={weatherWeekData}
              />
            )}
          <TripCard
            title="Nearby Trails"
            value="Trail List"
            isTrail={true}
            data={filteredTrails || []}
            Icon={() => (
              <FontAwesome5
                name="hiking"
                size={20}
                color={currentTheme.colors.cardIconColor}
              />
            )}
          />
          <TripCard
            title="Nearby Parks"
            value="Parks List"
            isPark={true}
            data={parksData}
            Icon={() => (
              <FontAwesome5
                name="mountain"
                size={20}
                color={currentTheme.colors.cardIconColor}
              />
            )}
          />
          <GearList />
          <TripDateRange dateRange={dateRange} setDateRange={setDateRange} />

          <TripCard
            Icon={() => (
              <FontAwesome5
                name="route"
                size={24}
                color={currentTheme.colors.cardIconColor}
              />
            )}
            title="Map"
            isMap={true}
            isLoading={photonLoading}
            shape={photonDetailsStore}
          />
          <RStack>
            <SaveTripContainer dateRange={dateRange} />
          </RStack>
        </RStack>
      </RStack>
    </ScrollView>
  );
}

const loadStyles = () => ({
  mutualStyles: {
    backgroundColor: theme.colors.background,
    flex: 1,
    flexDirection: 'column',
    height: '100%',
    paddingBottom: 30,
  },
  container: {
    gap: 50,
    padding: 50,
  },
});
