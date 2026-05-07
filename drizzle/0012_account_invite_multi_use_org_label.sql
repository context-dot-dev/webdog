ALTER TABLE `accountInvite` ADD COLUMN `organizationLabel` text;
--> statement-breakpoint
ALTER TABLE `accountInvite` ADD COLUMN `maxUses` integer DEFAULT 5 NOT NULL;
--> statement-breakpoint
ALTER TABLE `accountInvite` ADD COLUMN `useCount` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `accountInvite` SET `maxUses` = 1, `useCount` = 1 WHERE `redeemedAt` IS NOT NULL;
--> statement-breakpoint
UPDATE `accountInvite` SET `maxUses` = 5, `useCount` = 0 WHERE `redeemedAt` IS NULL;
