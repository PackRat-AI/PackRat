import { Moon, Sun } from 'lucide-react';
import { useColorScheme } from './index.web';

export function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  return (
    <button
      type="button"
      onClick={toggleColorScheme}
      className="flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
      aria-label="Toggle theme"
    >
      {colorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
