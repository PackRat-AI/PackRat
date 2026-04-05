/**
 * On-Device AI Settings Component
 * Allows users to configure on-device AI mode and manage model downloads
 */
import { Button, Text } from '@packrat/ui/nativewindui';
import { Icon } from '@roninoss/icons';
import { DEFAULT_MODEL_CONFIG } from 'expo-app/features/ai/config/modelConfig';
import { useCactusAI } from 'expo-app/features/ai/hooks/useCactusAI';
import { useOnDeviceAI, type AIMode } from 'expo-app/features/ai/providers/OnDeviceAIProvider';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';

export function OnDeviceAISettings() {
  const { mode, setMode, isModelDownloaded, setModelDownloaded, isOnDeviceAvailable } = useOnDeviceAI();
  const { isDownloading, downloadProgress, isReady, download, destroy, error } = useCactusAI();
  const [isDeleting, setIsDeleting] = useState(false);
  const { colors } = useColorScheme();

  const handleModeChange = async (newMode: AIMode) => {
    try {
      await setMode(newMode);
    } catch (error) {
      Alert.alert('Error', 'Failed to change AI mode');
    }
  };

  const handleDownloadModel = async () => {
    try {
      await download();
      await setModelDownloaded(true);
    } catch (error) {
      Alert.alert('Error', 'Failed to download model');
    }
  };

  const handleDeleteModel = async () => {
    Alert.alert(
      'Delete Model',
      'Are you sure you want to delete the on-device model? You will need to download it again to use on-device AI.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeleting(true);
              await destroy();
              await setModelDownloaded(false);
              // Switch to cloud mode if currently using on-device
              if (mode === 'on-device') {
                await setMode('cloud');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to delete model');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  if (!isOnDeviceAvailable) {
    return (
      <View className="p-4 bg-card rounded-lg">
        <Text className="text-muted-foreground">
          On-device AI is not available on this device
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-4">
      {/* Mode Selection */}
      <View className="p-4 bg-card rounded-lg">
        <Text className="text-lg font-semibold mb-3">AI Mode</Text>
        
        <View className="gap-2">
          <ModeOption
            title="Cloud"
            description="Use cloud-based AI (requires internet)"
            icon="cloud"
            selected={mode === 'cloud'}
            onSelect={() => handleModeChange('cloud')}
          />
          
          <ModeOption
            title="On-Device"
            description="Use on-device AI (works offline)"
            icon="smartphone"
            selected={mode === 'on-device'}
            onSelect={() => handleModeChange('on-device')}
            disabled={!isModelDownloaded}
          />
          
          <ModeOption
            title="Hybrid"
            description="Use on-device when available, cloud as fallback"
            icon="layers"
            selected={mode === 'hybrid'}
            onSelect={() => handleModeChange('hybrid')}
          />
        </View>
      </View>

      {/* Model Management */}
      <View className="p-4 bg-card rounded-lg">
        <Text className="text-lg font-semibold mb-3">Model Management</Text>
        
        {!isModelDownloaded && !isDownloading && (
          <View className="gap-2">
            <Text className="text-muted-foreground text-sm mb-2">
              Download the {DEFAULT_MODEL_CONFIG.name} AI model to enable on-device inference. This will use approximately {DEFAULT_MODEL_CONFIG.sizeMB}MB of storage.
            </Text>
            <Button onPress={handleDownloadModel}>
              <Icon name="download" size={16} color="white" />
              <Text className="ml-2 text-white">Download Model</Text>
            </Button>
          </View>
        )}

        {isDownloading && (
          <View className="gap-2">
            <Text className="text-sm mb-2">
              Downloading model: {Math.round(downloadProgress * 100)}%
            </Text>
            <View className="h-2 bg-muted rounded-full overflow-hidden">
              <View 
                className="h-full bg-primary"
                style={{ width: `${downloadProgress * 100}%` }}
              />
            </View>
            <ActivityIndicator className="mt-2" />
          </View>
        )}

        {isModelDownloaded && !isDownloading && (
          <View className="gap-2">
            <View className="flex-row items-center gap-2 mb-2">
              <Icon name="check-circle" size={16} color="green" />
              <Text className="text-sm text-green-600">Model downloaded and ready</Text>
            </View>
            <Button 
              variant="destructive" 
              onPress={handleDeleteModel}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <>
                  <Icon name="trash" size={16} color="white" />
                  <Text className="ml-2 text-white">Delete Model</Text>
                </>
              )}
            </Button>
          </View>
        )}

        {error && (
          <View className="mt-2 p-2 bg-destructive/10 rounded">
            <Text className="text-destructive text-sm">{error.message}</Text>
          </View>
        )}
      </View>

      {/* Information */}
      <View className="p-4 bg-card rounded-lg">
        <Text className="text-lg font-semibold mb-2">About On-Device AI</Text>
        <View className="gap-2">
          <InfoItem 
            icon="zap" 
            text="Works completely offline" 
          />
          <InfoItem 
            icon="shield" 
            text="Your data stays on your device" 
          />
          <InfoItem 
            icon="trending-up" 
            text="Faster response times" 
          />
          <InfoItem 
            icon="wifi-off" 
            text="No internet required once downloaded" 
          />
        </View>
      </View>
    </View>
  );
}

interface ModeOptionProps {
  title: string;
  description: string;
  icon: string;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}

function ModeOption({ title, description, icon, selected, onSelect, disabled }: ModeOptionProps) {
  return (
    <TouchableOpacity
      onPress={onSelect}
      disabled={disabled}
      className={`p-3 rounded-lg border ${
        selected 
          ? 'border-primary bg-primary/10' 
          : 'border-border bg-background'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <View className="flex-row items-center gap-3">
        <Icon name={icon} size={20} color={selected ? colors.primary : colors.grey} />
        <View className="flex-1">
          <Text className={`font-medium ${selected ? 'text-primary' : 'text-foreground'}`}>
            {title}
          </Text>
          <Text className="text-xs text-muted-foreground">{description}</Text>
        </View>
        {selected && <Icon name="check" size={20} color={colors.primary} />}
      </View>
    </TouchableOpacity>
  );
}

interface InfoItemProps {
  icon: string;
  text: string;
}

function InfoItem({ icon, text }: InfoItemProps) {
  const { colors } = useColorScheme();
  
  return (
    <View className="flex-row items-center gap-2">
      <Icon name={icon} size={14} color={colors.grey} />
      <Text className="text-sm text-muted-foreground">{text}</Text>
    </View>
  );
}
