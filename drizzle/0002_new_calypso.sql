CREATE TABLE `consultant_daily_budget` (
	`day` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `consultant_demo_cache` (
	`scenario` text PRIMARY KEY NOT NULL,
	`context_hash` text NOT NULL,
	`payload` text NOT NULL,
	`expires_at` integer NOT NULL,
	`lease_id` text NOT NULL,
	`lease_until` integer NOT NULL
);
