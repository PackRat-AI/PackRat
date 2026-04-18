import { useAtom } from 'jotai';
import { activeLocationAtom } from '../atoms/locationsAtoms';

export function useActiveLocation() {
  const [activeLocation, setActiveLocation] = useAtom(activeLocationAtom);

  return {
    activeLocation,
    setActiveLocation,
  };
}
