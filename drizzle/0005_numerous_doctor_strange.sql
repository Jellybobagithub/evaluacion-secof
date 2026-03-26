CREATE TABLE `reportes_diarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`usuarioNombre` varchar(255),
	`fecha` timestamp NOT NULL DEFAULT (now()),
	`ventasTotales` float DEFAULT 0,
	`transacciones` int DEFAULT 0,
	`ticketPromedio` float DEFAULT 0,
	`apertura` varchar(10),
	`cierre` varchar(10),
	`personalPresente` int DEFAULT 0,
	`incidentes` text,
	`novedades` text,
	`observaciones` text,
	`estado` enum('borrador','enviado') NOT NULL DEFAULT 'borrador',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reportes_diarios_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','superadmin','owner','manager','leader','host') NOT NULL DEFAULT 'user';