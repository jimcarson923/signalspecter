import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { watchlistItems, savedScans, type WatchlistItem, type InsertWatchlistItem, type SavedScan, type InsertSavedScan } from '@shared/schema';
import { eq } from 'drizzle-orm';

const sqlite = new Database('data.db');
export const db = drizzle(sqlite);

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS watchlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    symbol TEXT NOT NULL,
    company_name TEXT NOT NULL,
    notes TEXT,
    alert_price REAL
  );
  CREATE TABLE IF NOT EXISTS saved_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    filters TEXT NOT NULL,
    created_at INTEGER
  );
`);

export interface IStorage {
  getWatchlist(): WatchlistItem[];
  addWatchlistItem(item: InsertWatchlistItem): WatchlistItem;
  removeWatchlistItem(id: number): void;
  getSavedScans(): SavedScan[];
  saveScan(scan: InsertSavedScan): SavedScan;
  deleteScan(id: number): void;
}

export class Storage implements IStorage {
  getWatchlist(): WatchlistItem[] {
    return db.select().from(watchlistItems).all();
  }

  addWatchlistItem(item: InsertWatchlistItem): WatchlistItem {
    return db.insert(watchlistItems).values(item).returning().get();
  }

  removeWatchlistItem(id: number): void {
    db.delete(watchlistItems).where(eq(watchlistItems.id, id)).run();
  }

  getSavedScans(): SavedScan[] {
    return db.select().from(savedScans).all();
  }

  saveScan(scan: InsertSavedScan): SavedScan {
    return db.insert(savedScans).values({ ...scan, createdAt: new Date() }).returning().get();
  }

  deleteScan(id: number): void {
    db.delete(savedScans).where(eq(savedScans.id, id)).run();
  }
}

export const storage = new Storage();
