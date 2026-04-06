CREATE TABLE `avisos_generales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int,
	`titulo` varchar(255) NOT NULL,
	`contenido` text NOT NULL,
	`tipo` enum('info','urgente','recordatorio') NOT NULL DEFAULT 'info',
	`activo` boolean NOT NULL DEFAULT true,
	`creadoPorId` int NOT NULL,
	`fechaExpiracion` varchar(10),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `avisos_generales_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `turno_apertura` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`empleadoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`fecha` varchar(10) NOT NULL,
	`tipoTurno` enum('matutino','vespertino') NOT NULL,
	`timestamp` bigint NOT NULL,
	`conteoVasos` int,
	`conteoPopotes` int,
	`baseSnowteaKg` float,
	`longanKg` float,
	`fotoSelladoUrl` text,
	`contadorSelladora` int,
	`fotoUniformeUrl` text,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `turno_apertura_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `turno_cierre` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`empleadoId` int NOT NULL,
	`usuarioId` int NOT NULL,
	`fecha` varchar(10) NOT NULL,
	`tipoTurno` enum('matutino','vespertino') NOT NULL,
	`timestamp` bigint NOT NULL,
	`conteoVasosFinal` int,
	`conteoPopotesFinal` int,
	`fotoSelladoCierreUrl` text,
	`contadorSelladoraCierre` int,
	`vasosVendidosSelladora` int,
	`vasosVendidosReporte` int,
	`mermaVasos` int,
	`novedadesTurno` text,
	`incidencias` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `turno_cierre_id` PRIMARY KEY(`id`)
);
