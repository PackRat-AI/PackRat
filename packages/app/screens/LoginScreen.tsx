import { View } from 'react-native';
import { RHeading, RStack, RButton, RText, RIconButton } from '@packrat/ui';
import { FontAwesome } from '@expo/vector-icons';
import { NODE_ENV } from '@env';
import { Link, usePathname } from 'expo-router';
import { InformUser } from '../utils/ToastUtils';
import useTheme from '../hooks/useTheme';
import { InputText, InputTextRules } from 'app/components/InputText';
import { useGoogleAuth, useLogin } from 'app/hooks/login';

const demoUser = {
  email: 'zoot3@email.com',
  password: '12345678',
};

export default function Login() {
  const {
    form: {
      control,
      formState: { isValid },
      handleSubmit,
    },
    handleLogin,
    hasError,
  } = useLogin();
  const { enableGoogleLogin, isGoogleSignInReady, promptAsync } =
    useGoogleAuth();
  const { currentTheme } = useTheme();

  if (hasError) {
    InformUser({
      title: 'Wrong-password',
      duration: 3000,
      placement: 'top-right',
      style: { backgroundColor: currentTheme.colors.error },
    });
  }

  return (
    <RStack>
      <View style={{ width: '100%', alignItems: 'center' }}>
        <View style={{ paddingTop: 32, width: '90%', maxWidth: 290 }}>
          <RHeading fontSize={32} color="#212121" fontWeight="semibold">
            Welcome
          </RHeading>
          <RHeading
            color="grey"
            fontWeight="medium"
            fontSize={14}
            style={{ marginTop: 8 }}
          >
            Sign in to continue!
          </RHeading>

          <RStack style={{ marginTop: 16, gap: 8 }}>
            <InputText
              label="Email ID"
              keyboardType="email-address"
              control={control}
              name="email"
              rules={InputTextRules.email}
            />
            <InputText
              label="Password"
              secureTextEntry
              control={control}
              name="password"
              rules={InputTextRules.password}
            />

            <RButton
              disabled={!isValid}
              onPress={handleSubmit(handleLogin)}
              style={{ marginTop: 16 }}
              backgroundColor="mediumpurple"
            >
              Sign in
            </RButton>
            <RStack
              style={{
                marginTop: 16,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <RText fontSize={14} color="grey">
                I'm a new user.
              </RText>
              <Link href="/register">
                <RText
                  style={{
                    color: '#818cf8',
                    fontWeight: 400,
                    fontSize: 12,
                  }}
                >
                  Sign Up
                </RText>
              </Link>
            </RStack>

            <RStack style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Link href="/password-reset">
                <RText
                  style={{
                    color: '#818cf8',
                    fontWeight: 400,
                    fontSize: 12,
                  }}
                >
                  Reset Password?
                </RText>
              </Link>
            </RStack>
            {/* Google Login starts */}
            <RStack
              style={{
                marginTop: 8,
                flexDirection: 'row',
                justifyContent: 'center',
              }}
            >
              <RText color="grey" fontWeight="medium" fontSize={14}>
                Or
              </RText>
            </RStack>

            {/* Google Login */}
            {enableGoogleLogin && (
              <RStack
                style={{
                  marginTop: 8,
                  flexDirection: 'row',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <RIconButton
                  disabled={!isGoogleSignInReady}
                  onPress={async () => await promptAsync()}
                  backgroundColor="red"
                  style={{ width: '100%', color: 'white' }}
                  icon={
                    <FontAwesome
                      name="google"
                      size={16}
                      color={currentTheme.colors.white}
                    />
                  }
                >
                  Sign in with Google
                </RIconButton>
              </RStack>
            )}

            {/* Demo Login for Development start */}
            {NODE_ENV !== 'production' && (
              <RStack
                style={{
                  marginTop: 8,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <RButton
                  style={{ width: '100%' }}
                  disabled={!isGoogleSignInReady}
                  onPress={() => handleLogin(demoUser)}
                  backgroundColor="purple"
                >
                  Demo User
                </RButton>
              </RStack>
            )}
            {/* Demo Login for Development end */}
          </RStack>
        </View>
      </View>
    </RStack>
  );
}
