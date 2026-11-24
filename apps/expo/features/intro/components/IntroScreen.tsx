import { Text } from '@packrat/ui/src/text';
import { Icon } from 'expo-app/components/Icon';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { testIds } from 'expo-app/lib/testIds';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Image, Pressable, ScrollView, View } from 'react-native';
import PagerView from 'react-native-pager-view';
import Animated, { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { INTRO_PAGES, type IntroPage } from '../lib/introPages';

const LOGO_MARK = require('expo-app/assets/intro-logo-mark.png');

type IntroScreenProps = {
  onFinished: () => void;
};

/**
 * First-launch intro: full-screen pages, each in its own colour, that explain
 * what PackRat is for, then hand off to the welcome screen.
 */
export function IntroScreen({ onFinished }: IntroScreenProps) {
  const { t } = useTranslation();
  const pagerRef = useRef<PagerView>(null);
  const [index, setIndex] = useState(0);
  const reduceMotion = useReducedMotion();

  const page = INTRO_PAGES[index] ?? INTRO_PAGES[0];
  const isLastPage = index === INTRO_PAGES.length - 1;
  const background = page?.background ?? '#337F63';

  const advance = () => {
    if (isLastPage) return;
    if (reduceMotion) {
      pagerRef.current?.setPageWithoutAnimation(index + 1);
    } else {
      pagerRef.current?.setPage(index + 1);
    }
  };

  return (
    <Animated.View style={{ flex: 1, backgroundColor: background }} testID={testIds.intro.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <View className="h-12 flex-row items-center justify-end px-2">
          {!isLastPage && (
            <Pressable
              onPress={onFinished}
              accessibilityRole="button"
              className="h-10 justify-center rounded-full px-4"
              testID={testIds.intro.skip}
            >
              <Text className="font-semibold text-white/85">{t('intro.skip')}</Text>
            </Pressable>
          )}
        </View>

        <PagerView
          ref={pagerRef}
          style={{ flex: 1 }}
          initialPage={0}
          onPageSelected={(event) => setIndex(event.nativeEvent.position)}
        >
          {INTRO_PAGES.map((item, offset) => (
            <View key={item.key} testID={testIds.intro.page(offset)}>
              <IntroPageView page={item} />
            </View>
          ))}
        </PagerView>

        <View className="h-px bg-white/20" />
        <View className="h-[76px] flex-row items-center justify-between px-6">
          <View
            className="flex-row gap-2"
            accessible
            accessibilityLabel={t('intro.pageOf', {
              current: index + 1,
              total: INTRO_PAGES.length,
            })}
            testID={testIds.intro.indicator}
          >
            {INTRO_PAGES.map((item, offset) => (
              <View
                key={item.key}
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: `rgba(255,255,255,${offset === index ? 0.95 : 0.35})` }}
              />
            ))}
          </View>

          {isLastPage ? (
            <Pressable
              onPress={onFinished}
              accessibilityRole="button"
              className="h-10 justify-center rounded-full bg-white px-6"
              testID={testIds.intro.getStarted}
            >
              <Text className="font-semibold" style={{ color: background }}>
                {t('intro.getStarted')}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={advance}
              accessibilityRole="button"
              accessibilityLabel={t('intro.next')}
              className="h-12 w-12 items-center justify-center rounded-full"
              testID={testIds.intro.next}
            >
              <Icon name="chevron-right" size={30} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

function IntroPageView({ page }: { page: IntroPage }) {
  const { t } = useTranslation();
  const copy = `intro.pages.${page.copyKey}` as const;

  return (
    <ScrollView
      contentContainerClassName="flex-grow items-center justify-center px-9 py-10"
      showsVerticalScrollIndicator={false}
    >
      <View
        className="mb-7 h-[170px] items-center justify-center"
        importantForAccessibility="no-hide-descendants"
      >
        {page.artwork.kind === 'logo' ? (
          <Image
            source={LOGO_MARK}
            style={{ width: 180, height: 180, tintColor: 'rgba(255,255,255,0.82)' }}
            resizeMode="contain"
          />
        ) : (
          <Icon name={page.artwork.name} size={120} color="rgba(255,255,255,0.82)" />
        )}
      </View>

      <Text
        accessibilityRole="header"
        className="mb-7 text-center text-[28px] font-semibold leading-9 text-white"
      >
        {t(`${copy}.title`)}
      </Text>
      <Text className="mb-4 text-center text-base leading-6 text-white/90">
        {t(`${copy}.lead`)}
      </Text>
      <Text className="mb-7 text-center text-base leading-6 text-white/90">
        {t(`${copy}.detail`)}
      </Text>
      <Text className="text-center text-[15px] italic text-white/70">{t(`${copy}.tagline`)}</Text>
    </ScrollView>
  );
}
