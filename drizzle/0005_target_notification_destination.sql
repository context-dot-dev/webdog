ALTER TABLE `target` ADD `notificationDestinationId` text REFERENCES notificationDestination(id) ON DELETE SET NULL;
