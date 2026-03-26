CREATE TABLE `asistencia` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empleadoId` int NOT NULL,
	`sucursalId` int NOT NULL,
	`tipo` enum('entrada','salida') NOT NULL,
	`timestamp` bigint NOT NULL,
	`metodo` enum('qr','manual') NOT NULL DEFAULT 'qr',
	`latitud` float,
	`longitud` float,
	`registradoPorId` int,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asistencia_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_plantillas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`tipo` enum('limpieza','operativo','apertura','cierre') NOT NULL DEFAULT 'operativo',
	`turno` enum('matutino','vespertino','ambos') NOT NULL DEFAULT 'ambos',
	`items` json NOT NULL,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checklist_plantillas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_registros` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plantillaId` int NOT NULL,
	`sucursalId` int NOT NULL,
	`empleadoId` int,
	`liderNombre` varchar(255),
	`fecha` timestamp NOT NULL DEFAULT (now()),
	`turno` enum('matutino','vespertino') NOT NULL DEFAULT 'matutino',
	`itemsCompletados` json NOT NULL,
	`totalItems` int DEFAULT 0,
	`itemsOk` int DEFAULT 0,
	`porcentaje` float DEFAULT 0,
	`observaciones` text,
	`firmado` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checklist_registros_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `empleados` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`apellido` varchar(255),
	`rol` enum('anfitrion','lider','administrador') NOT NULL DEFAULT 'anfitrion',
	`telefono` varchar(30),
	`fechaIngreso` timestamp NOT NULL DEFAULT (now()),
	`fechaBaja` timestamp,
	`activo` boolean NOT NULL DEFAULT true,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `empleados_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `observaciones_kpi` (
	`id` int AUTO_INCREMENT NOT NULL,
	`empleadoId` int NOT NULL,
	`sucursalId` int NOT NULL,
	`observadorId` int NOT NULL,
	`tipo` enum('servicio','preparacion','caja') NOT NULL,
	`detalle` json NOT NULL,
	`cumple` boolean NOT NULL,
	`semana` varchar(10) NOT NULL,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `observaciones_kpi_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sucursales` ADD `qrToken` varchar(64);