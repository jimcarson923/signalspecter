import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {
  users, watchlistItems, savedScans, trades,
  type User, type InsertUser,
  type WatchlistItem, type InsertWatchlistItem,
  type SavedScan, type InsertSavedScan,
  type Trade, type InsertTrade,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Use /data volume on Railway (persists across redeploys), fallback to project root locally
const DB_DIR = fs.existsSync('/data') ? '/data' : '.';
const DB_PATH = path.join(DB_DIR, 'data.db');

const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite);

// Run migrations inline — safe to call multiple times (CREATE TABLE IF NOT EXISTS)
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
    const passwordHash = hashPassword(data.password);
    return db.insert(users).values({
      email: data.email.toLowerCase(),
      passwordHash,
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
  getWatchlist(): WatchlistItem[] {
    return db.select().from(watchlistItems).all();
  }

  addWatchlistItem(item: InsertWatchlistItem): WatchlistItem {
    return db.insert(watchlistItems).values(item).returning().get();
  }

  removeWatchlistItem(id: number): void {
    db.delete(watchlistItems).where(eq(watchlistItems.id, id)).run();
  }

  // ── Saved Scans ────────────────────────────────────────────────────────────
  getSavedScans(): SavedScan[] {
    return db.select().from(savedScans).all();
  }

  saveScan(scan: InsertSavedScan): SavedScan {
    return db.insert(savedScans).values({ ...scan, createdAt: new Date() }).returning().get();
  }

  deleteScan(id: number): void {
    db.delete(savedScans).where(eq(savedScans.id, id)).run();
  }

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
}

export const storage = new Storage();
