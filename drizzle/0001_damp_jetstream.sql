CREATE TABLE `evaluaciones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`evaluadorId` int,
	`evaluadorNombre` varchar(255),
	`fecha` timestamp NOT NULL DEFAULT (now()),
	`estado` enum('borrador','completada') NOT NULL DEFAULT 'borrador',
	`puntosObtenidos` float DEFAULT 0,
	`puntosMaximos` float DEFAULT 0,
	`porcentajeGeneral` float DEFAULT 0,
	`calificacion` varchar(64),
	`puntuacionPorCategoria` json,
	`puntuacionPorSeccion` json,
	`observacionesGenerales` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `evaluaciones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plan_accion` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evaluacionId` int NOT NULL,
	`sucursalId` int NOT NULL,
	`area` varchar(255) NOT NULL,
	`queMalEsta` text,
	`objetivo` text,
	`causaRaiz` text,
	`comoResolver` text,
	`fechaCompromiso` timestamp,
	`costo` float DEFAULT 0,
	`responsable` varchar(255),
	`revisor` varchar(255),
	`estado` enum('pendiente','en_proceso','completado') NOT NULL DEFAULT 'pendiente',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `plan_accion_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `respuestas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`evaluacionId` int NOT NULL,
	`puntoId` varchar(20) NOT NULL,
	`respuesta` enum('si','no','na') NOT NULL,
	`puntosObtenidos` float DEFAULT 0,
	`observacion` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `respuestas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sucursales` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(255) NOT NULL,
	`ciudad` varchar(255),
	`estado` varchar(255),
	`direccion` text,
	`franquiciado` varchar(255),
	`activa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sucursales_id` PRIMARY KEY(`id`)
);
