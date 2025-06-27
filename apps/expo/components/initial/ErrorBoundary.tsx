'use client';

import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/useColorScheme';
import { router } from 'expo-router';
import type React from 'react';
import type { ErrorInfo } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { Pressable, Text, View } from 'react-native';

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onReset?: () => void;
  onError?: (error: Error, info: { componentStack: string }) => void;
};

const DefaultFallback = ({ resetErrorBoundary }: { resetErrorBoundary: () => void }) => {
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

        {/* Actions */}
        <View className="mt-10 w-full max-w-sm">
          <Pressable
            onPress={resetErrorBoundary}
            className="mb-4 w-full items-center justify-center rounded-lg bg-primary py-3.5"
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Text className="font-medium text-primary-foreground">Try Again</Text>
          </Pressable>

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
  const handleError = (error: Error, info: { componentStack: string }) => {
    // Log the error to your preferred logging service
    console.error('Error caught by ErrorBoundary:', error);
    console.error('Component stack:', info.componentStack);

    // Call the custom error handler if provided
    if (onError) {
      onError(error, info);
    }
  };

  return (
    <ReactErrorBoundary
      FallbackComponent={fallback ? () => <>{fallback}</> : DefaultFallback}
      onReset={onReset}
      onError={(error: Error, info: ErrorInfo) =>
        handleError(error, { componentStack: info.componentStack || '' })
      }
    >
      {children}
    </ReactErrorBoundary>
  );
}
