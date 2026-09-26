// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const products=sqliteTable('products',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const carts=sqliteTable('carts',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const adminSessions=sqliteTable('admin_sessions',{tokenHash:text('token_hash').primaryKey(),expiresAt:integer('expires_at').notNull(),credentialVersion:text('credential_version').notNull()});
export const adminLoginAttempts=sqliteTable('admin_login_attempts',{id:text('id').primaryKey(),window:integer('window').notNull(),attempts:integer('attempts').notNull()});
export const orders=sqliteTable('orders',{id:text('id').primaryKey(),customerId:text('customer_id').notNull(),payload:text('payload').notNull(),status:text('status').notNull().default('new'),createdAt:text('created_at').notNull()});
export const consultantDemoCache=sqliteTable('consultant_demo_cache',{
  scenario:text('scenario').primaryKey(),contextHash:text('context_hash').notNull(),payload:text('payload').notNull(),
  expiresAt:integer('expires_at').notNull(),leaseId:text('lease_id').notNull(),leaseUntil:integer('lease_until').notNull(),
});
export const consultantDailyBudget=sqliteTable('consultant_daily_budget',{
  day:text('day').primaryKey(),attempts:integer('attempts').notNull(),
});
