import { Icon } from '@roninoss/icons';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity } from 'react-native';

interface ImageAnalysisButtonProps {
  onPress: () => void;
  isAnalyzing: boolean;
  disabled?: boolean;
}

export function ImageAnalysisButton({ onPress, isAnalyzing, disabled = false }: ImageAnalysisButtonProps) {
  const { colors } = useColorScheme();

  if (isAnalyzing) {
    return (
      <TouchableOpacity
        disabled
        className="flex-row items-center justify-center rounded-lg bg-primary/20 px-4 py-3"
      >
        <ActivityIndicator size="small" color={colors.primary} />
        <Text className="ml-2 text-primary">Analyzing gear...</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center justify-center rounded-lg px-4 py-3 ${
        disabled ? 'bg-muted' : 'bg-primary'
      }`}
    >
      <Icon 
        name="camera" 
        size={20} 
        color={disabled ? colors.grey3 : colors.background} 
      />
      <Text 
        className={`ml-2 font-medium ${
          disabled ? 'text-muted-foreground' : 'text-primary-foreground'
        }`}
      >
        Identify Gear with AI
      </Text>
    </TouchableOpacity>
  );
}