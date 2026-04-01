CREATE TABLE `ventas_historicas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`anio` int NOT NULL,
	`mes` int NOT NULL,
	`ventasEfectivo` float DEFAULT 0,
	`ventasTarjeta` float DEFAULT 0,
	`ventasRappi` float DEFAULT 0,
	`ventasTotales` float DEFAULT 0,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ventas_historicas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reportes_diarios` ADD `ventasEfectivo` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `reportes_diarios` ADD `ventasTarjeta` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `reportes_diarios` ADD `ventasRappi` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `reportes_diarios` DROP COLUMN `transacciones`;--> statement-breakpoint
ALTER TABLE `reportes_diarios` DROP COLUMN `ticketPromedio`;