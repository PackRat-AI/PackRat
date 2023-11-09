import { Slot } from 'expo-router';

import { Platform, View } from 'react-native';

import Navigation from '../screens/Navigation';

import { Provider } from '../provider';
import Footer from '../components/footer/Footer';

export default function HomeLayout() {
  return (
    <Provider>
      <Navigation />
      <Slot />
      {/* {Platform.OS === 'web' ? <Footer /> : null} */}
    </Provider>
  );
}
