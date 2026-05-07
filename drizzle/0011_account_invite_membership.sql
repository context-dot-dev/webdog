CREATE TABLE `accountMembership` (
	`ownerUserId` text NOT NULL,
	`memberUserId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	PRIMARY KEY(`ownerUserId`, `memberUserId`),
	FOREIGN KEY (`ownerUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`memberUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_membership_member_idx` ON `accountMembership` (`memberUserId`);
--> statement-breakpoint
CREATE TABLE `accountInvite` (
	`id` text PRIMARY KEY NOT NULL,
	`ownerUserId` text NOT NULL,
	`tokenHash` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	`createdByUserId` text NOT NULL,
	`redeemedAt` integer,
	`redeemedByUserId` text,
	FOREIGN KEY (`ownerUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`createdByUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`redeemedByUserId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accountInvite_tokenHash_unique` ON `accountInvite` (`tokenHash`);
--> statement-breakpoint
CREATE INDEX `account_invite_owner_idx` ON `accountInvite` (`ownerUserId`);
--> statement-breakpoint
CREATE INDEX `account_invite_expires_idx` ON `accountInvite` (`expiresAt`);
