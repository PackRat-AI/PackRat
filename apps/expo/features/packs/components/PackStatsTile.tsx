import { Alert } from "@packrat/ui/nativewindui/Alert";
import type { AlertRef } from "@packrat/ui/nativewindui/Alert/types";
import { ListItem } from "@packrat/ui/nativewindui/List";
import { Icon } from "@roninoss/icons";
import { useColorScheme } from "expo-app/lib/hooks/useColorScheme";
import { type Href, useRouter } from "expo-router";
import { useRef } from "react";
import { View } from "react-native";
import { usePacks } from "../hooks";

export function PackStatsTile() {
  const router = useRouter();

  const packs = usePacks();
  const currentPack = packs[0];

  const alertRef = useRef<AlertRef>(null);

  const route: Href | null = currentPack
    ? `/pack-stats/${currentPack.id}`
    : null;

  const handlePress = () => {
    if (!currentPack) {
      alertRef.current?.show();
      return;
    }
    router.push(route!);
  };

  return (
    <>
      <ListItem
        className="ios:pl-0 pl-2"
        titleClassName="text-lg"
        leftView={
          <View className="px-3">
            <View className="h-6 w-6 items-center justify-center rounded-md bg-blue-500">
              <Icon name="chart-pie" size={15} color="white" />
            </View>
          </View>
        }
        rightView={
          <View className="flex-1 flex-row items-center justify-center gap-2 px-4">
            <ChevronRight />
          </View>
        }
        item={{
          title: "Pack Stats",
        }}
        onPress={handlePress}
        target="Cell"
        index={0}
      />
      <Alert
        title="No Packs Yet"
        message="Create a pack to start tracking stats."
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
