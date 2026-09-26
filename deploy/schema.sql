CREATE TABLE IF NOT EXISTS `carts` (
  `id` text PRIMARY KEY NOT NULL,
  `payload` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `orders` (
  `id` text PRIMARY KEY NOT NULL,
  `customer_id` text NOT NULL,
  `payload` text NOT NULL,
  `status` text NOT NULL DEFAULT 'new',
  `created_at` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `products` (
  `id` text PRIMARY KEY NOT NULL,
  `payload` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `admin_login_attempts` (
  `id` text PRIMARY KEY NOT NULL,
  `window` integer NOT NULL,
  `attempts` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `admin_sessions` (
  `token_hash` text PRIMARY KEY NOT NULL,
  `expires_at` integer NOT NULL,
  `credential_version` text NOT NULL
);

CREATE TABLE IF NOT EXISTS `consultant_demo_cache` (
  `scenario` text PRIMARY KEY NOT NULL,
  `context_hash` text NOT NULL,
  `payload` text NOT NULL,
  `expires_at` integer NOT NULL,
  `lease_id` text NOT NULL,
  `lease_until` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `consultant_daily_budget` (
  `day` text PRIMARY KEY NOT NULL,
  `attempts` integer NOT NULL
);
