CREATE TABLE `notificationDestination` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL,
	`channel` text NOT NULL,
	`name` text NOT NULL,
	`slackWebhookUrl` text,
	`resendFromEmail` text,
	`resendToEmails` text,
	`alertWebhookUrl` text,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notification_destination_user_idx` ON `notificationDestination` (`userId`);
--> statement-breakpoint
ALTER TABLE `website` ADD `notificationDestinationIds` text;
--> statement-breakpoint
INSERT INTO `notificationDestination` (`id`, `userId`, `channel`, `name`, `slackWebhookUrl`, `resendFromEmail`, `resendToEmails`, `alertWebhookUrl`, `createdAt`, `updatedAt`)
SELECT 'mig_slk_' || lower(hex(randomblob(8))), `userId`, 'SLACK', 'Slack', trim(`slackWebhookUrl`), NULL, NULL, NULL, (unixepoch() * 1000), (unixepoch() * 1000)
FROM `userNotificationSettings`
WHERE `slackWebhookUrl` IS NOT NULL AND length(trim(`slackWebhookUrl`)) > 0;
--> statement-breakpoint
INSERT INTO `notificationDestination` (`id`, `userId`, `channel`, `name`, `slackWebhookUrl`, `resendFromEmail`, `resendToEmails`, `alertWebhookUrl`, `createdAt`, `updatedAt`)
SELECT 'mig_em_' || lower(hex(randomblob(8))), `userId`, 'EMAIL', 'Email', NULL, trim(`resendFromEmail`), trim(`resendToEmails`), NULL, (unixepoch() * 1000), (unixepoch() * 1000)
FROM `userNotificationSettings`
WHERE `resendFromEmail` IS NOT NULL AND length(trim(`resendFromEmail`)) > 0
  AND `resendToEmails` IS NOT NULL AND length(trim(`resendToEmails`)) > 0;
--> statement-breakpoint
INSERT INTO `notificationDestination` (`id`, `userId`, `channel`, `name`, `slackWebhookUrl`, `resendFromEmail`, `resendToEmails`, `alertWebhookUrl`, `createdAt`, `updatedAt`)
SELECT 'mig_wh_' || lower(hex(randomblob(8))), `userId`, 'WEBHOOK', 'Webhook', NULL, NULL, NULL, trim(`alertWebhookUrl`), (unixepoch() * 1000), (unixepoch() * 1000)
FROM `userNotificationSettings`
WHERE `alertWebhookUrl` IS NOT NULL AND length(trim(`alertWebhookUrl`)) > 0;
--> statement-breakpoint
ALTER TABLE `userNotificationSettings` DROP COLUMN `slackWebhookUrl`;
--> statement-breakpoint
ALTER TABLE `userNotificationSettings` DROP COLUMN `resendFromEmail`;
--> statement-breakpoint
ALTER TABLE `userNotificationSettings` DROP COLUMN `resendToEmails`;
--> statement-breakpoint
ALTER TABLE `userNotificationSettings` DROP COLUMN `alertWebhookUrl`;
