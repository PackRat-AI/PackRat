import { Alert } from "@packrat/ui/nativewindui/Alert";
import type { AlertRef } from "@packrat/ui/nativewindui/Alert/types";
import { ListItem } from "@packrat/ui/nativewindui/List";
import { Text } from "@packrat/ui/nativewindui/Text";
import { Icon } from "@roninoss/icons";
import { useColorScheme } from "expo-app/lib/hooks/useColorScheme";
import { useRouter } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { useCategoriesCount, useCurrentPack } from "../hooks";

export function PackCategoriesTile() {
  const currentPack = useCurrentPack();
  const categoriesCount = useCategoriesCount();

  const router = useRouter();

  const alertRef = useRef<AlertRef>(null);

  const handlePress = () => {
    if (!currentPack) return alertRef.current?.show();
    router.push(`/pack-categories/${currentPack.id}`);
  };

  return (
    <>
      <ListItem
        className={"ios:pl-0 pl-2"}
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-green-500">
              <Icon name="puzzle" size={15} color="white" />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
              <Text
                variant="footnote"
                className="font-bold leading-4 text-primary-foreground"
              >
                {categoriesCount}
              </Text>
            </View>
            <ChevronRight />
          </View>
        }
        item={{
          title: "Pack Categories",
        }}
        onPress={handlePress}
        target="Cell"
        index={0}
      />
      <Alert
        title="No Packs Yet"
        message="Create a pack to see gear distribution by category."
        materialIcon={{ name: "information-outline" }}
        materialWidth={370}
        buttons={[
          {
            text: "Got it",
            style: "default",
          },
        ]}
        ref={alertRef}
      />
    </>
  );
}

function ChevronRight() {
  const { colors } = useColorScheme();
  return <Icon name="chevron-right" size={17} color={colors.grey} />;
}
