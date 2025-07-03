import { Icon } from '@roninoss/icons';
import * as Sentry from '@sentry/react-native';
import { router } from 'expo-router';
import type React from 'react';
import type { ErrorInfo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useColorScheme } from '~/lib/hooks/useColorScheme';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
  onError?: (error: unknown, info: { componentStack: string }) => void;
};

const DefaultFallback = () => {
  const { colors } = useColorScheme();

  return (
    <View className="flex-1 items-center justify-center bg-background px-6 pt-12">
      <View className="flex-1 items-center justify-center">
        {/* Icon */}
        <Icon name="exclamation" size={48} color={colors.destructive} />

        {/* Content */}
        <View className="mt-6 w-full max-w-sm">
          <Text className="text-center text-xl font-bold text-foreground">
            Something went wrong
          </Text>
          <Text className="mt-2 text-center text-base text-muted-foreground">
            The application encountered an unexpected error. You can try again or go back to the
            home screen.
          </Text>
        </View>

        {/* Action */}
        <View className="mt-10 w-full max-w-sm">
          <Pressable
            onPress={() => router.replace('/')}
            className="w-full items-center justify-center rounded-lg border border-border py-3.5"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Text className="font-medium text-foreground">Go Home</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export function ErrorBoundary({ children, fallback, onReset, onError }: ErrorBoundaryProps) {
  const handleError = (error: unknown, info: { componentStack: string }) => {
    // Log the error to your preferred logging service
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Component stack:', info.componentStack);

    // Call the custom error handler if provided
    if (onError) {
      onError(error, info);
    }
  };

  return (
    <Sentry.ErrorBoundary
      fallback={fallback ? <>{fallback}</> : DefaultFallback}
      onReset={onReset}
      onError={(error: unknown, componentStack: ErrorInfo['componentStack']) =>
        handleError(error, { componentStack: componentStack || '' })
      }
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
