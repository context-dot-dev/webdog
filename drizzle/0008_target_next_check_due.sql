ALTER TABLE `target` ADD COLUMN `nextCheckDueAt` integer;
--> statement-breakpoint
UPDATE `target` SET `nextCheckDueAt` = `lastCheckedAt` + `checkIntervalHours` * 3600000 WHERE `lastCheckedAt` IS NOT NULL;
