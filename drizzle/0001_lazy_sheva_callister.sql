ALTER TABLE "target" ADD COLUMN "aiChangeSummaryEnabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "userNotificationSettings" ADD COLUMN "aiProvider" text;--> statement-breakpoint
ALTER TABLE "userNotificationSettings" ADD COLUMN "openaiApiKey" text;--> statement-breakpoint
ALTER TABLE "userNotificationSettings" ADD COLUMN "vercelAiGatewayApiKey" text;--> statement-breakpoint
ALTER TABLE "userNotificationSettings" ADD COLUMN "aiModel" text;