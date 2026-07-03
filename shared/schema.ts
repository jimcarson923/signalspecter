import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  plan: text('plan').notNull().default('free'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, passwordHash: true }).extend({
  password: z.string().min(8, 'Password must be at least 8 characters'),
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Watchlist entries
export const watchlistItems = sqliteTable('watchlist_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  symbol: text('symbol').notNull(),
  companyName: text('company_name').notNull(),
  notes: text('notes'),
  alertPrice: real('alert_price'),
});
export const insertWatchlistItemSchema = createInsertSchema(watchlistItems).omit({ id: true });
export type InsertWatchlistItem = z.infer<typeof insertWatchlistItemSchema>;
export type WatchlistItem = typeof watchlistItems.$inferSelect;

// Saved scans / strategies
export const savedScans = sqliteTable('saved_scans', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  filters: text('filters').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
export const insertSavedScanSchema = createInsertSchema(savedScans).omit({ id: true, createdAt: true });
export type InsertSavedScan = z.infer<typeof insertSavedScanSchema>;
export type SavedScan = typeof savedScans.$inferSelect;

// Trade history — persisted per user for style learning
export const trades = sqliteTable('trades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  ticker: text('ticker').notNull(),
  action: text('action').notNull(),       // 'buy' | 'sell'
  price: real('price').notNull(),
  shares: real('shares').notNull().default(1),
  sector: text('sector'),
  notes: text('notes'),
  tradedAt: integer('traded_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, tradedAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;
