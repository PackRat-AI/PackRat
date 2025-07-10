import { store } from 'expo-app/atoms/store';
import { Provider } from 'jotai';

export function JotaiProvider({ children }: { children: React.ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}
