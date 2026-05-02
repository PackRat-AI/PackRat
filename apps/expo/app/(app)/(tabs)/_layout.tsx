import { featureFlags } from '@packrat/app/config';
import { useTranslation } from '@packrat/app/lib/hooks/useTranslation';
import { NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>{t('navigation.dashboard')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" src={require('../../../assets/tab-icons/home.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="packs">
        <NativeTabs.Trigger.Label>{t('navigation.packs')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="backpack"
          src={require('../../../assets/tab-icons/backpack.png')}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="feed" hidden={!featureFlags.enableFeed}>
        <NativeTabs.Trigger.Label>{t('navigation.feed')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="photo.on.rectangle.angled"
          src={require('../../../assets/tab-icons/home.png')}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trips" hidden={!featureFlags.enableTrips}>
        <NativeTabs.Trigger.Label>{t('navigation.trips')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map" src={require('../../../assets/tab-icons/map.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="catalog">
        <NativeTabs.Trigger.Label>{t('navigation.catalog')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="clipboard"
          src={require('../../../assets/tab-icons/catalog.png')}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>{t('navigation.profile')}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf="person.circle"
          src={require('../../../assets/tab-icons/profile.png')}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
