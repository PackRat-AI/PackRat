import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Image, Text, type TextStyle, View } from 'react-native';
import { getNationalParks } from '../lib/nationalParks';
import {
  CARD_WIDTH,
  cardHeight,
  mapAspect,
  type ShareContent,
  type ShareFormat,
  type ShareOptions,
} from '../lib/share';
import { formatMonthName, formatNumber, useStatsFormat } from '../lib/useStatsFormat';
import { goalFraction, isGoalComplete } from '../utils/goalProgress';
import { NATIONAL_PARK_COUNT } from '../utils/parksAndPeaks';
import type { Totals } from '../utils/tripStats';
import { formatDistance, formatElevation, type TripDistanceUnit } from '../utils/units';
import type { YearInReview } from '../utils/yearInReview';
import { useGoalTitle } from './GoalCards';

const LOGO = require('expo-app/assets/packrat-app-icon-gradient.png');

/** The card's own palette: a dark, contour-textured green, fixed so every image looks the same. */
export const SHARE_PALETTE = Object.freeze({
  mint: '#8FDBB3',
  trail: '#FF9E42',
  top: '#214D40',
  bottom: '#0A1417',
  dim: 'rgba(255,255,255,0.7)',
  faint: 'rgba(255,255,255,0.14)',
} as const);

const DEFAULT_OPTIONS: ShareOptions = Object.freeze({ showNames: false, zoomClose: false });

/**
 * A shareable card, drawn at a fixed dp size with fixed type (no font scaling) so the image comes
 * out the same on every phone and text size. The year in review shows the same card scaled to the
 * screen. Ported from the Swift app's `TripShareCardView`.
 */
export function ShareCard({
  content,
  format,
  options = DEFAULT_OPTIONS,
  unit,
  mapImage = null,
}: {
  content: ShareContent;
  format: ShareFormat;
  options?: ShareOptions;
  unit: TripDistanceUnit;
  /** A map snapshot for a map card; without one the card shows its numbers alone. */
  mapImage?: string | null;
}) {
  const { t } = useTranslation();
  const isSticker = format === 'sticker';
  const isStory = format === 'story';
  const title = useCardTitle(content);
  const eyebrow =
    content.kind === 'review'
      ? t('tripStats.share.card.eyebrowReview', { year: content.review.year })
      : content.kind === 'goal'
        ? t('tripStats.share.card.eyebrowGoal')
        : content.kind === 'year'
          ? t('tripStats.share.card.eyebrowYear')
          : t('tripStats.share.card.eyebrowStats');

  return (
    <View
      collapsable={false}
      style={{
        width: CARD_WIDTH,
        height: cardHeight(format) ?? undefined,
        padding: isSticker ? 18 : isStory ? 30 : 24,
        gap: isStory ? 24 : 14,
        overflow: 'hidden',
      }}
    >
      {isSticker ? null : <CardBackground />}
      {isSticker ? null : (
        <View style={{ gap: 4 }}>
          <CardText
            size={12}
            weight="700"
            color={SHARE_PALETTE.mint}
            style={{ letterSpacing: 1.6 }}
          >
            {eyebrow}
          </CardText>
          <CardText size={isStory ? 34 : 26} weight="900" lines={2}>
            {title}
          </CardText>
        </View>
      )}
      {isStory ? <View style={{ flex: 1 }} /> : null}
      <CardBody
        content={content}
        format={format}
        options={options}
        unit={unit}
        mapImage={mapImage}
      />
      {/* A story centres the numbers; a square keeps them under the title. */}
      {isSticker ? null : <View style={{ flex: 1 }} />}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image source={LOGO} style={{ width: 22, height: 22, borderRadius: 5 }} />
        <CardText size={15} weight="700" shadow={isSticker}>
          PackRat
        </CardText>
        {isSticker ? null : (
          <>
            <View style={{ flex: 1 }} />
            <CardText size={12} weight="500" color="rgba(255,255,255,0.6)">
              packrat.world
            </CardText>
          </>
        )}
      </View>
    </View>
  );
}

/** The card's heading: what it shows, or the review page's name. */
export function useCardTitle(content: ShareContent): string {
  const { t } = useTranslation();
  const goalTitle = useGoalTitle();
  switch (content.kind) {
    case 'totals':
      return t('tripStats.share.card.allTime');
    case 'year':
      return t('tripStats.share.card.yearSoFar', { year: content.year });
    case 'map':
      return t('tripStats.share.card.map');
    case 'goal':
      return goalTitle(content.progress.goal);
    case 'parks':
      return t('tripStats.share.card.parks');
    case 'review':
      return t(`tripStats.review.pages.${content.page}`);
  }
}

function CardBackground() {
  return (
    <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
      <LinearGradient
        colors={[SHARE_PALETTE.top, SHARE_PALETTE.bottom]}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
      />
      {/* Contour rings for texture, faint enough to keep the numbers first. */}
      {Array.from({ length: 9 }, (_, index) => {
        const radius = (index + 1) * CARD_WIDTH * 0.11;
        return (
          <View
            key={radius}
            style={{
              position: 'absolute',
              left: CARD_WIDTH * 0.55 - radius,
              top: -CARD_WIDTH * 0.1 - radius * 0.7,
              width: radius * 2,
              height: radius * 2,
              borderRadius: radius,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.05)',
            }}
          />
        );
      })}
    </View>
  );
}

/** Fixed-size type: the card ignores the system font scale so the image is the same everywhere. */
function CardText({
  size,
  weight = '600',
  color = '#FFFFFF',
  lines,
  shadow = false,
  style,
  children,
}: {
  size: number;
  weight?: TextStyle['fontWeight'];
  color?: string;
  lines?: number;
  /** A sticker sits on a photo, so its type carries a shadow. */
  shadow?: boolean;
  style?: TextStyle;
  children: ReactNode;
}) {
  return (
    <Text
      allowFontScaling={false}
      numberOfLines={lines}
      adjustsFontSizeToFit={lines != null}
      style={[
        { fontSize: size, fontWeight: weight, color, fontVariant: ['tabular-nums'] },
        shadow
          ? {
              textShadowColor: 'rgba(0,0,0,0.55)',
              textShadowRadius: 3,
              textShadowOffset: { width: 0, height: 1 },
            }
          : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

interface Tile {
  value: string;
  label: string;
}

function CardBody({
  content,
  format,
  options,
  unit,
  mapImage,
}: {
  content: ShareContent;
  format: ShareFormat;
  options: ShareOptions;
  unit: TripDistanceUnit;
  mapImage: string | null;
}) {
  const { t } = useTranslation();
  const { formatMetric } = useStatsFormat();
  const isStory = format === 'story';
  const isSticker = format === 'sticker';
  const big = isStory ? 44 : 32;

  const totalTiles = (totals: Totals): Tile[] => [
    { value: formatNumber(totals.trips), label: t('tripStats.totals.trips') },
    ...(totals.distance != null
      ? [
          {
            value: formatDistance({ metres: totals.distance, unit }),
            label: t('tripStats.totals.distance'),
          },
        ]
      : []),
    ...(totals.elevationGain != null
      ? [
          {
            value: formatElevation({ metres: totals.elevationGain, unit }),
            label: t('tripStats.share.card.climbed'),
          },
        ]
      : []),
    { value: formatNumber(totals.nights), label: t('tripStats.share.card.nightsOut') },
    { value: formatNumber(totals.days), label: t('tripStats.share.card.daysOutdoors') },
    { value: formatNumber(totals.places), label: t('tripStats.totals.places') },
  ];

  const tiles = (items: Tile[]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: isStory ? 26 : 12 }}>
      {items.map((tile) => (
        <View key={tile.label} style={{ width: '50%', paddingRight: 18, gap: 2 }}>
          <CardText
            size={big * (tile.value.length > 7 ? 0.72 : 1)}
            weight="900"
            lines={1}
            shadow={isSticker}
          >
            {tile.value}
          </CardText>
          <CardText
            size={isStory ? 15 : 13}
            weight="500"
            color={SHARE_PALETTE.dim}
            shadow={isSticker}
          >
            {tile.label}
          </CardText>
        </View>
      ))}
    </View>
  );

  const statement = (figure: string, rest: string) => (
    <View style={{ gap: 4 }}>
      <CardText size={isStory ? 64 : 42} weight="900" lines={1} shadow={isSticker}>
        {figure}
      </CardText>
      <CardText
        size={isStory ? 21 : 17}
        weight="600"
        color="rgba(255,255,255,0.8)"
        shadow={isSticker}
      >
        {rest}
      </CardText>
    </View>
  );

  switch (content.kind) {
    case 'totals':
      return tiles(totalTiles(content.totals));
    case 'year':
      return (
        <View style={{ gap: isStory ? 26 : 12 }}>
          {(
            [
              ['trips', t('tripStats.thisYear.trips')],
              ['nights', t('tripStats.thisYear.nights')],
              ['days', t('tripStats.thisYear.days')],
            ] as const
          ).map(([key, label]) => {
            const now = content.totals[key];
            const then = content.lastYear?.[key];
            return (
              <View key={key} style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
                <CardText size={big} weight="900" shadow={isSticker}>
                  {formatNumber(now)}
                </CardText>
                <View style={{ paddingBottom: isStory ? 6 : 3 }}>
                  <CardText size={15} weight="500" color={SHARE_PALETTE.dim} shadow={isSticker}>
                    {label}
                  </CardText>
                  {/* Neutral, as on the stats screen: only a rise is called out. */}
                  {then != null && now > then ? (
                    <CardText size={13} weight="700" color={SHARE_PALETTE.mint} shadow={isSticker}>
                      {t('tripStats.share.card.onLastYear', {
                        delta: `+${formatNumber(now - then)}`,
                        year: content.year - 1,
                      })}
                    </CardText>
                  ) : null}
                </View>
              </View>
            );
          })}
          {content.totals.distance != null ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
              <CardText size={big} weight="900" shadow={isSticker}>
                {formatDistance({ metres: content.totals.distance, unit })}
              </CardText>
              <CardText
                size={15}
                weight="500"
                color={SHARE_PALETTE.dim}
                shadow={isSticker}
                style={{ paddingBottom: isStory ? 8 : 4 }}
              >
                {t('tripStats.share.card.logged')}
              </CardText>
            </View>
          ) : null}
        </View>
      );
    case 'map':
      return (
        <View style={{ gap: 12 }}>
          {mapImage ? (
            <Image
              source={{ uri: mapImage }}
              style={{
                width: '100%',
                aspectRatio: mapAspect(format),
                borderRadius: isSticker ? 0 : 14,
              }}
            />
          ) : null}
          <CardText size={17} weight="600" shadow={isSticker}>
            {[
              t('tripStats.countTrips', { count: content.trips }),
              ...(content.distance != null
                ? [formatDistance({ metres: content.distance, unit })]
                : []),
            ].join(' · ')}
          </CardText>
        </View>
      );
    case 'goal': {
      const { progress } = content;
      const complete = isGoalComplete(progress);
      const ring = isStory ? 210 : 120;
      const text = (
        <View style={{ gap: 4, alignItems: isStory ? 'center' : 'flex-start' }}>
          <CardText size={isStory ? 36 : 26} weight="900" shadow={isSticker}>
            {formatMetric(progress.goal.metric, progress.value)}
          </CardText>
          <CardText size={16} weight="500" color={SHARE_PALETTE.dim} shadow={isSticker}>
            {t('tripStats.share.card.of', {
              target: formatMetric(progress.goal.metric, progress.goal.target),
            })}
          </CardText>
          {complete ? (
            <CardText size={14} weight="700" color={SHARE_PALETTE.mint} shadow={isSticker}>
              {t('tripStats.share.card.goalComplete')}
            </CardText>
          ) : null}
        </View>
      );
      return (
        <View style={{ gap: isStory ? 22 : 12, alignItems: isStory ? 'center' : 'stretch' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18 }}>
            <TickRing size={ring} fraction={goalFraction(progress)} complete={complete} />
            {isStory ? null : text}
          </View>
          {isStory ? text : null}
        </View>
      );
    }
    case 'parks':
      return <ParksBody visited={content.visited} format={format} big={big} />;
    case 'review':
      return (
        <ReviewBody
          review={content.review}
          page={content.page}
          format={format}
          options={options}
          unit={unit}
          tiles={tiles}
          totalTiles={totalTiles}
          statement={statement}
        />
      );
  }
}

/**
 * Goal progress as a ring of ticks, lit up to the fraction done, with the percentage (or a check)
 * in the middle. Ticks rather than an arc, so it draws with plain views and comes out the same in
 * the captured image.
 */
function TickRing({
  size,
  fraction,
  complete,
}: {
  size: number;
  fraction: number;
  complete: boolean;
}) {
  const ticks = 48;
  const lit = Math.round(Math.min(Math.max(fraction, 0), 1) * ticks);
  const tickLength = size * 0.11;
  const tickWidth = Math.max(size * 0.022, 2);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: ticks }, (_, index) => (
        <View
          key={index}
          style={{
            position: 'absolute',
            width: tickWidth,
            height: size,
            alignItems: 'center',
            transform: [{ rotate: `${(index * 360) / ticks}deg` }],
          }}
        >
          <View
            style={{
              width: tickWidth,
              height: tickLength,
              borderRadius: tickWidth / 2,
              backgroundColor: index < lit ? SHARE_PALETTE.mint : SHARE_PALETTE.faint,
            }}
          />
        </View>
      ))}
      <CardText size={size * (complete ? 0.26 : 0.22)} weight="900">
        {complete ? '✓' : `${Math.round(Math.min(fraction, 1) * 100)}%`}
      </CardText>
    </View>
  );
}

function ParksBody({
  visited,
  format,
  big,
}: {
  visited: readonly string[];
  format: ShareFormat;
  big: number;
}) {
  const { t } = useTranslation();
  const isStory = format === 'story';
  const isSticker = format === 'sticker';
  const visitedCodes = new Set(visited);
  const dot = isStory ? 26 : 18;
  const gap = dot * 0.42;
  return (
    <View style={{ gap: isStory ? 22 : 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
        <CardText size={big * 1.2} weight="900" shadow={isSticker}>
          {formatNumber(visitedCodes.size)}
        </CardText>
        <CardText
          size={17}
          weight="500"
          color={SHARE_PALETTE.dim}
          shadow={isSticker}
          style={{ paddingBottom: isStory ? 10 : 6 }}
        >
          {t('tripStats.share.card.parksVisited', { total: NATIONAL_PARK_COUNT })}
        </CardText>
      </View>
      {format === 'square' ? (
        <View style={{ height: 10, borderRadius: 5, backgroundColor: SHARE_PALETTE.faint }}>
          <View
            style={{
              height: 10,
              borderRadius: 5,
              width: `${(visitedCodes.size / NATIONAL_PARK_COUNT) * 100}%`,
              backgroundColor: SHARE_PALETTE.mint,
            }}
          />
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, width: 9 * dot + 8 * gap }}>
          {getNationalParks().map((park) => (
            <View
              key={park.code}
              style={{
                width: dot,
                height: dot,
                borderRadius: dot / 2,
                backgroundColor: visitedCodes.has(park.code)
                  ? SHARE_PALETTE.mint
                  : SHARE_PALETTE.faint,
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function ReviewBody({
  review,
  page,
  format,
  options,
  unit,
  tiles,
  totalTiles,
  statement,
}: {
  review: YearInReview;
  page: Extract<ShareContent, { kind: 'review' }>['page'];
  format: ShareFormat;
  options: ShareOptions;
  unit: TripDistanceUnit;
  tiles: (items: Tile[]) => ReactNode;
  totalTiles: (totals: Totals) => Tile[];
  statement: (figure: string, rest: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const isStory = format === 'story';
  const isSticker = format === 'sticker';
  switch (page) {
    case 'intro':
      return (
        <View style={{ gap: 10 }}>
          <CardText size={isStory ? 110 : 80} weight="900" lines={1} shadow={isSticker}>
            {String(review.year)}
          </CardText>
          <CardText size={20} weight="600" color="rgba(255,255,255,0.8)" shadow={isSticker}>
            {t('tripStats.review.introBody')}
          </CardText>
        </View>
      );
    case 'totals':
      return tiles(totalTiles(review.totals));
    case 'busiestMonth': {
      const busiest = review.busiestMonth;
      if (!busiest) return null;
      return (
        <View style={{ gap: 16 }}>
          {statement(
            formatMonthName(busiest.month.getMonth() + 1),
            t('tripStats.review.busiestBody', {
              trips: t('tripStats.countTrips', { count: busiest.trips }),
              nights: t('tripStats.countNights', { count: busiest.nights }),
            }),
          )}
          <MonthBars review={review} highlight={busiest.month} height={isStory ? 110 : 60} />
        </View>
      );
    }
    case 'longestTrip':
      return (
        <View style={{ gap: isStory ? 26 : 14 }}>
          {review.longestTrip
            ? statement(
                t('tripStats.countNights', { count: review.longestTrip.nights }),
                options.showNames
                  ? t('tripStats.review.longestNamed', { name: review.longestTrip.trip.name })
                  : t('tripStats.review.longest'),
              )
            : null}
          {review.farthestTrip?.trip.log?.distanceMeters != null
            ? statement(
                formatDistance({ metres: review.farthestTrip.trip.log.distanceMeters, unit }),
                options.showNames
                  ? t('tripStats.review.farthestNamed', { name: review.farthestTrip.trip.name })
                  : t('tripStats.review.farthest'),
              )
            : null}
        </View>
      );
    case 'newPlaces':
      return (
        <View style={{ gap: isStory ? 22 : 12 }}>
          {review.newPlaces > 0
            ? statement(
                formatNumber(review.newPlaces),
                t('tripStats.review.newPlaces', { count: review.newPlaces }),
              )
            : null}
          {review.newParks.length > 0 ? (
            <View style={{ gap: 6 }}>
              <CardText size={15} weight="700" color={SHARE_PALETTE.mint} shadow={isSticker}>
                {t('tripStats.review.newParks', { count: review.newParks.length })}
              </CardText>
              {review.newParks.slice(0, isStory ? 6 : 3).map((park) => (
                <CardText key={park.code} size={17} weight="600" lines={1} shadow={isSticker}>
                  {park.name}
                </CardText>
              ))}
            </View>
          ) : null}
        </View>
      );
    case 'summits':
      return (
        <View style={{ gap: isStory ? 22 : 12 }}>
          {statement(
            formatNumber(review.peakCount),
            t('tripStats.review.summitsReached', { count: review.peakCount }),
          )}
          {review.highest?.summit.elevationMeters != null ? (
            <View style={{ gap: 2 }}>
              <CardText size={15} weight="700" color={SHARE_PALETTE.mint} shadow={isSticker}>
                {t('tripStats.review.highest')}
              </CardText>
              <CardText size={22} weight="900" lines={1} shadow={isSticker}>
                {review.highest.summit.name}
              </CardText>
              <CardText size={17} weight="500" color={SHARE_PALETTE.dim} shadow={isSticker}>
                {formatElevation({ metres: review.highest.summit.elevationMeters, unit })}
              </CardText>
            </View>
          ) : null}
        </View>
      );
    case 'goals':
      return <GoalsMet review={review} format={format} statement={statement} />;
    case 'summary': {
      const summary: Tile[] = [
        ...totalTiles(review.totals),
        ...(review.peakCount > 0
          ? [{ value: formatNumber(review.peakCount), label: t('tripStats.share.card.summits') }]
          : []),
        ...(review.newParks.length > 0
          ? [
              {
                value: formatNumber(review.newParks.length),
                label: t('tripStats.share.card.newParks'),
              },
            ]
          : []),
        ...(review.goalsMet.length > 0
          ? [
              {
                value: formatNumber(review.goalsMet.length),
                label: t('tripStats.share.card.goalsMet'),
              },
            ]
          : []),
      ];
      // A square has room for four.
      return tiles(summary.slice(0, format === 'square' ? 4 : 8));
    }
  }
}

function GoalsMet({
  review,
  format,
  statement,
}: {
  review: YearInReview;
  format: ShareFormat;
  statement: (figure: string, rest: string) => ReactNode;
}) {
  const { t } = useTranslation();
  const isStory = format === 'story';
  const isSticker = format === 'sticker';
  const { goalsMet } = review;
  return (
    <View style={{ gap: isStory ? 18 : 10 }}>
      {statement(
        formatNumber(goalsMet.length),
        t('tripStats.review.goalsMet', { count: goalsMet.length }),
      )}
      {goalsMet.slice(0, isStory ? 5 : 2).map((progress) => (
        <View key={progress.goal.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <CardText size={17} weight="900" color={SHARE_PALETTE.mint} shadow={isSticker}>
            ✓
          </CardText>
          <GoalName progress={progress} shadow={isSticker} />
        </View>
      ))}
    </View>
  );
}

function GoalName({
  progress,
  shadow,
}: {
  progress: YearInReview['goalsMet'][number];
  shadow: boolean;
}) {
  const title = useGoalTitle();
  return (
    <CardText size={17} weight="600" lines={1} shadow={shadow} style={{ flex: 1 }}>
      {title(progress.goal)}
    </CardText>
  );
}

function MonthBars({
  review,
  highlight,
  height,
}: {
  review: YearInReview;
  highlight: Date;
  height: number;
}) {
  const most = Math.max(...review.months.map((month) => Math.max(month.nights, month.trips)), 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: height + 18 }}>
      {review.months.map((month) => (
        <View key={month.month.getTime()} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View
            style={{
              alignSelf: 'stretch',
              borderRadius: 3,
              height: Math.max(3, (height * Math.max(month.nights, month.trips)) / most),
              backgroundColor:
                month.month.getTime() === highlight.getTime()
                  ? SHARE_PALETTE.mint
                  : 'rgba(255,255,255,0.25)',
            }}
          />
          <CardText size={10} weight="600" color="rgba(255,255,255,0.6)">
            {formatMonthName(month.month.getMonth() + 1).charAt(0)}
          </CardText>
        </View>
      ))}
    </View>
  );
}
