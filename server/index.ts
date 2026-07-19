// rebuild 1784485877
import "dotenv/config";
import express, { Response, NextFunction } from 'express';
import type { Request } from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import session from 'express-session';
import MemoryStore from 'memorystore';
import { WebSocketServer, WebSocket } from 'ws';
import { registerRoutes } from "./routes";
import { registerAuthRoutes } from "./auth";
import { serveStatic } from "./static";
import { createServer } from "node:http";

const app = express();
const httpServer = createServer(app);

// ── WebSocket Server (real-time prices) ─────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: '/ws/prices' });

// Live price cache — shared across all connections
const priceCache: Record<string, { price: number; change: number; changePct: number; prev: number }> = {};

// Tickers to track — top 20 most watched
const WATCH_TICKERS = [
  'NVDA','AAPL','MSFT','TSLA','AMZN','META','GOOGL','AMD','PLTR','COIN',
  'SPY','QQQ','DIA','MARA','SOFI','LYFT','CLSK','SMR','MSTR','HOOD'
];

// Poll Polygon every 15 seconds for latest prices
async function fetchLivePrices() {
  const apiKey = process.env.POLYGON_API_KEY || 'wfPgfWPd_FNcmK8OmW0oGhWv_xz7CYNq';
  const updates: Record<string, any> = {};

  for (const ticker of WATCH_TICKERS) {
    try {
      const res = await fetch(
        `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`
      );
      if (!res.ok) continue;
      const data = await res.json() as any;
      const result = data?.results?.[0];
      if (!result) continue;

      const price = result.c;
      const prev = result.o;
      const change = +(price - prev).toFixed(2);
      const changePct = +(((price - prev) / prev) * 100).toFixed(2);

      priceCache[ticker] = { price, change, changePct, prev };
      updates[ticker] = priceCache[ticker];
    } catch (_) {
      // Skip failed tickers silently
    }
    // Small delay between calls to respect Polygon rate limit (5/min free tier)
    await new Promise(r => setTimeout(r, 200));
  }

  // Broadcast updates to all connected clients
  if (Object.keys(updates).length > 0) {
    const msg = JSON.stringify({ type: 'price_update', data: updates, ts: Date.now() });
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    });
  }
}

// Send current cache to a new client immediately on connect
wss.on('connection', (ws) => {
  if (Object.keys(priceCache).length > 0) {
    ws.send(JSON.stringify({ type: 'price_update', data: priceCache, ts: Date.now() }));
  }
  ws.on('error', () => {});
});

// Start polling — initial fetch then every 15 seconds
fetchLivePrices();
setInterval(fetchLivePrices, 15_000);

// Trust Railway's proxy so secure cookies work correctly over HTTPS
app.set('trust proxy', 1);

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Rate limiting
const briefingLimiter = rateLimit({
  windowMs: 60 * 1000, max: 5,
  message: { error: 'Too many requests, please try again in a minute.' },
  standardHeaders: true, legacyHeaders: false,
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, max: 120,
  message: { error: 'Too many requests.' },
  standardHeaders: true, legacyHeaders: false,
});

app.use('/api/', apiLimiter);
app.use('/api/briefing', briefingLimiter);

// Session — 7-day persistent cookie
const MStore = MemoryStore(session);
app.use(session({
  secret: process.env.SESSION_SECRET || 'signalspecter-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  store: new MStore({ checkPeriod: 86400000 }),
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  },
}));

// Expose live price cache via REST for initial page load
app.get('/api/prices/live', (_req, res) => {
  res.json({ prices: priceCache, ts: Date.now() });
});

declare module "http" {
  interface IncomingMessage { rawBody: unknown; }
}

app.use(express.json({
  verify: (req, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(logLine);
    }
  });
  next();
});

(async () => {
  registerAuthRoutes(app);
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
