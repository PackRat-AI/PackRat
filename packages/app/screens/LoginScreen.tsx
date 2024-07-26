import React, { useState } from 'react';
import { View } from 'react-native';
import { RStack, RScrollView } from '@packrat/ui';
import useTheme from '../hooks/useTheme';
import { useGoogleAuth, useLogin } from 'app/auth/hooks';
import { SignInScreen } from '@packrat/ui/src/Bento/forms/layouts';

const demoUser = {
  email: 'zoot3@email.com',
  password: '12345678',
};

export default function Login() {
  const { enableGoogleLogin, isGoogleSignInReady, promptAsync } =
    useGoogleAuth();

  function useSignIn() {
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>(
      'idle',
    );
    const { handleLogin } = useLogin();
    return {
      signInStatus: status,
      signIn: async (data) => {
        await setStatus('loading');
        await handleLogin(data);
        setStatus('idle');
      },
    };
  }

  const { signIn, signInStatus } = useSignIn();
  const { currentTheme } = useTheme();

  return (
    <SignInScreen
      promptAsync={promptAsync}
      signIn={signIn}
      signInStatus={signInStatus}
      isGoogleSignInReady={isGoogleSignInReady}
    />
  );
}
