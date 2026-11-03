import { Button } from '@packrat/ui/src/button';
import { ActivityIndicator } from '@packrat/ui/src/loading-indicator';
import { SearchInput } from '@packrat/ui/src/search-input';
import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { TextInput } from 'expo-app/components/TextInput';
import { useSpeedUnit } from 'expo-app/features/auth/hooks/useSpeedUnit';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReportLocation } from '../hooks/useReportLocation';
import { useTrailSearch } from '../hooks/useTrailConditions';
import {
  type Coordinate,
  makePin,
  type ReportPlace,
  type TrailSummary,
  trailSubtitle,
} from '../utils/trails';

interface TrailPickerProps {
  visible: boolean;
  /** The trail currently chosen, so the picker can mark it. */
  selectedTrailId: string | null;
  /** Where "near" means. Null uses the device's location; a trip passes its destination. */
  origin?: Coordinate | null;
  /** Off for trips: a trip names a trail, it has no use for a pin. */
  allowsPin?: boolean;
  onPick: (place: ReportPlace) => void;
  onClose: () => void;
}

const SEARCH_DEBOUNCE_MS = 250;

function useDebounced(value: string): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value]);
  return debounced;
}

/**
 * Picks the trail a report is about — `ReportTrailPickerView` in `TrailPickerView.swift`. Trails
 * near the hiker come first; typing narrows by name. When the trail isn't in PackRat, the hiker
 * drops a pin. A full-screen modal, since Material puts focused selection in its own surface.
 */
export function TrailPicker({
  visible,
  selectedTrailId,
  origin = null,
  allowsPin = true,
  onPick,
  onClose,
}: TrailPickerProps) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const { unit } = useSpeedUnit();
  const location = useReportLocation(visible);
  const [query, setQuery] = useState('');
  const [droppingPin, setDroppingPin] = useState(false);
  const debouncedQuery = useDebounced(query);
  const trimmed = debouncedQuery.trim();
  const near = origin ?? location.coordinate;
  const search = useTrailSearch({ query: debouncedQuery, near });
  const trails = search.data ?? [];
  const imperial = unit === 'mph';

  const close = () => {
    setDroppingPin(false);
    onClose();
  };

  const choosePlace = (place: ReportPlace) => {
    setDroppingPin(false);
    onPick(place);
  };

  const renderStatus = () => {
    if (search.isError && trails.length === 0) {
      return (
        <View className="gap-2 px-4 py-6">
          <Text variant="heading">{t('trailConditions.trailsLoadErrorTitle')}</Text>
          <Text variant="callout" className="text-muted-foreground" wrap>
            {allowsPin
              ? t('trailConditions.trailsLoadErrorWithPin')
              : t('trailConditions.trailsLoadError')}
          </Text>
          <Button
            variant="outlined"
            className="mt-1 h-10 self-start px-6"
            onPress={() => search.refetch()}
          >
            {t('trailConditions.tryAgain')}
          </Button>
        </View>
      );
    }
    if (!trimmed && !near) {
      return location.isDenied ? (
        <Hint
          icon="magnify"
          title={t('trailConditions.searchByName')}
          detail={t('trailConditions.searchByNameDetail')}
        />
      ) : (
        <View className="flex-row items-center gap-3 px-4 py-6">
          <ActivityIndicator />
          <Text variant="body" className="text-muted-foreground">
            {t('trailConditions.findingNearby')}
          </Text>
        </View>
      );
    }
    if (trails.length === 0 && !search.isFetching) {
      return trimmed ? (
        <Hint
          icon="magnify"
          title={t('trailConditions.noTrailsNamed', { query: trimmed })}
          detail={
            allowsPin
              ? t('trailConditions.noTrailsNamedWithPin')
              : t('trailConditions.noTrailsNamedDetail')
          }
        />
      ) : (
        <Hint
          icon="map-outline"
          title={t('trailConditions.noTrailsNearby')}
          detail={
            allowsPin
              ? t('trailConditions.noTrailsNearbyWithPin')
              : t('trailConditions.noTrailsNearbyDetail')
          }
        />
      );
    }
    return null;
  };

  const status = renderStatus();
  let header = t('trailConditions.trailsHeader');
  if (!trimmed) {
    header = origin ? t('trailConditions.nearDestination') : t('trailConditions.nearYou');
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={close}
      // Edge-to-edge, so the keyboard controller can see the keyboard inside the modal window.
      statusBarTranslucent
      navigationBarTranslucent
    >
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        {droppingPin ? (
          <PinDrop
            start={location.coordinate}
            onBack={() => setDroppingPin(false)}
            onConfirm={choosePlace}
          />
        ) : (
          <>
            <ModalHeader title={t('trailConditions.chooseTrail')} onBack={close} />
            <View className="px-4 pb-2">
              <SearchInput
                value={query}
                onChangeText={setQuery}
                placeholder={t('trailConditions.searchTrails')}
                containerTestID={testIds.trailConditions.trailSearchInput}
              />
            </View>
            <FlatList
              data={status ? [] : trails}
              keyExtractor={(trail) => trail.id}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <>
                  {allowsPin ? (
                    <View className="border-b border-border pb-3">
                      <Pressable
                        onPress={() => setDroppingPin(true)}
                        testID={testIds.trailConditions.dropPinBtn}
                        accessibilityRole="button"
                        className="flex-row items-center gap-3 px-4 py-3 active:bg-muted"
                      >
                        <Icon name="map-marker-plus-outline" size={22} color={colors.primary} />
                        <Text variant="body" className="text-primary">
                          {t('trailConditions.dropPinInstead')}
                        </Text>
                      </Pressable>
                      <Text variant="footnote" className="px-4 text-muted-foreground" wrap>
                        {t('trailConditions.dropPinFooter')}
                      </Text>
                    </View>
                  ) : null}
                  {status ?? (
                    <View className="flex-row items-center justify-between px-4 pb-1 pt-4">
                      <Text
                        variant="caption1"
                        className="uppercase tracking-wide text-muted-foreground"
                      >
                        {header}
                      </Text>
                      {search.isFetching ? <ActivityIndicator size="small" /> : null}
                    </View>
                  )}
                </>
              }
              renderItem={({ item }) => (
                <TrailRow
                  trail={item}
                  imperial={imperial}
                  isSelected={item.id === selectedTrailId}
                  onPress={() =>
                    choosePlace({ kind: 'trail', trail: { id: item.id, name: item.name } })
                  }
                />
              )}
            />
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function ModalHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: React.ReactNode;
}) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  return (
    <View className="flex-row items-center gap-2 px-2 py-2">
      <Pressable
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel={t('common.back')}
        className="p-2"
      >
        <Icon name="arrow-left" size={24} color={colors.foreground} />
      </Pressable>
      <Text variant="title3" className="flex-1 font-semibold">
        {title}
      </Text>
      {action}
    </View>
  );
}

function Hint({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  const { colors } = useColorScheme();
  return (
    <View className="flex-row gap-3 px-4 py-6">
      <Icon name={icon} size={22} color={colors.grey} />
      <View className="flex-1 gap-1">
        <Text variant="heading">{title}</Text>
        <Text variant="callout" className="text-muted-foreground" wrap>
          {detail}
        </Text>
      </View>
    </View>
  );
}

function TrailRow({
  trail,
  imperial,
  isSelected,
  onPress,
}: {
  trail: TrailSummary;
  imperial: boolean;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      testID={testIds.trailConditions.trailPickerRow(trail.id)}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-muted"
    >
      <View className="h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
        <Icon name="hiking" size={18} color={colors.primary} />
      </View>
      <View className="flex-1 gap-0.5">
        <Text variant="body" numberOfLines={1}>
          {trail.name}
        </Text>
        <Text variant="caption1" className="text-muted-foreground">
          {trailSubtitle({ trail, imperial })}
        </Text>
      </View>
      {isSelected ? (
        <View accessible accessibilityLabel={t('trailConditions.selected')}>
          <Icon name="check" size={20} color={colors.primary} />
        </View>
      ) : null}
    </Pressable>
  );
}

const PIN_REGION_DELTA = 0.015;

/**
 * Places a report on the map when there's no trail to pick — `TrailPinDropView`. The pin starts
 * where the hiker is; tapping the map moves it.
 */
function PinDrop({
  start,
  onBack,
  onConfirm,
}: {
  start: Coordinate | null;
  onBack: () => void;
  onConfirm: (place: ReportPlace) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useColorScheme();
  const [pin, setPin] = useState<Coordinate | null>(start);
  const [label, setLabel] = useState('');

  return (
    <KeyboardAvoidingView behavior="padding" className="flex-1">
      <ModalHeader
        title={t('trailConditions.dropPin')}
        onBack={onBack}
        action={
          <Pressable
            onPress={() => pin && onConfirm(makePin({ label, ...pin }))}
            disabled={!pin}
            testID={testIds.trailConditions.confirmPinBtn}
            accessibilityRole="button"
            accessibilityState={{ disabled: !pin }}
            className="p-2"
          >
            <Text
              variant="body"
              className={pin ? 'font-semibold text-primary' : 'text-muted-foreground'}
            >
              {t('trailConditions.usePin')}
            </Text>
          </Pressable>
        }
      />
      <View className="flex-1" testID={testIds.trailConditions.pinMap}>
        <MapView
          style={{ flex: 1 }}
          initialRegion={
            start
              ? { ...start, latitudeDelta: PIN_REGION_DELTA, longitudeDelta: PIN_REGION_DELTA }
              : undefined
          }
          showsUserLocation
          showsMyLocationButton
          showsPointsOfInterests={false}
          onPress={(event) => setPin(event.nativeEvent.coordinate)}
        >
          {pin ? <Marker coordinate={pin} pinColor={colors.primary} /> : null}
        </MapView>
        <View className="absolute left-0 right-0 top-3 items-center" pointerEvents="none">
          <View className="rounded-full bg-card px-3 py-1.5 shadow-sm">
            <Text variant="footnote" className="font-medium">
              {pin ? t('trailConditions.tapToMovePin') : t('trailConditions.tapToDropPin')}
            </Text>
          </View>
        </View>
      </View>
      <View className="gap-2 border-t border-border bg-card p-4">
        <Text variant="caption1" className="uppercase tracking-wide text-muted-foreground">
          {t('trailConditions.pinLabel')}
        </Text>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={t('trailConditions.pinLabelPlaceholder')}
          placeholderTextColor={colors.grey}
          testID={testIds.trailConditions.pinLabelInput}
          accessibilityLabel={t('trailConditions.pinLabel')}
          returnKeyType="done"
          className="rounded-xl bg-background px-4 py-3 text-foreground"
        />
        <Text variant="caption1" className="text-muted-foreground">
          {t('trailConditions.pinLabelHint')}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
