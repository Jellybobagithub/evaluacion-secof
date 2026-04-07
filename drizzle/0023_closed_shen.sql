CREATE TABLE `inv_categoria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nombre` varchar(80) NOT NULL,
	`descripcion` text,
	`color` varchar(20) DEFAULT '#6b7280',
	`orden` int NOT NULL DEFAULT 0,
	`activa` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inv_categoria_id` PRIMARY KEY(`id`)
);
