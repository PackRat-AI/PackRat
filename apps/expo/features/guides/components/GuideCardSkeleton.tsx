import { View } from 'react-native';

/**
 * Placeholder with the same box model as `GuideCard` (padding, gaps and line heights), so the
 * list does not move when real cards replace it.
 */
export function GuideCardSkeleton() {
  return (
    <View
      className="mb-3 rounded-xl bg-card"
      style={{ elevation: 1 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View className="gap-1 p-4">
        <Bar className="h-4 w-1/3" />
        <Bar className="h-6 w-4/5" />
        <Bar className="h-5 w-full" />
        <Bar className="h-5 w-2/3" />
        <Bar className="mt-1 h-4 w-2/5" />
      </View>
    </View>
  );
}

// Bars are inset inside their line box so a stack of them reads as text, not as one block.
function Bar({ className }: { className: string }) {
  return (
    <View className={`justify-center ${className}`}>
      <View className="h-3/5 rounded bg-border" />
    </View>
  );
}
