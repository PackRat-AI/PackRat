import { cn } from "@packrat-ai/nativewindui";
import { useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export function ExpandableText({
  text,
  numberOfLines = 2,
}: {
  text: string;
  numberOfLines?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const MIN_WIDTH = 60;
  const expandThreshold = 60;

  return (
    <View
      className={cn(
        `flex-row flex-wrap items-center bg-transparent px-2 py-1 min-w-[${MIN_WIDTH}px] my-1`
      )}
    >
      <Text
        className="text-foreground text-sm flex-shrink"
        numberOfLines={expanded ? undefined : numberOfLines}
      >
        {text}
      </Text>
      {text.length > expandThreshold && (
        <TouchableOpacity onPress={() => setExpanded((v) => !v)}>
          <Text className="text-primary ml-2 text-sm font-medium">
            {expanded ? "Show less" : "Show more"}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
