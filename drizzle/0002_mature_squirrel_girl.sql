CREATE TABLE `puntos_evaluacion` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`seccionNumero` int NOT NULL,
	`seccionNombre` varchar(255) NOT NULL,
	`categoria` varchar(100) NOT NULL,
	`descripcion` text NOT NULL,
	`criterio` text,
	`valor` float NOT NULL DEFAULT 5,
	`orden` int NOT NULL DEFAULT 0,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `puntos_evaluacion_id` PRIMARY KEY(`id`)
);
