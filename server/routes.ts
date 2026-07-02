import type { Express } from 'express';
import { createServer } from 'http';
import { storage } from './storage';
import { insertWatchlistItemSchema, insertSavedScanSchema } from '@shared/schema';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cache briefing for 1 hour to avoid burning API credits on every page load
let briefingCache: { data: any; generatedAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

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
- Be specific — use real company names, real market dynamics for ${dateStr}
- Do NOT mention GHO$TRADER or any product name in the briefing content`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(completion.choices[0].message.content || '{}');
  return {
    ...parsed,
    date: dateStr,
    generated_at: `Today at ${timeStr}`,
  };
}

// Deterministic mock data — unique prices, unique scores, proper sort order
type MockEntry = { company: string; price: number; changePct: number; score: number; bull: number; bear: number; instConf: number; forecast: number; vol: number; mktCap: number; sector: string };
const MOCK_DATA: Record<string, MockEntry> = {
  NVDA:  { company: 'NVIDIA Corp',           price: 131.42, changePct:  2.14, score: 94, bull: 88, bear: 18, instConf: 82, forecast: 91, vol: 48200000, mktCap: 3210, sector: 'Technology' },
  AAPL:  { company: 'Apple Inc',              price: 207.15, changePct: -0.22, score: 72, bull: 65, bear: 34, instConf: 79, forecast: 70, vol: 55100000, mktCap: 3190, sector: 'Technology' },
  MSFT:  { company: 'Microsoft Corp',         price: 423.80, changePct:  0.61, score: 85, bull: 80, bear: 25, instConf: 88, forecast: 84, vol: 21400000, mktCap: 3150, sector: 'Technology' },
  TSLA:  { company: 'Tesla Inc',              price: 248.30, changePct:  0.00, score: 68, bull: 55, bear: 48, instConf: 54, forecast: 65, vol: 87300000, mktCap:  792, sector: 'Consumer' },
  AMZN:  { company: 'Amazon.com',             price: 196.44, changePct:  0.33, score: 79, bull: 74, bear: 28, instConf: 81, forecast: 78, vol: 35600000, mktCap: 2080, sector: 'Consumer' },
  META:  { company: 'Meta Platforms',         price: 555.20, changePct:  0.71, score: 88, bull: 83, bear: 20, instConf: 85, forecast: 87, vol: 17800000, mktCap: 1400, sector: 'Technology' },
  GOOGL: { company: 'Alphabet Inc',           price: 178.62, changePct:  0.82, score: 83, bull: 77, bear: 23, instConf: 80, forecast: 82, vol: 22100000, mktCap: 2210, sector: 'Technology' },
  AMD:   { company: 'Advanced Micro Devices', price: 155.90, changePct:  0.19, score: 76, bull: 70, bear: 33, instConf: 72, forecast: 75, vol: 41700000, mktCap:  252, sector: 'Technology' },
  PLTR:  { company: 'Palantir Tech',          price:  38.14, changePct: -0.58, score: 71, bull: 62, bear: 41, instConf: 61, forecast: 68, vol: 62400000, mktCap:   82, sector: 'Technology' },
  SOFI:  { company: 'SoFi Technologies',      price:  14.28, changePct:  1.21, score: 63, bull: 58, bear: 44, instConf: 49, forecast: 60, vol: 29800000, mktCap:   14, sector: 'Finance' },
  COIN:  { company: 'Coinbase Global',        price: 215.70, changePct:  1.85, score: 70, bull: 66, bear: 37, instConf: 58, forecast: 67, vol: 18600000, mktCap:   52, sector: 'Finance' },
  RBLX:  { company: 'Roblox Corp',            price:  45.33, changePct: -0.44, score: 55, bull: 48, bear: 52, instConf: 44, forecast: 52, vol: 14200000, mktCap:   28, sector: 'Technology' },
  SPY:   { company: 'SPDR S&P 500 ETF',       price: 542.18, changePct:  1.32, score: 80, bull: 76, bear: 24, instConf: 90, forecast: 80, vol: 72100000, mktCap:    0, sector: 'ETF' },
  QQQ:   { company: 'Invesco QQQ Trust',      price: 471.50, changePct:  1.61, score: 82, bull: 78, bear: 22, instConf: 88, forecast: 81, vol: 48300000, mktCap:    0, sector: 'ETF' },
  IWM:   { company: 'iShares Russell 2000',   price: 212.40, changePct:  0.48, score: 66, bull: 60, bear: 38, instConf: 71, forecast: 64, vol: 31500000, mktCap:    0, sector: 'ETF' },
  JPM:   { company: 'JPMorgan Chase',         price: 231.80, changePct:  0.55, score: 74, bull: 68, bear: 30, instConf: 76, forecast: 73, vol: 11200000, mktCap:  668, sector: 'Finance' },
  BAC:   { company: 'Bank of America',        price:  43.12, changePct:  0.28, score: 62, bull: 57, bear: 43, instConf: 64, forecast: 61, vol: 39400000, mktCap:  337, sector: 'Finance' },
  GS:    { company: 'Goldman Sachs',          price: 496.30, changePct:  0.40, score: 77, bull: 72, bear: 29, instConf: 78, forecast: 76, vol:  8700000, mktCap:  163, sector: 'Finance' },
  WMT:   { company: 'Walmart Inc',            price:  67.44, changePct:  0.15, score: 69, bull: 64, bear: 36, instConf: 73, forecast: 68, vol: 16300000, mktCap:  543, sector: 'Consumer' },
  DIS:   { company: 'Walt Disney Co',         price:  88.60, changePct: -0.35, score: 58, bull: 50, bear: 49, instConf: 52, forecast: 56, vol: 13800000, mktCap:  162, sector: 'Consumer' },
  NFLX:  { company: 'Netflix Inc',            price: 713.25, changePct:  1.44, score: 87, bull: 82, bear: 21, instConf: 84, forecast: 86, vol:  9400000, mktCap:  307, sector: 'Technology' },
  UBER:  { company: 'Uber Technologies',      price:  72.18, changePct:  0.92, score: 75, bull: 70, bear: 32, instConf: 66, forecast: 74, vol: 19700000, mktCap:  153, sector: 'Consumer' },
  ABNB:  { company: 'Airbnb Inc',             price: 134.50, changePct:  0.67, score: 67, bull: 61, bear: 40, instConf: 60, forecast: 65, vol:  7200000, mktCap:   85, sector: 'Consumer' },
  CRM:   { company: 'Salesforce Inc',         price: 298.40, changePct:  0.38, score: 73, bull: 68, bear: 34, instConf: 70, forecast: 72, vol:  6800000, mktCap:  289, sector: 'Technology' },
  SNOW:  { company: 'Snowflake Inc',          price: 162.80, changePct:  1.10, score: 78, bull: 73, bear: 29, instConf: 69, forecast: 77, vol: 11100000, mktCap:   54, sector: 'Technology' },
};

function generateStockData(symbols: string[]) {
  const fallback: MockEntry = { company: 'Unknown Corp', price: 50, changePct: 0, score: 50, bull: 50, bear: 50, instConf: 50, forecast: 50, vol: 5000000, mktCap: 10, sector: 'Technology' };
  return symbols.map(symbol => {
    const d = MOCK_DATA[symbol] ?? fallback;
    const basePrice = d.price;
    const changePercent = d.changePct;
    const ghostScore = d.score;
    return {
      symbol,
      companyName: d.company,
      price: parseFloat(basePrice.toFixed(2)),
      change: parseFloat((basePrice * changePercent / 100).toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volume: d.vol,
      marketCap: d.mktCap,
      ghostScore,
      bullishPressure: d.bull,
      bearishPressure: d.bear,
      institutionalConf: d.instConf,
      forecastScore: d.forecast,
      sector: d.sector,
      trend: ghostScore > 65 ? 'bullish' : ghostScore < 40 ? 'bearish' : 'neutral',
    };
  });
}

export async function registerRoutes(httpServer: ReturnType<typeof createServer>, app: Express) {
  // Market overview
  app.get('/api/market/overview', (req, res) => {
    res.json({
      marketStatus: 'open',
      spyChange: 0.42,
      qqqChange: 0.78,
      vix: 16.3,
      advDecline: '2,847 / 1,203',
      newHighs: 142,
      newLows: 28,
      lastUpdated: new Date().toISOString(),
    });
  });

  // Top movers / dashboard
  app.get('/api/market/top', (req, res) => {
    const symbols = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMZN', 'META', 'GOOGL', 'AMD', 'PLTR', 'COIN'];
    res.json(generateStockData(symbols));
  });

  // Stock lookup
  app.get('/api/stock/:symbol', (req, res) => {
    const { symbol } = req.params;
    if (!/^[A-Z0-9.^]{1,10}$/i.test(symbol)) {
      return res.status(400).json({ error: 'Invalid symbol' });
    }
    const [data] = generateStockData([symbol.toUpperCase()]);
    res.json(data);
  });

  // Bullish scanner
  app.get('/api/scanner/bullish', (req, res) => {
    const symbols = ['NVDA', 'AAPL', 'MSFT', 'META', 'GOOGL', 'AMZN', 'AMD', 'CRM', 'SNOW', 'NFLX', 'UBER', 'SPY'];
    const data = generateStockData(symbols)
      .filter(s => s.ghostScore >= 55)
      .sort((a, b) => b.ghostScore - a.ghostScore);
    res.json(data);
  });

  // Bearish scanner
  app.get('/api/scanner/bearish', (req, res) => {
    const symbols = ['TSLA', 'COIN', 'RBLX', 'SOFI', 'PLTR', 'ABNB', 'DIS', 'BAC', 'IWM', 'WMT', 'GS', 'JPM'];
    const data = generateStockData(symbols)
      .filter(s => s.bearishPressure >= 45)
      .sort((a, b) => b.bearishPressure - a.bearishPressure);
    res.json(data);
  });

  // AI Briefing — powered by Specter AI (GPT-4o) with 1-hour cache
  app.get('/api/briefing/daily', async (req, res) => {
    const now = Date.now();
    // Serve cached briefing if fresh
    if (briefingCache && (now - briefingCache.generatedAt) < CACHE_TTL_MS) {
      return res.json(briefingCache.data);
    }
    // Try OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const data = await generateAIBriefing();
        briefingCache = { data, generatedAt: now };
        return res.json(data);
      } catch (err) {
        console.error('Specter AI briefing error:', err);
      }
    }
    // Fallback mock
    const nowDate = new Date();
    const timeStr = nowDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
    return res.json({
      date: nowDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      market_sentiment: 'Bullish',
      sentiment_score: 67,
      headline: 'Tech Rally Continues as AI Spending Drives Q2 Beats',
      summary: 'Major indices extended gains for a third consecutive session, led by semiconductor and cloud infrastructure names. NVIDIA continues to be the dominant AI infrastructure play, while Microsoft Azure and Amazon AWS both reported above-consensus cloud growth.',
      key_themes: [
        { title: 'AI Infrastructure', signal: 'bullish', detail: 'NVDA, AMD, MSFT showing strong institutional accumulation. Semiconductor order books remain full through Q3.' },
        { title: 'Consumer Discretionary', signal: 'neutral', detail: 'Mixed signals — travel and hospitality remain strong, but retail spending showing early signs of softening.' },
        { title: 'Financials', signal: 'bearish', detail: 'Regional bank concerns persist. Credit spreads widening slightly; watch for contagion risk.' },
        { title: 'Energy', signal: 'neutral', detail: 'Oil steady near $78. Geopolitical risk premium fading as OPEC signals steady production.' },
      ],
      top_opportunities: [
        { symbol: 'NVDA', reason: 'AI infrastructure leader. Specter AI detects sustained institutional accumulation over 5 sessions.', ghost_score: 91 },
        { symbol: 'MSFT', reason: 'Azure cloud growth re-accelerating. Azure AI attach rate exceeded analyst estimates by 12%.', ghost_score: 83 },
        { symbol: 'META', reason: 'Ad revenue recovery strengthening. Llama AI monetization beginning to show in top-line growth.', ghost_score: 76 },
      ],
      top_risks: [
        { symbol: 'SIVB', reason: 'Regional banking stress indicators elevated. High exposure to commercial real estate refinancing cycle.', risk_level: 'High' },
        { symbol: 'TSLA', reason: 'Delivery miss risk into Q2 report. Margin compression ongoing as EV competition intensifies.', risk_level: 'Medium' },
        { symbol: 'XOM', reason: 'Oil price ceiling capping upside. Near-term catalyst limited.', risk_level: 'Low' },
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

  // Watchlist API
  app.get('/api/watchlist', (req, res) => {
    const items = storage.getWatchlist();
    res.json(items);
  });

  app.post('/api/watchlist', (req, res) => {
    const parsed = insertWatchlistItemSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request body' });
    const item = storage.addWatchlistItem(parsed.data);
    res.status(201).json(item);
  });

  app.delete('/api/watchlist/:id', (req, res) => {
    storage.removeWatchlistItem(parseInt(req.params.id));
    res.json({ ok: true });
  });

  // Saved scans
  app.get('/api/scans', (req, res) => {
    res.json(storage.getSavedScans());
  });

  app.post('/api/scans', (req, res) => {
    const parsed = insertSavedScanSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid request body' });
    const scan = storage.saveScan(parsed.data);
    res.status(201).json(scan);
  });

  app.delete('/api/scans/:id', (req, res) => {
    storage.deleteScan(parseInt(req.params.id));
    res.json({ ok: true });
  });

  return httpServer;
}
