import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {
  users, watchlistItems, savedScans, trades, alerts, pushSubscriptions,
  type User, type InsertUser,
  type WatchlistItem, type InsertWatchlistItem,
  type SavedScan, type InsertSavedScan,
  type Trade, type InsertTrade,
  type Alert, type InsertAlert,
  type PushSubscription, type InsertPushSubscription,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const DB_DIR = fs.existsSync('/data') ? '/data' : '.';
const DB_PATH = path.join(DB_DIR, 'data.db');

const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite);

sqlite.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS watchlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 0,
    symbol TEXT NOT NULL,
    added_at INTEGER NOT NULL DEFAULT 0,
    notes TEXT DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS saved_scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    filters TEXT NOT NULL,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    action TEXT NOT NULL,
    price REAL NOT NULL,
    shares REAL NOT NULL DEFAULT 1,
    sector TEXT,
    notes TEXT,
    traded_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    ticker TEXT NOT NULL,
    type TEXT NOT NULL,
    target_value REAL NOT NULL,
    message TEXT,
    triggered INTEGER NOT NULL DEFAULT 0,
    triggered_at INTEGER,
    created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER
  );
`);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const verify = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return hash === verify;
}

class Storage {
  // ── Users ──────────────────────────────────────────────────────────────────
  createUser(data: InsertUser): User {
    return db.insert(users).values({
      email: data.email.toLowerCase(),
      passwordHash: hashPassword(data.password),
      name: data.name,
      plan: 'free',
      createdAt: new Date(),
    }).returning().get();
  }
  getUserByEmail(email: string): User | undefined {
    return db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  }
  getUserById(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  updateUserPlan(id: number, plan: string): User | undefined {
    return db.update(users).set({ plan }).where(eq(users.id, id)).returning().get();
  }

  // ── Watchlist ──────────────────────────────────────────────────────────────
  addWatchlistItem(item: InsertWatchlistItem): WatchlistItem {
    return db.insert(watchlistItems).values(item).returning().get();
  }
  removeWatchlistItem(id: number): void { db.delete(watchlistItems).where(eq(watchlistItems.id, id)).run(); }

  // ── Saved Scans ────────────────────────────────────────────────────────────
  getSavedScans(): SavedScan[] { return db.select().from(savedScans).all(); }
  saveScan(scan: InsertSavedScan): SavedScan {
    return db.insert(savedScans).values({ ...scan, createdAt: new Date() }).returning().get();
  }
  deleteScan(id: number): void { db.delete(savedScans).where(eq(savedScans.id, id)).run(); }

  // ── Trades ─────────────────────────────────────────────────────────────────
  logTrade(trade: InsertTrade): Trade {
    return db.insert(trades).values({ ...trade, tradedAt: new Date() }).returning().get();
  }
  getTradesByUser(userId: number): Trade[] {
    return db.select().from(trades).where(eq(trades.userId, userId)).all();
  }
  deleteTrade(id: number, userId: number): void {
    db.delete(trades).where(and(eq(trades.id, id), eq(trades.userId, userId))).run();
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────
  createAlert(alert: InsertAlert): Alert {
    return db.insert(alerts).values({ ...alert, triggered: false, createdAt: new Date() }).returning().get();
  }
  getAlertsByUser(userId: number): Alert[] {
    return db.select().from(alerts).where(eq(alerts.userId, userId)).all();
  }
  getActiveAlerts(): Alert[] {
    return db.select().from(alerts).all().filter(a => !a.triggered);
  }
  markAlertTriggered(id: number): void {
    db.update(alerts).set({ triggered: true, triggeredAt: new Date() }).where(eq(alerts.id, id)).run();
  }
  deleteAlert(id: number, userId: number): void {
    db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, userId))).run();
  }

  // ── Push Subscriptions ────────────────────────────────────────────────────
  savePushSubscription(sub: InsertPushSubscription): PushSubscription {
    // Upsert by endpoint
    const existing = db.select().from(pushSubscriptions).where(eq(pushSubscriptions.endpoint, sub.endpoint)).get();
    if (existing) {
      return db.update(pushSubscriptions).set({ p256dh: sub.p256dh, auth: sub.auth, userId: sub.userId })
        .where(eq(pushSubscriptions.endpoint, sub.endpoint)).returning().get()!;
    }
    return db.insert(pushSubscriptions).values({ ...sub, createdAt: new Date() }).returning().get();
  }
  getPushSubscriptionsByUser(userId: number): PushSubscription[] {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId)).all();
  }
  getAllPushSubscriptions(): PushSubscription[] {
    return db.select().from(pushSubscriptions).all();
  }
  deletePushSubscription(endpoint: string): void {
    db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
  }

  // ── Watchlist (user-scoped) ─────────────────────────────────────────────────
  getWatchlist(userId: number): WatchlistItem[] {
    return db.select().from(watchlistItems).where(eq(watchlistItems.userId, userId)).all();
  }

  addToWatchlist(userId: number, symbol: string, notes = ''): WatchlistItem | null {
    const sym = symbol.toUpperCase().trim();
    const existing = db.select().from(watchlistItems)
      .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.symbol, sym)))
      .get();
    if (existing) return existing as WatchlistItem;
    return db.insert(watchlistItems).values({ userId, symbol: sym, addedAt: Date.now(), notes }).returning().get() as WatchlistItem;
  }

  removeFromWatchlist(userId: number, symbol: string): void {
    db.delete(watchlistItems)
      .where(and(eq(watchlistItems.userId, userId), eq(watchlistItems.symbol, symbol.toUpperCase())))
      .run();
  }

  getAllWatchlistItems(): { userId: number; symbol: string }[] {
    return db.select({ userId: watchlistItems.userId, symbol: watchlistItems.symbol })
      .from(watchlistItems).all() as { userId: number; symbol: string }[];
  }


}

export const storage = new Storage();
