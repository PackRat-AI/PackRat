import { generateText, streamText } from 'ai';
import { llama } from '@react-native-ai/llama';
import { ActivityIndicator, Button, Text } from '@packrat/ui/nativewindui';
import { Screen } from 'expo-app/components/Screen';
import { useColorScheme } from 'expo-app/lib/hooks/useColorScheme';
import { Stack } from 'expo-router';
import * as React from 'react';
import { Alert, ScrollView, View } from 'react-native';

export default function AIChatLocal() {
  const { colors } = useColorScheme();
  const [modelStatus, setModelStatus] = React.useState('idle');
  const [streamingStatus, setStreamingStatus] = React.useState('idle');
  const [isModelReady, setIsModelReady] = React.useState(false);
  const modelRef = React.useRef<any>(null);

  // Initialize model on component mount
  React.useEffect(() => {
    const initializeModel = async () => {
      try {
        setModelStatus('downloading');
        console.log('Creating model instance...');

        // Create model instance (Model ID format: "owner/repo/filename.gguf")
        const model = llama.languageModel(
          'ggml-org/SmolLM3-3B-GGUF/SmolLM3-Q4_K_M.gguf',
          {
            n_ctx: 2048,
            n_gpu_layers: 99,
          },
        );

        // Download from HuggingFace (with progress)
        console.log('Starting model download...');
        await model.download((progress) => {
          console.log(`Downloading: ${progress.percentage}%`);
          setModelStatus(`downloading ${progress.percentage}%`);
        });

        setModelStatus('preparing');
        console.log('Preparing model...');
        // Initialize model (loads into memory)
        await model.prepare();

        modelRef.current = model;
        setIsModelReady(true);
        setModelStatus('ready');
        console.log('Model loaded and ready!');
      } catch (error) {
        console.error('Failed to initialize model:', error);
        setModelStatus('error');
        Alert.alert(
          'Error',
          'Failed to initialize local AI model. Check console for details.',
        );
      }
    };

    initializeModel();
    return () => {
      // Cleanup model on unmount
      if (modelRef.current) {
        modelRef.current.unload().catch(console.error);
      }
    };
  }, []);

  const handleGenerateText = async () => {
    if (!modelRef.current || !isModelReady) {
      Alert.alert('Error', 'Model is not ready yet');
      return;
    }

    try {
      setStreamingStatus('generating');
      console.log('Starting text generation...');

      // Generate text (non-streaming)
      const { text } = await generateText({
        model: modelRef.current,
        messages: [
          // { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'hi' },
        ],
        maxOutputTokens: 100,
        temperature: 0.7,
      });

      console.log('Generated text:', text);
      setStreamingStatus('complete');
    } catch (error) {
      console.error('Text generation error:', error);
      setStreamingStatus('error');
      Alert.alert(
        'Error',
        'Failed to generate text. Check console for details.',
      );
    }
  };

  const handleStreamText = async () => {
    if (!modelRef.current || !isModelReady) {
      Alert.alert('Error', 'Model is not ready yet');
      return;
    }

    try {
      setStreamingStatus('streaming');
      console.log('Starting text streaming...');

      // Stream text
      const result = streamText({
        model: modelRef.current,
        messages: [
          // { role: 'system', content: 'You are a helpful assistant.' },
          {
            role: 'user',
            content: 'Hi',
          },
        ],
        maxOutputTokens: 200,
        temperature: 0.7,
      });

      console.log('Streaming response:');
      let fullResponse = '';

      for await (const chunk of result.textStream) {
        // process.stdout.write(chunk);
        console.log(chunk); // Also log each chunk
        fullResponse += chunk;
      }

      console.log('\nStreaming complete. Full response:', fullResponse);
      setStreamingStatus('complete');
    } catch (error) {
      console.error('Streaming error:', error);
      setStreamingStatus('error');
      Alert.alert('Error', 'Failed to stream text. Check console for details.');
    }
  };

  const getModelStatusColor = () => {
    switch (modelStatus) {
      case 'ready':
        return colors.green;
      case 'error':
        return colors.red;
      case 'downloading':
      case 'preparing':
        return colors.amber;
      default:
        return colors.gray;
    }
  };

  const getStreamStatusColor = () => {
    switch (streamingStatus) {
      case 'complete':
        return colors.green;
      case 'error':
        return colors.red;
      case 'generating':
      case 'streaming':
        return colors.amber;
      default:
        return colors.gray;
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Local AI Chat',
          headerStyle: { backgroundColor: colors.card },
          headerTintColor: colors.foreground,
        }}
      />
      <Screen>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, gap: 20 }}>
          {/* Model Status Section */}
          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: colors.foreground,
              }}>
              Model Status
            </Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: getModelStatusColor(),
                }}
              />
              <Text
                style={{
                  color: colors.foreground,
                  textTransform: 'capitalize',
                }}>
                {modelStatus}
              </Text>
            </View>

            {modelStatus.includes('downloading') && (
              <ActivityIndicator size='small' color={colors.primary} />
            )}

            {modelStatus === 'error' && (
              <Button
                onPress={initializeModel}
                style={{ backgroundColor: colors.primary }}>
                <Text style={{ color: colors.background }}>
                  Retry Initialize
                </Text>
              </Button>
            )}
          </View>

          {/* Controls Section */}
          <View style={{ gap: 16 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: colors.foreground,
              }}>
              Local AI Controls
            </Text>

            <View style={{ gap: 12 }}>
              <Button
                onPress={handleGenerateText}
                disabled={!isModelReady || streamingStatus === 'generating'}
                style={{
                  backgroundColor: isModelReady ? colors.primary : colors.muted,
                  opacity:
                    !isModelReady || streamingStatus === 'generating' ? 0.6 : 1,
                }}>
                <Text style={{ color: colors.background }}>
                  Generate Text (Non-streaming)
                </Text>
              </Button>

              <Button
                onPress={handleStreamText}
                disabled={!isModelReady || streamingStatus === 'streaming'}
                style={{
                  backgroundColor: isModelReady
                    ? colors.destructive
                    : colors.muted,
                  opacity:
                    !isModelReady || streamingStatus === 'streaming' ? 0.6 : 1,
                }}>
                <Text style={{ color: colors.background }}>
                  Stream Text (Check Console)
                </Text>
              </Button>
            </View>
          </View>

          {/* Streaming Status Section */}
          <View style={{ gap: 12 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: colors.foreground,
              }}>
              Streaming Status
            </Text>
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: getStreamStatusColor(),
                }}
              />
              <Text
                style={{
                  color: colors.foreground,
                  textTransform: 'capitalize',
                }}>
                {streamingStatus}
              </Text>
            </View>

            {(streamingStatus === 'generating' ||
              streamingStatus === 'streaming') && (
              <ActivityIndicator size='small' color={colors.primary} />
            )}
          </View>

          {/* Instructions */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.foreground,
              }}>
              Instructions
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              1. Wait for the model to download and initialize{'\n'}
              2. Use "Generate Text" for single response generation{'\n'}
              3. Use "Stream Text" to see streaming responses in console{'\n'}
              4. Check Metro/Expo console for detailed output and streaming
              chunks
            </Text>
          </View>

          {/* Model Info */}
          <View style={{ gap: 8 }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '600',
                color: colors.foreground,
              }}>
              Model Information
            </Text>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              Model: SmolLM3-3B (Quantized Q4_K_M){'\n'}
              Context: 2048 tokens{'\n'}
              GPU Layers: 99{'\n'}
              Library: @react-native-ai/llama
            </Text>
          </View>
        </ScrollView>
      </Screen>
    </>
  );
}
