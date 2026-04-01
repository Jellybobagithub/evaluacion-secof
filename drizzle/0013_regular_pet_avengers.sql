CREATE TABLE `gastos_operativos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`anio` int NOT NULL,
	`mes` int NOT NULL,
	`renta` float DEFAULT 0,
	`nomina` float DEFAULT 0,
	`insumos` float DEFAULT 0,
	`servicios` float DEFAULT 0,
	`mantenimiento` float DEFAULT 0,
	`marketing` float DEFAULT 0,
	`otros` float DEFAULT 0,
	`totalGastos` float DEFAULT 0,
	`costoProducto` float DEFAULT 0,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gastos_operativos_id` PRIMARY KEY(`id`)
);
