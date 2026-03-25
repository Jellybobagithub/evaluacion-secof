CREATE TABLE `user_sucursales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sucursalId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_sucursales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','superadmin','owner','manager','leader','host') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `activo` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `notas` text;