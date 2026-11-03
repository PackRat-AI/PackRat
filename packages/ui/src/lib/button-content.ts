import { createContext, useContext } from 'react';

/**
 * What a `Button` hands down to its children: the variant's content colour (MD3's on-colour for
 * filled, primary for outlined/text) as a concrete value, so `Text` and `Icon` inside a button
 * paint themselves correctly whatever shape the call site's children take. `null` outside a button.
 */
type ButtonContent = { color: string };

const ButtonContentContext = createContext<ButtonContent | null>(null);

function useButtonContent() {
  return useContext(ButtonContentContext);
}

export { ButtonContentContext, useButtonContent };
export type { ButtonContent };
