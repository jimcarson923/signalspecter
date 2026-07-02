import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

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
  type: text('type').notNull(), // 'bullish' | 'bearish'
  filters: text('filters').notNull(), // JSON string
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const insertSavedScanSchema = createInsertSchema(savedScans).omit({ id: true, createdAt: true });
export type InsertSavedScan = z.infer<typeof insertSavedScanSchema>;
export type SavedScan = typeof savedScans.$inferSelect;
