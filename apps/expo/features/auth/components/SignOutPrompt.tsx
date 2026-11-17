import { AlertAnchor, type AlertMethods } from '@packrat/ui/src/alert';
import {
  isLoadingAtom,
  isSignOutRedirectingAtom,
  showSignOutPromptAtom,
  suppressSignOutNavAtom,
} from 'expo-app/features/auth/atoms/authAtoms';
import AsyncStorage from 'expo-app/lib/asyncStorage';
import { useTranslation } from 'expo-app/lib/hooks/useTranslation';
import { router } from 'expo-router';
import { useSetAtom } from 'jotai';
import { useEffect, useRef } from 'react';

/**
 * Post-sign-out choice: stay a guest or sign in again. Material 3 AlertDialog (Compose) on
 * Android. Back or a scrim tap counts as staying logged out, the cancel slot.
 */
export function SignOutPrompt() {
  const { t } = useTranslation();
  const alertRef = useRef<AlertMethods>(null);
  const setIsLoading = useSetAtom(isLoadingAtom);
  const setIsSignOutRedirecting = useSetAtom(isSignOutRedirectingAtom);
  const setSuppressSignOutNav = useSetAtom(suppressSignOutNavAtom);
  const setShowSignOutPrompt = useSetAtom(showSignOutPromptAtom);

  useEffect(() => {
    alertRef.current?.alert({
      title: t('auth.loggedOut'),
      message: t('auth.loggedOutMessage'),
      buttons: [
        {
          text: t('auth.stayLoggedOut'),
          style: 'cancel',
          onPress: async () => {
            // Clear spinner first so AppLayout doesn't show auth screen,
            // then release the suppress flag and navigate home as guest.
            setShowSignOutPrompt(false);
            setIsLoading(false);
            setIsSignOutRedirecting(false);
            setSuppressSignOutNav(false);
            await AsyncStorage.setItem('skipped_login', 'true');
            router.replace('/');
          },
        },
        {
          text: t('auth.signInAgain'),
          style: 'destructive',
          onPress: () => {
            // Release suppress while isLoadingAtom is still true — AppLayout's
            // useEffect sees isLoadingGlobal=true && !isAuthed and navigates to
            // /auth via the NativeTabs-safe useEffect path.
            setShowSignOutPrompt(false);
            setSuppressSignOutNav(false);
          },
        },
      ],
    });
  }, [t, setIsLoading, setIsSignOutRedirecting, setSuppressSignOutNav, setShowSignOutPrompt]);

  return <AlertAnchor ref={alertRef} />;
}
