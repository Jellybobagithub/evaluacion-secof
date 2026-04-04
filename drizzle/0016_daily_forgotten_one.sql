ALTER TABLE `empleados` ADD `tipoContrato` enum('fulltime','finde_ext','finde','custom') DEFAULT 'fulltime' NOT NULL;--> statement-breakpoint
ALTER TABLE `empleados` ADD `diasDisponibles` text;