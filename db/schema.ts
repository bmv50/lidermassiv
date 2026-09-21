// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const products=sqliteTable('products',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const carts=sqliteTable('carts',{id:text('id').primaryKey(),payload:text('payload').notNull()});
export const orders=sqliteTable('orders',{id:text('id').primaryKey(),customerId:text('customer_id').notNull(),payload:text('payload').notNull(),status:text('status').notNull().default('new'),createdAt:text('created_at').notNull()});
