CREATE TABLE `menu_permisos_extra` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`menuItemId` varchar(60) NOT NULL,
	`otorgadoPor` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `menu_permisos_extra_id` PRIMARY KEY(`id`)
);
