import { Icon } from "@roninoss/icons";
import { Stack, usePathname, useRouter } from "expo-router";
import { Image, SafeAreaView, View } from "react-native";
import { Button } from "nativewindui/Button";
import { Text } from "nativewindui/Text";

const LOGO_SOURCE = require("~/assets/packrat-app-icon-gradient.png");

export function WeatherAuthWall() {
	const router = useRouter();
	const currentRoute = usePathname();

	return (
		<SafeAreaView className="flex-1 bg-background">
			<Stack.Screen options={{ headerShown: false }} />
			<View className="flex-1 px-6 py-8">
				<View className="mb-8 items-center justify-center">
					<View className="bg-primary/10 mb-4 rounded-full p-6">
						<Image
							source={LOGO_SOURCE}
							className="h-12 w-12 rounded-md"
							resizeMode="contain"
						/>
					</View>
					<Text variant="title1" className="text-center">
						Weather Features Require Sign In
					</Text>
				</View>

				<View className="mb-10 flex-col gap-6">
					<FeatureItem
						icon="weather-sunny"
						title="Weather Forecasts"
						description="Get detailed weather information"
					/>
					<FeatureItem
						icon="umbrella-outline"
						title="Weather Alerts"
						description="Stay informed about weather changes"
					/>
					<FeatureItem
						icon="archive-outline"
						title="Packing Suggestions"
						description="Weather-based packing recommendations"
					/>
				</View>

				<Button
					onPress={() =>
						router.push({
							pathname: "/auth",
							params: { redirectTo: currentRoute },
						})
					}
					size="lg"
					variant="primary"
					className="mb-4 w-full"
				>
					<Text className="font-medium">Sign In</Text>
				</Button>
			</View>
		</SafeAreaView>
	);
}

function FeatureItem({
	icon,
	title,
	description,
}: {
	icon: string;
	title: string;
	description: string;
}) {
	return (
		<View className="flex-row items-center">
			<View className="bg-primary/10 mr-4 h-10 w-10 items-center justify-center rounded-full">
				<Icon name={icon} size={20} color="primary" />
			</View>
			<View className="flex-1">
				<Text variant="title3" className="mb-0.5">
					{title}
				</Text>
				<Text className="text-muted-foreground">{description}</Text>
			</View>
		</View>
	);
}
