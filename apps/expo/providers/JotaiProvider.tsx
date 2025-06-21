import { Provider } from 'jotai';
import { store } from 'expo-app/atoms/store';

export function JotaiProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
