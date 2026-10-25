import { use$ } from '@legendapp/state/react';
import { Button } from '@packrat/ui/src/button';
import { Text } from '@packrat/ui/src/text';
import { Toggle } from '@packrat/ui/src/toggle';
import * as Sentry from '@sentry/react-native';
import { Icon } from 'expo-app/components/Icon';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { Stack, useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import PagerView from 'react-native-pager-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';
import { FullScreenDialogHeader } from '../components/DialogParts';
import { SHARE_PALETTE, ShareCard, useCardTitle } from '../components/ShareCard';
import { useShareCard } from '../components/ShareParts';
import { SegmentedButtons } from '../components/StatsParts';
import { useDistanceUnit } from '../hooks/useDistanceUnit';
import {
  CARD_SCALE,
  CARD_WIDTH,
  canShowNames,
  cardHeight,
  mapAspect,
  pendingReview$,
  pendingShare$,
  SHARE_FORMATS,
  type ShareContent,
  type ShareFormat,
  type ShareOptions,
} from '../lib/share';
import { PRIVATE_SPAN_METRES, shareMapRegion } from '../utils/shareMap';
import { type ReviewPage, reviewPages, type YearInReview } from '../utils/yearInReview';

const PREVIEW_HEIGHT = 420;
/** Long enough for slow tiles on mobile data; past it the card shares without the map. */
const MAP_TIMEOUT_MS = 10_000;

/**
 * A card on its way out: pick a shape, see exactly what will be shared, send it through the
 * Android sharesheet. Private by default: trip names and a close-up map are opt-in, per card,
 * every time, as Strava's privacy zones are hidden unless you choose otherwise.
 */
export function ShareCardScreen() {
  const content = use$(pendingShare$);
  const router = useRouter();
  const { t } = useTranslation();
  if (!content) {
    return (
      <SafeAreaView className="flex-1" edges={['bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <FullScreenDialogHeader title={t('tripStats.share.title')} onClose={() => router.back()} />
      </SafeAreaView>
    );
  }
  return <ShareCardEditor content={content} />;
}

function ShareCardEditor({ content }: { content: ShareContent }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useColorScheme();
  const unit = useDistanceUnit();
  const title = useCardTitle(content);
  const { width: windowWidth } = useWindowDimensions();
  const [format, setFormat] = useState<ShareFormat>('story');
  const [options, setOptions] = useState<ShareOptions>({ showNames: false, zoomClose: false });
  const [cardSize, setCardSize] = useState<{ width: number; height: number } | null>(null);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<View>(null);
  const map = useMapSnapshot({ content, format, zoomClose: options.zoomClose });

  const height = cardHeight(format) ?? cardSize?.height ?? CARD_WIDTH;
  const scale = Math.min((windowWidth - 40) / CARD_WIDTH, PREVIEW_HEIGHT / height, 1);
  const isMap = content.kind === 'map';
  const privacyNote = isMap
    ? options.zoomClose
      ? t('tripStats.share.privacy.mapClose')
      : t('tripStats.share.privacy.mapRegion')
    : canShowNames(content) && !options.showNames
      ? t('tripStats.share.privacy.namesOff')
      : t('tripStats.share.privacy.numbersOnly');
  const ready = !isMap || map.image != null || map.failed;

  const share = async () => {
    if (!cardSize) return;
    setSharing(true);
    Sentry.addBreadcrumb({
      category: 'tripStats',
      message: 'Share card',
      level: 'info',
      data: { kind: content.kind, format },
    });
    try {
      const uri = await captureRef(cardRef, {
        format: 'png',
        result: 'tmpfile',
        width: Math.round(cardSize.width * CARD_SCALE),
        height: Math.round(cardSize.height * CARD_SCALE),
      });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: title });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { feature: 'tripStats', action: 'shareCard' },
        extra: { kind: content.kind, format },
      });
      Alert.alert(t('tripStats.share.failed'));
    } finally {
      setSharing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" edges={['bottom']} testID={testIds.tripStats.shareScreen}>
      <Stack.Screen options={{ headerShown: false }} />
      <FullScreenDialogHeader title={t('tripStats.share.title')} onClose={() => router.back()} />
      {map.element}
      <ScrollView contentContainerClassName="gap-5 p-5">
        <View
          className="items-center justify-center self-center rounded-2xl"
          style={{
            width: CARD_WIDTH * scale + (format === 'sticker' ? 48 : 0),
            height: height * scale + (format === 'sticker' ? 48 : 0),
            // A sticker is transparent; show it over a photo-dark backdrop.
            backgroundColor: format === 'sticker' ? '#525252' : undefined,
          }}
          accessible
          accessibilityLabel={t('tripStats.share.preview', {
            format: t(`tripStats.share.formats.${format}`),
          })}
        >
          <View
            style={{
              width: CARD_WIDTH * scale,
              height: height * scale,
              borderRadius: format === 'sticker' ? 0 : 16,
              overflow: 'hidden',
            }}
          >
            {/* The scale sits on a wrapper, so the captured card stays full size. */}
            <View
              style={{
                width: CARD_WIDTH,
                position: 'absolute',
                left: (CARD_WIDTH * scale - CARD_WIDTH) / 2,
                top: (height * scale - height) / 2,
                transform: [{ scale }],
              }}
            >
              <View
                ref={cardRef}
                collapsable={false}
                onLayout={(event) => setCardSize(event.nativeEvent.layout)}
              >
                <ShareCard
                  content={content}
                  format={format}
                  options={options}
                  unit={unit}
                  mapImage={map.image}
                />
              </View>
            </View>
          </View>
        </View>
        <SegmentedButtons
          options={SHARE_FORMATS}
          value={format}
          onChange={setFormat}
          label={(value) => t(`tripStats.share.formats.${value}`)}
          testIDFor={(value) => testIds.tripStats.shareFormat(value)}
        />
        <View>
          {canShowNames(content) ? (
            <ToggleRow
              label={t('tripStats.share.showNames')}
              value={options.showNames}
              onChange={(showNames) => setOptions({ ...options, showNames })}
              testID={testIds.tripStats.shareNamesToggle}
            />
          ) : null}
          {isMap ? (
            <ToggleRow
              label={t('tripStats.share.zoomClose')}
              value={options.zoomClose}
              onChange={(zoomClose) => setOptions({ ...options, zoomClose })}
              testID={testIds.tripStats.shareZoomToggle}
            />
          ) : null}
          {map.failed ? (
            <Text variant="footnote" className="pb-2 text-muted-foreground">
              {t('tripStats.share.mapFailed')}
            </Text>
          ) : null}
          <View className="flex-row items-start gap-2 pt-1">
            <Icon name="lock" size={16} color={colors.grey} />
            <Text variant="footnote" className="flex-1 text-muted-foreground">
              {privacyNote}
            </Text>
          </View>
        </View>
      </ScrollView>
      <View className="border-border border-t px-5 pt-3 pb-2">
        <Button
          size="lg"
          onPress={share}
          disabled={!ready || !cardSize || sharing}
          testID={testIds.tripStats.shareSendBtn}
        >
          <Icon name="share-variant" size={20} color={colors.background} />
          <Text>{t('tripStats.share.send')}</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
  testID,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testID: string;
}) {
  return (
    <View className="min-h-14 flex-row items-center gap-4">
      <Text variant="body" className="flex-1">
        {label}
      </Text>
      <Toggle value={value} onValueChange={onChange} testID={testID} />
    </View>
  );
}

/** Muted dark Google Maps style: land and water in two greys, roads faint, no labels or POIs. */
const DARK_MAP_STYLE = Object.freeze([
  { elementType: 'geometry', stylers: [{ color: '#1d2c2a' }] },
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2b3b38' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a1d' }] },
  { featureType: 'landscape.natural.terrain', stylers: [{ color: '#22332f' }] },
]);

/**
 * A map card's map: a dark Google map, framed to the card's shape and held zoomed out unless the
 * user zooms in close, drawn off-screen behind the preview and snapshotted into an image the card
 * shows. Routes and pins are drawn by the map so they line up with it exactly.
 */
function useMapSnapshot({
  content,
  format,
  zoomClose,
}: {
  content: ShareContent;
  format: ShareFormat;
  zoomClose: boolean;
}) {
  const aspect = mapAspect(format);
  const key = `${aspect}-${zoomClose}`;
  const [snapshot, setSnapshot] = useState<{ key: string; image: string | null } | null>(null);
  const mapRef = useRef<MapView>(null);
  const isMap = content.kind === 'map';

  useEffect(() => {
    if (!isMap) return;
    const timer = setTimeout(() => {
      setSnapshot((current) => (current?.key === key ? current : { key, image: null }));
    }, MAP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [isMap, key]);

  if (content.kind !== 'map') return { element: null, image: null, failed: false };
  const region = shareMapRegion({
    points: [...content.routes.flat(), ...content.pins],
    aspect,
    minSpanMetres: zoomClose ? 0 : PRIVATE_SPAN_METRES,
  });
  const current = snapshot?.key === key ? snapshot : null;

  const element = region ? (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: 0, left: 0, zIndex: -1, opacity: 0.01 }}
    >
      <MapView
        key={key}
        ref={mapRef}
        style={{ width: CARD_WIDTH, height: CARD_WIDTH / aspect }}
        initialRegion={region}
        customMapStyle={[...DARK_MAP_STYLE]}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        onMapLoaded={async () => {
          try {
            const image = await mapRef.current?.takeSnapshot({ format: 'png', result: 'file' });
            setSnapshot({ key, image: image ? `file://${image.replace('file://', '')}` : null });
          } catch (error) {
            Sentry.captureException(error, {
              tags: { feature: 'tripStats', action: 'shareMapSnapshot' },
            });
            setSnapshot({ key, image: null });
          }
        }}
      >
        {content.routes.map((route, index) => (
          <Polyline
            key={index}
            coordinates={route}
            strokeColor={SHARE_PALETTE.trail}
            strokeWidth={4}
          />
        ))}
        {content.pins.map((pin) => (
          <Marker
            key={`${pin.latitude},${pin.longitude}`}
            coordinate={pin}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={{
                width: 13,
                height: 13,
                borderRadius: 6.5,
                borderWidth: 2,
                borderColor: 'rgba(0,0,0,0.35)',
                backgroundColor: SHARE_PALETTE.mint,
              }}
            />
          </Marker>
        ))}
      </MapView>
    </View>
  ) : null;

  return {
    element,
    image: current?.image ?? null,
    failed: region == null || (current != null && current.image == null),
  };
}

/**
 * The year in review as full-screen story cards (Spotify Wrapped, Strava Year in Sport): segments
 * across the top, swipe or tap the right of the card for the next one and the left for the one
 * before. Nothing advances on a timer, so a card stays up as long as someone is reading it
 * (WCAG 2.2.2). Each card is the same image the Share button sends.
 */
export function YearInReviewScreen() {
  const review = use$(pendingReview$);
  const router = useRouter();
  if (!review) {
    return (
      <View className="flex-1 bg-black">
        <Stack.Screen options={{ headerShown: false }} />
        <Pressable onPress={() => router.back()} className="p-4" accessibilityRole="button">
          <Icon name="close" size={24} color="#FFFFFF" />
        </Pressable>
      </View>
    );
  }
  return <ReviewPager review={review} />;
}

function ReviewPager({ review }: { review: YearInReview }) {
  const { t } = useTranslation();
  const router = useRouter();
  const unit = useDistanceUnit();
  const shareCard = useShareCard();
  const pages = reviewPages(review);
  const [index, setIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const { width, height } = useWindowDimensions();
  const cardH = cardHeight('story') ?? 640;
  const scale = Math.min((width - 24) / CARD_WIDTH, (height - 200) / cardH);
  const page: ReviewPage = pages[Math.min(index, pages.length - 1)] ?? 'intro';

  const go = (step: number) => {
    const next = index + step;
    if (next < 0 || next >= pages.length) return;
    pagerRef.current?.setPage(next);
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: '#000000' }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-row gap-1 px-4 pt-2"
        accessible
        accessibilityLabel={t('tripStats.review.card', { index: index + 1, count: pages.length })}
      >
        {pages.map((item, position) => (
          <View
            key={item}
            className="h-[3px] flex-1 rounded-full"
            style={{ backgroundColor: `rgba(255,255,255,${position <= index ? 0.95 : 0.25})` }}
          />
        ))}
      </View>
      <PagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={(event) => setIndex(event.nativeEvent.position)}
        testID={testIds.tripStats.reviewPager}
      >
        {pages.map((item) => (
          <View key={item} className="items-center justify-center" collapsable={false}>
            <View
              style={{
                width: CARD_WIDTH * scale,
                height: cardH * scale,
                borderRadius: 18,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: CARD_WIDTH,
                  position: 'absolute',
                  left: (CARD_WIDTH * scale - CARD_WIDTH) / 2,
                  top: (cardH * scale - cardH) / 2,
                  transform: [{ scale }],
                }}
              >
                <ShareCard
                  content={{ kind: 'review', review, page: item }}
                  format="story"
                  unit={unit}
                />
              </View>
              {/* The left third goes back, the rest goes forward, as in Instagram stories. */}
              <View
                className="absolute inset-0 flex-row"
                importantForAccessibility="no-hide-descendants"
              >
                <Pressable className="h-full w-1/3" onPress={() => go(-1)} />
                <Pressable className="h-full flex-1" onPress={() => go(1)} />
              </View>
            </View>
          </View>
        ))}
      </PagerView>
      <View className="flex-row items-center justify-between px-4 pb-4">
        <Pressable
          onPress={() => router.back()}
          className="h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.14)' }}
          accessibilityRole="button"
          accessibilityLabel={t('tripStats.share.close')}
          testID={testIds.tripStats.reviewCloseBtn}
        >
          <Icon name="close" size={24} color="#FFFFFF" />
        </Pressable>
        <Pressable
          onPress={() => shareCard({ kind: 'review', review, page })}
          className="h-12 flex-row items-center gap-2 rounded-full px-5"
          style={{ backgroundColor: '#FFFFFF' }}
          accessibilityRole="button"
          testID={testIds.tripStats.reviewShareBtn}
        >
          <Icon name="share-variant" size={20} color="#000000" />
          <Text variant="callout" className="font-medium" style={{ color: '#000000' }}>
            {t('tripStats.share.action')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
