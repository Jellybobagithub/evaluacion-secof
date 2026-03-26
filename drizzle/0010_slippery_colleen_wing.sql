CREATE TABLE `bajas_empleados` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empleadoId` int NOT NULL,
	`sucursalId` int NOT NULL,
	`fechaBaja` timestamp NOT NULL DEFAULT (now()),
	`tipo` enum('renuncia','despido','termino_contrato','otro') NOT NULL DEFAULT 'renuncia',
	`motivo` text,
	`registradoPorId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bajas_empleados_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reportes_diarios` ADD `efectivoInicial` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `reportes_diarios` ADD `efectivoFinal` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `reportes_diarios` ADD `diferenciaCaja` float DEFAULT 0;--> statement-breakpoint
ALTER TABLE `reportes_diarios` ADD `notasCaja` text;