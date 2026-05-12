'use client';
import { AppShell } from 'web-app/components/app-shell';
import { AIScreen } from 'web-app/components/screens/ai-screen';
import { CatalogScreen } from 'web-app/components/screens/catalog-screen';
import { FeedScreen } from 'web-app/components/screens/feed-screen';
import { GearInventoryScreen } from 'web-app/components/screens/gear-inventory-screen';
import { GuidesScreen } from 'web-app/components/screens/guides-screen';
import { HomeScreen } from 'web-app/components/screens/home-screen';
import { MessagesScreen } from 'web-app/components/screens/messages-screen';
import { PacksScreen } from 'web-app/components/screens/packs-screen';
import { ProfileScreen } from 'web-app/components/screens/profile-screen';
import { ShoppingListScreen } from 'web-app/components/screens/shopping-list-screen';
import { TripsScreen } from 'web-app/components/screens/trips-screen';
import { WeightProvider } from 'web-app/lib/weight-context';

export default function App() {
  return (
    <WeightProvider>
      <AppShell>
        {(screen, navigate) => {
          switch (screen) {
            case 'home':
              return <HomeScreen navigate={navigate} />;
            case 'packs':
              return <PacksScreen />;
            case 'catalog':
              return <CatalogScreen />;
            case 'feed':
              return <FeedScreen />;
            case 'trips':
              return <TripsScreen />;
            case 'profile':
              return <ProfileScreen navigate={navigate} />;
            case 'ai':
              return <AIScreen />;
            case 'messages':
              return <MessagesScreen />;
            case 'guides':
              return <GuidesScreen />;
            case 'gear-inventory':
              return <GearInventoryScreen onBack={() => navigate('profile')} />;
            case 'shopping-list':
              return <ShoppingListScreen onBack={() => navigate('profile')} />;
            default:
              return <HomeScreen navigate={navigate} />;
          }
        }}
      </AppShell>
    </WeightProvider>
  );
}
