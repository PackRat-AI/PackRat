ALTER TABLE "notification_preferences" ADD COLUMN "trip_weather" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "weather_alerts" boolean DEFAULT true NOT NULL;