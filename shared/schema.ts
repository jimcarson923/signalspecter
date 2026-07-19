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

// Watchlist (user-scoped — each user has their own list)
export const watchlistItems = sqliteTable('watchlist_items', {
  id:       integer('id').primaryKey({ autoIncrement: true }),
  userId:   integer('user_id').notNull(),
  symbol:   text('symbol').notNull(),
  addedAt:  integer('added_at').notNull(),
  notes:    text('notes').default(''),
});
export const insertWatchlistItemSchema = createInsertSchema(watchlistItems).omit({ id: true });
export type InsertWatchlistItem = z.infer<typeof insertWatchlistItemSchema>;
export type WatchlistItem = typeof watchlistItems.$inferSelect;

// Saved scans
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

// Trades
export const trades = sqliteTable('trades', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  ticker: text('ticker').notNull(),
  action: text('action').notNull(),
  price: real('price').notNull(),
  shares: real('shares').notNull().default(1),
  sector: text('sector'),
  notes: text('notes'),
  tradedAt: integer('traded_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, tradedAt: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;

// Price & Score Alerts
export const alerts = sqliteTable('alerts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  ticker: text('ticker').notNull(),
  type: text('type').notNull(),
  targetValue: real('target_value').notNull(),
  message: text('message'),
  triggered: integer('triggered', { mode: 'boolean' }).notNull().default(false),
  triggeredAt: integer('triggered_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
export const insertAlertSchema = createInsertSchema(alerts).omit({ id: true, triggered: true, triggeredAt: true, createdAt: true });
export type InsertAlert = z.infer<typeof insertAlertSchema>;
export type Alert = typeof alerts.$inferSelect;

// Push subscriptions (Web Push API)
export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});
export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
