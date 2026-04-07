CREATE TABLE `inv_almacenes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`nombre` varchar(80) NOT NULL,
	`tipo` enum('piezas','piezas_gramos') NOT NULL DEFAULT 'piezas',
	`consideraMinMax` boolean NOT NULL DEFAULT false,
	`activo` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inv_almacenes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inv_conteo_detalle` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conteoId` int NOT NULL,
	`productoId` int NOT NULL,
	`cantidadPiezas` float NOT NULL DEFAULT 0,
	`cantidadGramos` float DEFAULT 0,
	`notas` text,
	CONSTRAINT `inv_conteo_detalle_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inv_conteo_fisico` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`almacenId` int NOT NULL,
	`semana` varchar(10) NOT NULL,
	`fechaConteo` varchar(10) NOT NULL,
	`liderId` int NOT NULL,
	`anfitrionId` int,
	`estado` enum('borrador','enviado','bloqueado') NOT NULL DEFAULT 'borrador',
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inv_conteo_fisico_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inv_min_max` (
	`id` int AUTO_INCREMENT NOT NULL,
	`almacenId` int NOT NULL,
	`productoId` int NOT NULL,
	`stockMinimo` float NOT NULL DEFAULT 0,
	`stockMaximo` float NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inv_min_max_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inv_productos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(120) NOT NULL,
	`categoria` varchar(80) NOT NULL DEFAULT 'General',
	`unidadCompra` varchar(40) NOT NULL DEFAULT 'pieza',
	`unidadConteo` varchar(40) NOT NULL DEFAULT 'pieza',
	`factorConversion` float DEFAULT 1,
	`pesoNetoPorUnidad` float,
	`puedeAbrirse` boolean NOT NULL DEFAULT false,
	`activo` boolean NOT NULL DEFAULT true,
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inv_productos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inv_teorico` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sucursalId` int NOT NULL,
	`almacenId` int NOT NULL,
	`semana` varchar(10) NOT NULL,
	`supervisorId` int NOT NULL,
	`estado` enum('borrador','publicado') NOT NULL DEFAULT 'borrador',
	`notas` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inv_teorico_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inv_teorico_detalle` (
	`id` int AUTO_INCREMENT NOT NULL,
	`teoricoId` int NOT NULL,
	`productoId` int NOT NULL,
	`cantidadEsperada` float NOT NULL DEFAULT 0,
	`notas` text,
	CONSTRAINT `inv_teorico_detalle_id` PRIMARY KEY(`id`)
);
