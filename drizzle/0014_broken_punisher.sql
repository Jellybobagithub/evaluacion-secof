CREATE TABLE `actividades_catalogo` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clave` varchar(10) NOT NULL,
	`descripcion` text NOT NULL,
	`categoria` enum('D','S','B','M') NOT NULL,
	`orden` int DEFAULT 0,
	`activa` boolean NOT NULL DEFAULT true,
	CONSTRAINT `actividades_catalogo_id` PRIMARY KEY(`id`),
	CONSTRAINT `actividades_catalogo_clave_unique` UNIQUE(`clave`)
);
--> statement-breakpoint
CREATE TABLE `turno_actividades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`turnoId` int NOT NULL,
	`actividadClave` varchar(10) NOT NULL,
	`completada` boolean NOT NULL DEFAULT false,
	`completadaAt` timestamp,
	`completadaPorId` int,
	`esPendiente` boolean NOT NULL DEFAULT false,
	`turnoOrigenId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `turno_actividades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `turnos_semana` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`empleadoId` int NOT NULL,
	`fecha` varchar(10) NOT NULL,
	`semana` int NOT NULL,
	`anio` int NOT NULL,
	`puesto` varchar(100),
	`turno` enum('matutino','intermedio','vespertino','anfitrion') NOT NULL,
	`horaInicio` varchar(5) NOT NULL,
	`horaFin` varchar(5) NOT NULL,
	`rolPrincipal` varchar(50),
	`comentarios` text,
	`cerrado` boolean NOT NULL DEFAULT false,
	`cerradoAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `turnos_semana_id` PRIMARY KEY(`id`)
);
