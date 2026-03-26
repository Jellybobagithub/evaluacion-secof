CREATE TABLE `horarios_semanales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`empleadoId` int NOT NULL,
	`semana` varchar(10) NOT NULL,
	`lunes` varchar(4),
	`martes` varchar(4),
	`miercoles` varchar(4),
	`jueves` varchar(4),
	`viernes` varchar(4),
	`sabado` varchar(4),
	`domingo` varchar(4),
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `horarios_semanales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reportes_diarios` ADD `mermasMonto` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `reportes_diarios` ADD `mermasDetalle` text;