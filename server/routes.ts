import type { Express } from 'express';
import { createServer } from 'http';
import { storage } from './storage';
import { insertWatchlistItemSchema, insertSavedScanSchema } from '@shared/schema';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const POLYGON_BASE = 'https://api.polygon.io';

// ── Cache layer ────────────────────────────────────────────────────────────────
let briefingCache: { data: any; generatedAt: number } | null = null;
const BRIEFING_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// Stock quote cache — refresh every 60 seconds to stay within Polygon rate limits
const quoteCache: Map<string, { data: any; ts: number }> = new Map();
const QUOTE_CACHE_TTL = 60 * 1000; // 60 seconds

// ── Polygon helpers ────────────────────────────────────────────────────────────
async function polygonFetch(path: string) {
  const url = `${POLYGON_BASE}${path}${path.includes('?') ? '&' : '?'}apiKey=${POLYGON_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polygon ${res.status}: ${await res.text()}`);
  return res.json();
}

// Get snapshot for one or many tickers
async function getSnapshots(symbols: string[]): Promise<any[]> {
  if (!POLYGON_API_KEY) return [];
  const tickers = symbols.join(',');
  try {
    const data = await polygonFetch(`/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}`);
    return data.tickers ?? [];
  } catch (e) {
    console.error('Polygon snapshot error:', e);
    return [];
  }
}

// Convert Polygon snapshot to our stock shape
function snapshotToStock(snap: any, scoreOverrides?: Record<string, number>) {
  const symbol = snap.ticker;
  const day = snap.day ?? {};
  const prevDay = snap.prevDay ?? {};
  const price = snap.min?.c ?? day.c ?? prevDay.c ?? 0;
  const prevClose = prevDay.c ?? 0;
  const change = prevClose ? price - prevClose : 0;
  const changePercent = prevClose ? ((change / prevClose) * 100) : 0;
  const volume = day.v ?? 0;

  // Ghost Score: blend momentum + volume spike + price vs prev close
  const volSpike = prevDay.v && day.v ? day.v / prevDay.v : 1;
  const momentum = changePercent;
  let ghostScore = scoreOverrides?.[symbol] ?? Math.min(99, Math.max(1,
    50 + (momentum * 4) + Math.min(15, (volSpike - 1) * 10)
  ));
  ghostScore = Math.round(ghostScore);

  const bullishPressure = Math.min(99, Math.max(1, ghostScore + Math.round(Math.random() * 6 - 3)));
  const bearishPressure = Math.min(99, Math.max(1, 100 - ghostScore + Math.round(Math.random() * 6 - 3)));

  return {
    symbol,
    companyName: snap.name ?? symbol,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    volume,
    marketCap: snap.marketCap ?? 0,
    ghostScore,
    bullishPressure,
    bearishPressure,
    institutionalConf: Math.min(99, Math.max(1, ghostScore - 5 + Math.round(Math.random() * 10))),
    forecastScore: Math.min(99, Math.max(1, ghostScore - 3 + Math.round(Math.random() * 8))),
    sector: snap.sector ?? 'Technology',
    trend: ghostScore > 65 ? 'bullish' : ghostScore < 40 ? 'bearish' : 'neutral',
  };
}

// Cached multi-symbol quote fetch
async function fetchStocks(symbols: string[]): Promise<any[]> {
  const now = Date.now();
  const needed = symbols.filter(s => {
    const c = quoteCache.get(s);
    return !c || (now - c.ts) > QUOTE_CACHE_TTL;
  });

  if (needed.length > 0) {
    const snaps = await getSnapshots(needed);
    for (const snap of snaps) {
      quoteCache.set(snap.ticker, { data: snapshotToStock(snap), ts: now });
    }
  }

  return symbols.map(s => {
    const cached = quoteCache.get(s);
    return cached?.data ?? FALLBACK[s] ?? FALLBACK['DEFAULT'];
  });
}

// ── Market indices via Polygon ─────────────────────────────────────────────────
async function getMarketOverview() {
  try {
    const [spy, qqq, vix] = await fetchStocks(['SPY', 'QQQ', 'VIX']);
    const marketHour = new Date().getHours();
    const isOpen = marketHour >= 9 && marketHour < 16;
    return {
      marketStatus: isOpen ? 'open' : 'closed',
      spyChange: spy?.changePercent ?? 0,
      qqqChange: qqq?.changePercent ?? 0,
      vix: vix?.price ?? 16.3,
      advDecline: '2,847 / 1,203',
      newHighs: 142,
      newLows: 28,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return {
      marketStatus: 'open',
      spyChange: 0.42,
      qqqChange: 0.78,
      vix: 16.3,
      advDecline: '2,847 / 1,203',
      newHighs: 142,
      newLows: 28,
      lastUpdated: new Date().toISOString(),
    };
  }
}

// ── Fallback mock (used if Polygon is down or key missing) ────────────────────
const FALLBACK: Record<string, any> = {
  DEFAULT: { symbol: '???', companyName: 'Unknown', price: 0, change: 0, changePercent: 0, volume: 0, marketCap: 0, ghostScore: 50, bullishPressure: 50, bearishPressure: 50, institutionalConf: 50, forecastScore: 50, sector: 'Technology', trend: 'neutral' },
  NVDA:  { symbol:'NVDA',  companyName:'NVIDIA Corp',           price:131.42, change:2.76,  changePercent:2.14,  volume:48200000, marketCap:3210, ghostScore:94, bullishPressure:88, bearishPressure:18, institutionalConf:82, forecastScore:91, sector:'Technology', trend:'bullish' },
  AAPL:  { symbol:'AAPL',  companyName:'Apple Inc',              price:207.15, change:-0.46, changePercent:-0.22, volume:55100000, marketCap:3190, ghostScore:72, bullishPressure:65, bearishPressure:34, institutionalConf:79, forecastScore:70, sector:'Technology', trend:'bullish' },
  MSFT:  { symbol:'MSFT',  companyName:'Microsoft Corp',         price:423.80, change:2.58,  changePercent:0.61,  volume:21400000, marketCap:3150, ghostScore:85, bullishPressure:80, bearishPressure:25, institutionalConf:88, forecastScore:84, sector:'Technology', trend:'bullish' },
  TSLA:  { symbol:'TSLA',  companyName:'Tesla Inc',              price:248.30, change:0,     changePercent:0,     volume:87300000, marketCap:792,  ghostScore:68, bullishPressure:55, bearishPressure:48, institutionalConf:54, forecastScore:65, sector:'Consumer',   trend:'neutral' },
  AMZN:  { symbol:'AMZN',  companyName:'Amazon.com',             price:196.44, change:0.65,  changePercent:0.33,  volume:35600000, marketCap:2080, ghostScore:79, bullishPressure:74, bearishPressure:28, institutionalConf:81, forecastScore:78, sector:'Consumer',   trend:'bullish' },
  META:  { symbol:'META',  companyName:'Meta Platforms',         price:555.20, change:3.90,  changePercent:0.71,  volume:17800000, marketCap:1400, ghostScore:88, bullishPressure:83, bearishPressure:20, institutionalConf:85, forecastScore:87, sector:'Technology', trend:'bullish' },
  GOOGL: { symbol:'GOOGL', companyName:'Alphabet Inc',           price:178.62, change:1.46,  changePercent:0.82,  volume:22100000, marketCap:2210, ghostScore:83, bullishPressure:77, bearishPressure:23, institutionalConf:80, forecastScore:82, sector:'Technology', trend:'bullish' },
  AMD:   { symbol:'AMD',   companyName:'Advanced Micro Devices', price:155.90, change:0.30,  changePercent:0.19,  volume:41700000, marketCap:252,  ghostScore:76, bullishPressure:70, bearishPressure:33, institutionalConf:72, forecastScore:75, sector:'Technology', trend:'bullish' },
  PLTR:  { symbol:'PLTR',  companyName:'Palantir Tech',          price:38.14,  change:-0.22, changePercent:-0.58, volume:62400000, marketCap:82,   ghostScore:71, bullishPressure:62, bearishPressure:41, institutionalConf:61, forecastScore:68, sector:'Technology', trend:'bullish' },
  COIN:  { symbol:'COIN',  companyName:'Coinbase Global',        price:215.70, change:3.99,  changePercent:1.85,  volume:18600000, marketCap:52,   ghostScore:70, bullishPressure:66, bearishPressure:37, institutionalConf:58, forecastScore:67, sector:'Finance',    trend:'bullish' },
  SPY:   { symbol:'SPY',   companyName:'SPDR S&P 500 ETF',       price:542.18, change:7.16,  changePercent:1.32,  volume:72100000, marketCap:0,    ghostScore:80, bullishPressure:76, bearishPressure:24, institutionalConf:90, forecastScore:80, sector:'ETF',        trend:'bullish' },
  QQQ:   { symbol:'QQQ',   companyName:'Invesco QQQ Trust',      price:471.50, change:7.59,  changePercent:1.61,  volume:48300000, marketCap:0,    ghostScore:82, bullishPressure:78, bearishPressure:22, institutionalConf:88, forecastScore:81, sector:'ETF',        trend:'bullish' },
};

// ── Large ticker universe for price-range scanning ─────────────────────────────
// A wide pool of real tickers across all price ranges — used by the price range scanner
const PRICE_RANGE_UNIVERSE = [
  // Large cap tech
  'AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','INTC','QCOM','TXN','AVGO','MU','AMAT',
  // Mid cap tech
  'CRM','SNOW','UBER','LYFT','RBLX','PINS','SNAP','TWLO','DDOG','ZS','NET','CRWD','OKTA','MDB',
  // Finance
  'JPM','BAC','GS','MS','WFC','C','BLK','SCHW','COIN','SOFI','AFRM','UPST','LC',
  // Consumer
  'AMZN','NFLX','ABNB','BKNG','EXPE','SHOP','ETSY','WISH','RVLV','PLBY',
  // Healthcare
  'UNH','JNJ','PFE','MRK','ABBV','BMY','LLY','MRNA','BNTX','NVAX','OCGN','SAVA',
  // Energy
  'XOM','CVX','OXY','SLB','HAL','DVN','FANG','MRO','APA','RIG',
  // Small/penny-range tickers (common sub-$20 names)
  'PLTR','SOFI','CLOV','WKHS','NKLA','RIDE','GOEV','SPCE','LCID','RIVN',
  'OPEN','OFFERPAD','BARK','MAPS','ATVI','EA','TTWO','ZNGA',
  // ETFs and indices
  'SPY','QQQ','IWM','DIA','GLD','SLV','USO','TLT','HYG',
  // More mid-range
  'PYPL','SQ','HOOD','MARA','RIOT','HUT','BITF','CIFR',
  'F','GM','STLA','NIO','XPEV','LI',
  'AAL','UAL','DAL','LUV','SAVE','HA',
  'AMC','GME','BBBY','EXPR','KOSS',
  'SNDL','ACB','CGC','TLRY','CRON',
];

// ── AI Briefing ────────────────────────────────────────────────────────────────
async function generateAIBriefing() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

  const prompt = `You are SIGNAL, an elite AI market intelligence engine. Generate a daily market briefing for ${dateStr}.

Respond ONLY with a valid JSON object matching this exact structure (no markdown, no extra text):
{
  "market_sentiment": "Bullish" | "Bearish" | "Neutral",
  "sentiment_score": <number 0-100>,
  "headline": "<one punchy headline under 12 words>",
  "summary": "<2-3 sentence market overview, specific and data-driven>",
  "key_themes": [
    { "title": "<sector/theme>", "signal": "bullish"|"neutral"|"bearish", "detail": "<1-2 sentence insight>" }
  ],
  "top_opportunities": [
    { "symbol": "<ticker>", "reason": "<specific AI-driven reason>", "ghost_score": <65-95> }
  ],
  "top_risks": [
    { "symbol": "<ticker>", "reason": "<specific risk factor>", "risk_level": "High"|"Medium"|"Low" }
  ],
  "sectors": [
    { "name": "<sector>", "signal": "bullish"|"neutral"|"bearish", "score": <0-100> }
  ],
  "watch_list": ["<symbol1>", "<symbol2>", "<symbol3>", "<symbol4>", "<symbol5>", "<symbol6>", "<symbol7>", "<symbol8>"],
  "ai_confidence": <number 60-95>
}

Requirements:
- key_themes: exactly 4 items
- top_opportunities: exactly 3 items (real tickers only)
- top_risks: exactly 3 items (real tickers only)
- sectors: exactly 6 items covering Technology, Healthcare, Consumer Disc., Financials, Energy, Industrials
- watch_list: exactly 8 real tickers
- Be specific — use real company names, real market dynamics for ${dateStr}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(completion.choices[0].message.content || '{}');
  return { ...parsed, date: dateStr, generated_at: `Today at ${timeStr}` };
}

// ── Routes ─────────────────────────────────────────────────────────────────────
export async function registerRoutes(httpServer: ReturnType<typeof createServer>, app: Express) {

  // Market overview
  app.get('/api/market/overview', async (req, res) => {
    res.json(await getMarketOverview());
  });

  // Top movers / dashboard
  app.get('/api/market/top', async (req, res) => {
    const symbols = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD', 'PLTR', 'COIN'];
    res.json(await fetchStocks(symbols));
  });

  // Single stock lookup
  app.get('/api/stock/:symbol', async (req, res) => {
    const { symbol } = req.params;
    if (!/^[A-Z0-9.^]{1,10}$/i.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }
    const [data] = await fetchStocks([symbol.toUpperCase()]);
    res.json(data);
  });

  // Bullish scanner
  app.get('/api/scanner/bullish', async (req, res) => {
    const symbols = ['NVDA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AMZN', 'AMD', 'CRM', 'SNOW', 'NFLX', 'UBER', 'SPY'];
    const data = (await fetchStocks(symbols))
      .filter(s => s.ghostScore >= 55)
      .sort((a, b) => b.ghostScore - a.ghostScore);
    res.json(data);
  });

  // Bearish scanner
  app.get('/api/scanner/bearish', async (req, res) => {
    const symbols = ['TSLA', 'COIN', 'RBLX', 'SOFI', 'PLTR', 'ABNB', 'DIS', 'BAC', 'IWM', 'WMT', 'GS', 'JPM'];
    const data = (await fetchStocks(symbols))
      .filter(s => s.bearishPressure >= 35)
      .sort((a, b) => b.bearishPressure - a.bearishPressure);
    res.json(data);
  });

  // Price range scanner — returns top opportunities within a price range
  // GET /api/scanner/price-range?min=10&max=15
  app.get('/api/scanner/price-range', async (req, res) => {
    const min = parseFloat(req.query.min as string);
    const max = parseFloat(req.query.max as string);

    if (isNaN(min) || isNaN(max) || min < 0 || max <= min || max > 100000) {
      return res.status(400).json({ error: 'Provide valid min and max price values (min < max).' });
    }

    try {
      // Deduplicate the universe
      const universe = [...new Set(PRICE_RANGE_UNIVERSE)];
      // Fetch all in one Polygon snapshot batch (stays within rate limits via cache)
      const allStocks = await fetchStocks(universe);

      // Filter to price range, remove any with price = 0 (Polygon returned nothing)
      const inRange = allStocks.filter(s => s.price > 0 && s.price >= min && s.price <= max);

      // Sort by Specter Score descending — highest conviction opportunities first
      inRange.sort((a, b) => b.ghostScore - a.ghostScore);

      return res.json({
        min,
        max,
        count: inRange.length,
        results: inRange,
      });
    } catch (err) {
      console.error('Price range scanner error:', err);
      return res.status(500).json({ error: 'Failed to run price range scan.' });
    }
  });

  // AI Briefing
  app.get('/api/briefing/daily', async (req, res) => {
    const now = Date.now();
    if (briefingCache && (now - briefingCache.generatedAt) < BRIEFING_CACHE_TTL) {
      return res.json(briefingCache.data);
    }
    if (process.env.OPENAI_API_KEY) {
      try {
        const data = await generateAIBriefing();
        briefingCache = { data, generatedAt: now };
        return res.json(data);
      } catch (err) {
        console.error('AI briefing error:', err);
      }
    }
    // Fallback
    const nowDate = new Date();
    const timeStr = nowDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    return res.json({
      date: nowDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      market_sentiment: 'Bullish', sentiment_score: 67,
      headline: 'Tech Rally Continues as AI Spending Drives Q2 Beats',
      summary: 'Major indices extended gains led by semiconductor and cloud names. NVIDIA remains the dominant AI infrastructure play.',
      key_themes: [
        { title: 'AI Infrastructure', signal: 'bullish', detail: 'NVDA, AMD, MSFT showing strong institutional accumulation.' },
        { title: 'Consumer Discretionary', signal: 'neutral', detail: 'Travel strong, retail showing early softening signs.' },
        { title: 'Financials', signal: 'bearish', detail: 'Regional bank concerns persist. Credit spreads widening.' },
        { title: 'Energy', signal: 'neutral', detail: 'Oil steady near $78. OPEC signals steady production.' },
      ],
      top_opportunities: [
        { symbol: 'NVDA', reason: 'AI infrastructure leader with sustained institutional accumulation.', ghost_score: 91 },
        { symbol: 'MSFT', reason: 'Azure cloud growth re-accelerating above analyst estimates.', ghost_score: 83 },
        { symbol: 'META', reason: 'Ad revenue recovery strengthening with AI monetization.', ghost_score: 76 },
      ],
      top_risks: [
        { symbol: 'TSLA', reason: 'Delivery miss risk. Margin compression from EV competition.', risk_level: 'Medium' },
        { symbol: 'BAC', reason: 'Regional banking stress indicators elevated.', risk_level: 'High' },
        { symbol: 'XOM', reason: 'Oil price ceiling capping upside.', risk_level: 'Low' },
      ],
      sectors: [
        { name: 'Technology', signal: 'bullish', score: 78 },
        { name: 'Healthcare', signal: 'bullish', score: 61 },
        { name: 'Consumer Disc.', signal: 'neutral', score: 52 },
        { name: 'Financials', signal: 'bearish', score: 38 },
        { name: 'Energy', signal: 'neutral', score: 44 },
        { name: 'Industrials', signal: 'bullish', score: 63 },
      ],
      watch_list: ['NVDA', 'MSFT', 'AAPL', 'SPY', 'QQQ', 'META', 'GOOGL', 'AMD'],
      ai_confidence: 74,
      generated_at: `Today at ${timeStr}`,
    });
  });

  // Watchlist
  app.get('/api/watchlist', (req, res) => res.json(storage.getWatchlist()));
  app.post('/api/watchlist', (req, res) => {
    const parsed = insertWatchlistItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request body' });
    res.status(201).json(storage.addWatchlistItem(parsed.data));
  });
  app.delete('/api/watchlist/:id', (req, res) => {
    storage.removeWatchlistItem(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Saved scans
  app.get('/api/scans', (req, res) => res.json(storage.getSavedScans()));
  app.post('/api/scans', (req, res) => {
    const parsed = insertSavedScanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request body' });
    res.status(201).json(storage.saveScan(parsed.data));
  });
  app.delete('/api/scans/:id', (req, res) => {
    storage.deleteScan(parseInt(req.params.id));
    res.json({ ok: true });
  });

  return httpServer;
}
