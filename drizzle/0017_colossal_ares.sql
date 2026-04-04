CREATE TABLE `actividades_observacion` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`actividadClave` varchar(10) NOT NULL,
	`activadaPorId` int NOT NULL,
	`activadaAt` timestamp NOT NULL DEFAULT (now()),
	`motivoActivacion` text,
	`activa` boolean NOT NULL DEFAULT true,
	`resueltaPorId` int,
	`resueltaAt` timestamp,
	`notaResolucion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `actividades_observacion_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `preparaciones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`turnoId` int,
	`empleadoId` int,
	`registradoPorId` int,
	`receta` enum('tapioca','base_snowtea','jarabe_longan','sustituto_azucar') NOT NULL,
	`cantidad` varchar(20) NOT NULL,
	`unidad` varchar(30) NOT NULL,
	`preparadaAt` timestamp NOT NULL,
	`venceAt` timestamp NOT NULL,
	`estado_prep` enum('activa','vencida','consumida') NOT NULL DEFAULT 'activa',
	`incidencia_tipo` enum('sin_preparacion','vencida_en_uso','fuera_de_tiempo','desperdicio'),
	`incidenciaAt` timestamp,
	`incidenciaNota` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `preparaciones_id` PRIMARY KEY(`id`)
);
