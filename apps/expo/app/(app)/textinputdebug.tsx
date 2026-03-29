import { Text, TextInput, View } from 'react-native';

export default function TextInputDebug() {
  return (
    <View className="flex-1 items-center justify-center gap-4">
      <Text className="text-2xl font-bold">TextInput Debug</Text>
      <TextInput
        className="w-64 rounded border border-gray-300 px-4 py-2"
        placeholder="Type something..."
      />
    </View>
  );
}
