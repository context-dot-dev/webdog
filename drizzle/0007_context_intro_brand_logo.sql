ALTER TABLE `user` ADD `contextIntroDismissedAt` integer;
--> statement-breakpoint
UPDATE `user` SET `contextIntroDismissedAt` = (unixepoch() * 1000) WHERE `contextIntroDismissedAt` IS NULL;
--> statement-breakpoint
ALTER TABLE `userNotificationSettings` ADD `accountBrandLogoUrl` text;
