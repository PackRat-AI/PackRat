import { initRevenueCat, useIdentifyUser } from 'expo-app/features/purchases';
import { useEffect } from 'react';

function PurchasesEffects() {
  useIdentifyUser();
  return null;
}

export function PurchasesProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initRevenueCat();
  }, []);

  return (
    <>
      <PurchasesEffects />
      {children}
    </>
  );
}
