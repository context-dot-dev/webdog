CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"accessTokenExpiresAt" timestamp (3) with time zone,
	"refreshTokenExpiresAt" timestamp (3) with time zone,
	"scope" text,
	"password" text,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accountInvite" (
	"id" text PRIMARY KEY NOT NULL,
	"ownerUserId" text NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp (3) with time zone NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"createdByUserId" text NOT NULL,
	"organizationLabel" text,
	"maxUses" integer DEFAULT 5 NOT NULL,
	"useCount" integer DEFAULT 0 NOT NULL,
	"redeemedAt" timestamp (3) with time zone,
	"redeemedByUserId" text,
	CONSTRAINT "accountInvite_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "accountMembership" (
	"ownerUserId" text NOT NULL,
	"memberUserId" text NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accountMembership_ownerUserId_memberUserId_pk" PRIMARY KEY("ownerUserId","memberUserId")
);
--> statement-breakpoint
CREATE TABLE "alert" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"targetId" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"details" text NOT NULL,
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificationDestination" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"channel" text NOT NULL,
	"name" text NOT NULL,
	"slackWebhookUrl" text,
	"resendFromEmail" text,
	"resendToEmails" text,
	"alertWebhookUrl" text,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updatedAt" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp (3) with time zone NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"kind" text NOT NULL,
	"targetUrl" text,
	"payload" text NOT NULL,
	"hash" text NOT NULL,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target" (
	"id" text PRIMARY KEY NOT NULL,
	"websiteId" text NOT NULL,
	"kind" text NOT NULL,
	"linkScope" text,
	"pageUrl" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"checkIntervalHours" double precision DEFAULT 1 NOT NULL,
	"nextCheckDueAt" timestamp (3) with time zone,
	"lastCheckedAt" timestamp (3) with time zone,
	"externalNotify" boolean DEFAULT true NOT NULL,
	"notificationDestinationId" text,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"contextIntroDismissedAt" timestamp (3) with time zone,
	"createdAt" timestamp (3) with time zone NOT NULL,
	"updatedAt" timestamp (3) with time zone NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "userNotificationSettings" (
	"userId" text PRIMARY KEY NOT NULL,
	"contextDevApiKey" text,
	"accountBrandLogoUrl" text,
	"resendApiKey" text,
	"updatedAt" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp (3) with time zone NOT NULL,
	"createdAt" timestamp (3) with time zone,
	"updatedAt" timestamp (3) with time zone
);
--> statement-breakpoint
CREATE TABLE "website" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"domain" text NOT NULL,
	"title" text,
	"description" text,
	"logoUrl" text,
	"heroScreenshotUrl" text,
	"backdropUrl" text,
	"notificationDestinationIds" text,
	"createdAt" timestamp (3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountInvite" ADD CONSTRAINT "accountInvite_ownerUserId_user_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountInvite" ADD CONSTRAINT "accountInvite_createdByUserId_user_id_fk" FOREIGN KEY ("createdByUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountInvite" ADD CONSTRAINT "accountInvite_redeemedByUserId_user_id_fk" FOREIGN KEY ("redeemedByUserId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountMembership" ADD CONSTRAINT "accountMembership_ownerUserId_user_id_fk" FOREIGN KEY ("ownerUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accountMembership" ADD CONSTRAINT "accountMembership_memberUserId_user_id_fk" FOREIGN KEY ("memberUserId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert" ADD CONSTRAINT "alert_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert" ADD CONSTRAINT "alert_targetId_target_id_fk" FOREIGN KEY ("targetId") REFERENCES "public"."target"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificationDestination" ADD CONSTRAINT "notificationDestination_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot" ADD CONSTRAINT "snapshot_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target" ADD CONSTRAINT "target_websiteId_website_id_fk" FOREIGN KEY ("websiteId") REFERENCES "public"."website"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target" ADD CONSTRAINT "target_notificationDestinationId_notificationDestination_id_fk" FOREIGN KEY ("notificationDestinationId") REFERENCES "public"."notificationDestination"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userNotificationSettings" ADD CONSTRAINT "userNotificationSettings_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "website" ADD CONSTRAINT "website_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_invite_owner_idx" ON "accountInvite" USING btree ("ownerUserId");--> statement-breakpoint
CREATE INDEX "account_invite_expires_idx" ON "accountInvite" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "account_membership_member_idx" ON "accountMembership" USING btree ("memberUserId");--> statement-breakpoint
CREATE INDEX "alert_website_idx" ON "alert" USING btree ("websiteId","createdAt");--> statement-breakpoint
CREATE INDEX "alert_target_idx" ON "alert" USING btree ("targetId");--> statement-breakpoint
CREATE INDEX "notification_destination_user_idx" ON "notificationDestination" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "snapshot_lookup_idx" ON "snapshot" USING btree ("websiteId","kind","targetUrl","createdAt");--> statement-breakpoint
CREATE INDEX "target_website_idx" ON "target" USING btree ("websiteId");--> statement-breakpoint
CREATE INDEX "website_user_idx" ON "website" USING btree ("userId");