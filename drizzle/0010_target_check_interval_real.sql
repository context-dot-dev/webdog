PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `target_new` (
	`id` text PRIMARY KEY NOT NULL,
	`websiteId` text NOT NULL,
	`kind` text NOT NULL,
	`linkScope` text,
	`pageUrl` text,
	`enabled` integer DEFAULT true NOT NULL,
	`checkIntervalHours` real DEFAULT 1 NOT NULL,
	`nextCheckDueAt` integer,
	`lastCheckedAt` integer,
	`externalNotify` integer DEFAULT 1 NOT NULL,
	`notificationDestinationId` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`websiteId`) REFERENCES `website`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`notificationDestinationId`) REFERENCES `notificationDestination`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `target_new` (`id`, `websiteId`, `kind`, `linkScope`, `pageUrl`, `enabled`, `checkIntervalHours`, `nextCheckDueAt`, `lastCheckedAt`, `externalNotify`, `notificationDestinationId`, `createdAt`)
SELECT `id`, `websiteId`, `kind`, `linkScope`, `pageUrl`, `enabled`, CAST(`checkIntervalHours` AS REAL), `nextCheckDueAt`, `lastCheckedAt`, `externalNotify`, `notificationDestinationId`, `createdAt` FROM `target`;
--> statement-breakpoint
DROP TABLE `target`;
--> statement-breakpoint
ALTER TABLE `target_new` RENAME TO `target`;
--> statement-breakpoint
CREATE INDEX `target_website_idx` ON `target` (`websiteId`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;
