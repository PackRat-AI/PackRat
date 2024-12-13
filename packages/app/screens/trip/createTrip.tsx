import React, { useState } from 'react';
import { RStack, RText, XStack, YStack } from '@packrat/ui';
import { FlatList, View } from 'react-native';
import { useRef } from 'react';
import { GearList } from '../../components/GearList/GearList';
import { TripForm } from 'app/components/trip/TripForm';
import useTheme from '../../hooks/useTheme';
import { useCreateTripForm } from 'app/hooks/trips/useCreateTripForm';
import { useTripsData } from './useTripsData';
import Layout from 'app/components/layout/Layout';
import RSecondaryButton from 'app/components/RSecondaryButton';

import { TripMapCard, TripSearchCard } from 'app/components/trip/TripCards';
import { WeatherData } from 'app/components/weather/WeatherData';
import { useFlatList } from 'app/hooks/useFlatList';
import useResponsive from 'app/hooks/useResponsive';
import { LayoutCard } from 'app/components/LayoutCard';
import { MapPin, MapPinned } from '@tamagui/lucide-icons';

const SECTIONS = {
  MAP: 'MAP',
  PLACE_NAME: 'PLACE_NAME',
  PACK: 'PACK',
  WEATHER: 'WEATHER',
};

function Trips() {
  const placesAutoCompleteRef = useRef({});
  const [isChangePlaceMode, setIsChangePlaceMode] = useState(false);
  const { gtSm } = useResponsive();

  const { currentTheme } = useTheme();
  const {
    currentDestination,
    photonDetails,
    isPhotonLoading,
    hasPhotonError,
    latLng,
  } = useTripsData();

  const { isValid, dateRange, setDateRange, tripStore, setTripValue } =
    useCreateTripForm(currentDestination, photonDetails);

  const { flatListData, keyExtractor, renderItem } = useFlatList(SECTIONS, {
    [SECTIONS.MAP]: (
      <TripMapCard
        isLoading={isPhotonLoading}
        isMapError={hasPhotonError}
        shape={photonDetails}
        onVisibleBoundsChange={(bounds) => {
          setTripValue('bounds', bounds);
        }}
      />
    ),
    [SECTIONS.PLACE_NAME]: (
      <XStack style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <MapPinned size={20} />
        <RText style={{ fontSize: 20, fontWeight: 600 }}>
          {photonDetails?.features?.[0]?.properties?.['name:en'] ||
            photonDetails?.features?.[0]?.properties?.name}
        </RText>
      </XStack>
    ),
    [SECTIONS.WEATHER]: (
      <LayoutCard>
        <WeatherData latLng={latLng} />
      </LayoutCard>
    ),
    [SECTIONS.PACK]: <GearList />,
  });

  return (
    <Layout>
      {(isChangePlaceMode || !latLng) && (
        <TripSearchCard
          searchRef={placesAutoCompleteRef}
          isChangePlaceMode={isChangePlaceMode}
          onGoBack={() => setIsChangePlaceMode(false)}
          onLocationSelect={() => setIsChangePlaceMode(false)}
        />
      )}
      {latLng ? (
        <YStack
          style={{ gap: 16, display: isChangePlaceMode ? 'none' : 'flex' }}
        >
          <XStack
            style={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <RText style={{ fontWeight: 700, fontSize: 24 }}>
              Plan Your Trip
            </RText>
            <RSecondaryButton
              icon={<MapPin />}
              size={36}
              borderWidth={2}
              onPress={() => setIsChangePlaceMode(true)}
              label="Change Direction"
            />
          </XStack>
          <RStack style={{ flexDirection: gtSm ? 'row' : 'column', gap: 16 }}>
            <View style={{ width: gtSm ? 450 : '100%' }}>
              <FlatList
                data={flatListData}
                keyExtractor={keyExtractor}
                ItemSeparatorComponent={() => (
                  <View style={{ width: '100%', height: 16 }} />
                )}
                renderItem={renderItem}
              />
            </View>
            <LayoutCard
              title="Trip Details"
              style={{ flex: 1, alignSelf: 'flex-start' }}
            >
              <TripForm
                isValid={isValid}
                dateRange={dateRange}
                setDateRange={setDateRange}
                tripStore={tripStore}
              />
            </LayoutCard>
          </RStack>
        </YStack>
      ) : null}
    </Layout>
  );
}

const loadStyles = () => {
  const { currentTheme } = useTheme();

  return {
    mutualStyles: {
      backgroundColor: currentTheme.colors.background,
      flex: 1,
      flexDirection: 'column',
      height: '100%',
      paddingBottom: 30,
    },
    container: {
      gap: 50,
      padding: 20,
    },
  };
};

export default Trips;
