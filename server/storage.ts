import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import {
  users, watchlistItems, savedScans,
  type User, type InsertUser,
  type WatchlistItem, type InsertWatchlistItem,
  type SavedScan, type InsertSavedScan,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

// Use /data volume on Railway (persists across redeploys), fallback to project root locally
const DB_DIR = fs.existsSync('/data') ? '/data' : '.';
const DB_PATH = path.join(DB_DIR, 'data.db');

const sqlite = new Database(DB_PATH);
export const db = drizzle(sqlite);

// Create tables
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
`);

// Simple password hashing using built-in crypto (no bcrypt needed)
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

export interface IStorage {
  // Auth
  createUser(data: InsertUser): User;
  getUserByEmail(email: string): User | undefined;
  getUserById(id: number): User | undefined;
  updateUserPlan(id: number, plan: string): User | undefined;
  // Watchlist
  getWatchlist(): WatchlistItem[];
  addWatchlistItem(item: InsertWatchlistItem): WatchlistItem;
  removeWatchlistItem(id: number): void;
  // Scans
  getSavedScans(): SavedScan[];
  saveScan(scan: InsertSavedScan): SavedScan;
  deleteScan(id: number): void;
}

export class Storage implements IStorage {
  createUser(data: InsertUser): User {
    const passwordHash = hashPassword(data.password);
    return db.insert(users).values({
      email: data.email,
      name: data.name,
      plan: data.plan ?? 'free',
      passwordHash,
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
