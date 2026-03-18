import { featureFlags } from 'expo-app/config';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="(home)">
        <Label>{t('navigation.dashboard')}</Label>
        <Icon sf="house.fill" src={require('../../../assets/tab-icons/home.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="packs">
        <Label>{t('navigation.packs')}</Label>
        <Icon sf="backpack" src={require('../../../assets/tab-icons/backpack.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="feed" hidden={!featureFlags.enableFeed}>
        <Label>{t('navigation.feed')}</Label>
        <Icon sf="photo.stack" src={require('../../../assets/tab-icons/home.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="trips" hidden={!featureFlags.enableTrips}>
        <Label>{t('navigation.trips')}</Label>
        <Icon sf="map.fill" src={require('../../../assets/tab-icons/map.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="catalog">
        <Label>{t('navigation.catalog')}</Label>
        <Icon sf="clipboard.fill" src={require('../../../assets/tab-icons/catalog.png')} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label>{t('navigation.profile')}</Label>
        <Icon sf="person.circle.fill" src={require('../../../assets/tab-icons/profile.png')} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
