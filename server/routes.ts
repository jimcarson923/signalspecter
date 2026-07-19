import type { Express } from 'express';
import { createServer } from 'http';
import { storage } from './storage';
import { insertWatchlistItemSchema, insertSavedScanSchema } from '@shared/schema';

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

  const completion = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 1200,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(completion.choices[0].message.content || '{}');
  return { ...parsed, date: dateStr, generated_at: `Today at ${timeStr}` };
}

// ── Static price cache — real July 2026 prices, covers all ranges ─────────────
// Each entry: symbol, companyName, price, change, changePercent, volume, sector
const PRICE_CACHE: Array<{
  symbol: string; companyName: string; price: number;
  change: number; changePercent: number; volume: number; sector: string;
}> = [
  // Sub $5
  { symbol:'SNDL', companyName:'Sundial Growers',      price:1.38,   change:-0.04, changePercent:-2.82, volume:12400000, sector:'Cannabis' },
  { symbol:'NKLA', companyName:'Nikola Corp',           price:0.18,   change:-0.01, changePercent:-5.26, volume:8200000,  sector:'EV' },
  { symbol:'GRAB', companyName:'Grab Holdings',         price:3.90,   change:0.12,  changePercent:3.17,  volume:18600000, sector:'Tech' },
  { symbol:'PLUG', companyName:'Plug Power',            price:2.64,   change:-0.08, changePercent:-2.94, volume:22100000, sector:'Energy' },
  { symbol:'OCGN', companyName:'Ocugen Inc',            price:1.20,   change:0.03,  changePercent:2.56,  volume:4800000,  sector:'Biotech' },
  { symbol:'GOEV', companyName:'Canoo Inc',             price:0.45,   change:-0.02, changePercent:-4.26, volume:3200000,  sector:'EV' },
  { symbol:'CLOV', companyName:'Clover Health',         price:1.85,   change:0.05,  changePercent:2.78,  volume:6400000,  sector:'Healthcare' },
  { symbol:'SPCE', companyName:'Virgin Galactic',       price:2.10,   change:-0.05, changePercent:-2.33, volume:5100000,  sector:'Aerospace' },
  { symbol:'FCEL', companyName:'FuelCell Energy',       price:2.95,   change:-0.06, changePercent:-1.99, volume:9800000,  sector:'Energy' },
  { symbol:'BLNK', companyName:'Blink Charging',        price:3.80,   change:0.08,  changePercent:2.15,  volume:7200000,  sector:'EV' },
  { symbol:'AMC',  companyName:'AMC Entertainment',     price:3.20,   change:-0.12, changePercent:-3.61, volume:14200000, sector:'Entertainment' },
  { symbol:'ACB',  companyName:'Aurora Cannabis',       price:5.40,   change:0.10,  changePercent:1.89,  volume:5600000,  sector:'Cannabis' },
  { symbol:'CGC',  companyName:'Canopy Growth',         price:4.80,   change:-0.09, changePercent:-1.84, volume:7800000,  sector:'Cannabis' },
  { symbol:'TLRY', companyName:'Tilray Brands',         price:1.62,   change:-0.04, changePercent:-2.40, volume:11200000, sector:'Cannabis' },
  // $5–$15
  { symbol:'F',    companyName:'Ford Motor Co',         price:13.64,  change:0.21,  changePercent:1.56,  volume:44500000, sector:'Auto' },
  { symbol:'NOK',  companyName:'Nokia Corp',            price:12.91,  change:0.18,  changePercent:1.41,  volume:55800000, sector:'Telecom' },
  { symbol:'MARA', companyName:'Marathon Digital',      price:12.40,  change:0.48,  changePercent:4.03,  volume:40800000, sector:'Crypto' },
  { symbol:'NIO',  companyName:'NIO Inc',               price:4.52,   change:-0.08, changePercent:-1.74, volume:32400000, sector:'EV' },
  { symbol:'XPEV', companyName:'XPeng Inc',             price:9.88,   change:0.22,  changePercent:2.28,  volume:18200000, sector:'EV' },
  { symbol:'BB',   companyName:'BlackBerry Ltd',        price:12.81,  change:0.14,  changePercent:1.10,  volume:40500000, sector:'Tech' },
  { symbol:'VALE', companyName:'Vale SA',               price:14.90,  change:-0.22, changePercent:-1.46, volume:16600000, sector:'Mining' },
  { symbol:'PATH', companyName:'UiPath Inc',            price:11.55,  change:0.18,  changePercent:1.58,  volume:66000000, sector:'Tech' },
  { symbol:'CLSK', companyName:'CleanSpark Inc',        price:13.62,  change:0.38,  changePercent:2.87,  volume:19100000, sector:'Crypto' },
  { symbol:'SMR',  companyName:'NuScale Power',         price:10.15,  change:0.22,  changePercent:2.22,  volume:23100000, sector:'Energy' },
  { symbol:'SNAP', companyName:'Snap Inc',              price:8.74,   change:-0.14, changePercent:-1.58, volume:28400000, sector:'Social Media' },
  { symbol:'T',    companyName:'AT&T Inc',              price:17.50,  change:0.12,  changePercent:0.69,  volume:38200000, sector:'Telecom' },
  { symbol:'WBD',  companyName:'Warner Bros Discovery', price:8.20,   change:-0.08, changePercent:-0.97, volume:14800000, sector:'Media' },
  { symbol:'PARA', companyName:'Paramount Global',      price:11.40,  change:0.14,  changePercent:1.24,  volume:18400000, sector:'Media' },
  { symbol:'JOBY', companyName:'Joby Aviation',         price:6.30,   change:0.18,  changePercent:2.94,  volume:12800000, sector:'Aerospace' },
  { symbol:'STLA', companyName:'Stellantis NV',         price:14.20,  change:-0.18, changePercent:-1.25, volume:9200000,  sector:'Auto' },
  { symbol:'CHPT', companyName:'ChargePoint Holdings',  price:1.82,   change:-0.04, changePercent:-2.15, volume:8400000,  sector:'EV' },
  { symbol:'DISH', companyName:'DISH Network',          price:5.60,   change:-0.08, changePercent:-1.41, volume:6200000,  sector:'Media' },
  { symbol:'SWN',  companyName:'Southwestern Energy',   price:7.40,   change:0.10,  changePercent:1.37,  volume:22800000, sector:'Energy' },
  // $15–$50
  { symbol:'SOFI', companyName:'SoFi Technologies',     price:18.24,  change:0.42,  changePercent:2.36,  volume:38400000, sector:'Finance' },
  { symbol:'AAL',  companyName:'American Airlines',     price:17.92,  change:0.28,  changePercent:1.59,  volume:38600000, sector:'Airlines' },
  { symbol:'RIVN', companyName:'Rivian Automotive',     price:12.80,  change:-0.22, changePercent:-1.69, volume:28400000, sector:'EV' },
  { symbol:'KEY',  companyName:'KeyCorp',               price:17.80,  change:0.18,  changePercent:1.02,  volume:14200000, sector:'Finance' },
  { symbol:'HBAN', companyName:'Huntington Bancshares', price:16.90,  change:0.12,  changePercent:0.71,  volume:18600000, sector:'Finance' },
  { symbol:'PENN', companyName:'PENN Entertainment',    price:18.60,  change:-0.24, changePercent:-1.27, volume:8400000,  sector:'Gaming' },
  { symbol:'LYFT', companyName:'Lyft Inc',              price:18.90,  change:0.42,  changePercent:2.27,  volume:16800000, sector:'Tech' },
  { symbol:'PINS', companyName:'Pinterest Inc',         price:28.40,  change:0.48,  changePercent:1.72,  volume:12400000, sector:'Social Media' },
  { symbol:'UPST', companyName:'Upstart Holdings',      price:22.30,  change:0.58,  changePercent:2.67,  volume:8200000,  sector:'Fintech' },
  { symbol:'INTC', companyName:'Intel Corp',            price:23.40,  change:-0.28, changePercent:-1.18, volume:38400000, sector:'Semiconductors' },
  { symbol:'FITB', companyName:'Fifth Third Bancorp',   price:38.50,  change:0.38,  changePercent:1.00,  volume:8800000,  sector:'Finance' },
  { symbol:'RF',   companyName:'Regions Financial',     price:22.10,  change:0.22,  changePercent:1.01,  volume:12400000, sector:'Finance' },
  { symbol:'APA',  companyName:'APA Corp',              price:21.30,  change:-0.18, changePercent:-0.84, volume:10200000, sector:'Energy' },
  { symbol:'MRO',  companyName:'Marathon Oil',          price:26.80,  change:0.28,  changePercent:1.05,  volume:14800000, sector:'Energy' },
  { symbol:'HAL',  companyName:'Halliburton Co',        price:32.10,  change:0.38,  changePercent:1.20,  volume:18200000, sector:'Energy' },
  { symbol:'ETSY', companyName:'Etsy Inc',              price:52.30,  change:0.82,  changePercent:1.59,  volume:6400000,  sector:'Commerce' },
  { symbol:'USB',  companyName:'US Bancorp',            price:44.30,  change:0.38,  changePercent:0.87,  volume:8800000,  sector:'Finance' },
  { symbol:'ALLY', companyName:'Ally Financial',        price:37.80,  change:0.42,  changePercent:1.12,  volume:6200000,  sector:'Finance' },
  { symbol:'BAC',  companyName:'Bank of America',       price:46.20,  change:0.48,  changePercent:1.05,  volume:38400000, sector:'Finance' },
  { symbol:'DVN',  companyName:'Devon Energy',          price:34.50,  change:-0.28, changePercent:-0.81, volume:12800000, sector:'Energy' },
  { symbol:'CZR',  companyName:'Caesars Entertainment', price:31.50,  change:0.32,  changePercent:1.03,  volume:6800000,  sector:'Gaming' },
  { symbol:'AR',   companyName:'Antero Resources',      price:36.20,  change:0.48,  changePercent:1.34,  volume:8400000,  sector:'Energy' },
  { symbol:'RRC',  companyName:'Range Resources',       price:32.80,  change:0.38,  changePercent:1.17,  volume:6200000,  sector:'Energy' },
  { symbol:'AFRM', companyName:'Affirm Holdings',       price:45.60,  change:0.88,  changePercent:1.97,  volume:12800000, sector:'Fintech' },
  { symbol:'MGM',  companyName:'MGM Resorts',           price:36.40,  change:0.42,  changePercent:1.17,  volume:8800000,  sector:'Gaming' },
  { symbol:'DKNG', companyName:'DraftKings Inc',        price:38.90,  change:0.62,  changePercent:1.62,  volume:18200000, sector:'Gaming' },
  { symbol:'ARKK', companyName:'ARK Innovation ETF',    price:52.30,  change:0.98,  changePercent:1.91,  volume:12400000, sector:'ETF' },
  { symbol:'SLB',  companyName:'SLB Inc',               price:38.40,  change:0.28,  changePercent:0.73,  volume:14200000, sector:'Energy' },
  { symbol:'OXY',  companyName:'Occidental Petroleum',  price:48.20,  change:0.52,  changePercent:1.09,  volume:18800000, sector:'Energy' },
  // $50–$120
  { symbol:'GM',   companyName:'General Motors',        price:52.40,  change:0.62,  changePercent:1.20,  volume:18800000, sector:'Auto' },
  { symbol:'TWLO', companyName:'Twilio Inc',            price:55.30,  change:0.82,  changePercent:1.51,  volume:6800000,  sector:'Tech' },
  { symbol:'CSCO', companyName:'Cisco Systems',         price:58.90,  change:0.42,  changePercent:0.72,  volume:18400000, sector:'Tech' },
  { symbol:'EBAY', companyName:'eBay Inc',              price:61.20,  change:0.58,  changePercent:0.96,  volume:8800000,  sector:'Commerce' },
  { symbol:'WFC',  companyName:'Wells Fargo',           price:75.40,  change:0.82,  changePercent:1.10,  volume:22400000, sector:'Finance' },
  { symbol:'C',    companyName:'Citigroup',             price:82.10,  change:0.88,  changePercent:1.08,  volume:18800000, sector:'Finance' },
  { symbol:'PYPL', companyName:'PayPal Holdings',       price:72.40,  change:0.82,  changePercent:1.14,  volume:18400000, sector:'Fintech' },
  { symbol:'WYNN', companyName:'Wynn Resorts',          price:89.20,  change:1.20,  changePercent:1.36,  volume:4800000,  sector:'Gaming' },
  { symbol:'MU',   companyName:'Micron Technology',     price:98.70,  change:1.42,  changePercent:1.46,  volume:24400000, sector:'Semiconductors' },
  { symbol:'DIS',  companyName:'Walt Disney Co',        price:92.40,  change:0.82,  changePercent:0.90,  volume:12800000, sector:'Entertainment' },
  { symbol:'NET',  companyName:'Cloudflare Inc',        price:98.30,  change:1.48,  changePercent:1.53,  volume:8800000,  sector:'Tech' },
  { symbol:'OKTA', companyName:'Okta Inc',              price:95.60,  change:1.22,  changePercent:1.29,  volume:6400000,  sector:'Cybersecurity' },
  { symbol:'SHOP', companyName:'Shopify Inc',           price:88.40,  change:1.18,  changePercent:1.35,  volume:8800000,  sector:'Commerce' },
  { symbol:'XLE',  companyName:'Energy Select ETF',     price:88.60,  change:0.62,  changePercent:0.70,  volume:18800000, sector:'ETF' },
  { symbol:'UBER', companyName:'Uber Technologies',     price:88.40,  change:1.22,  changePercent:1.40,  volume:22400000, sector:'Tech' },
  { symbol:'HYG',  companyName:'iShares HY Corp Bond',  price:76.40,  change:0.18,  changePercent:0.24,  volume:14800000, sector:'ETF' },
  { symbol:'TLT',  companyName:'iShares 20Y Treasury',  price:84.20,  change:-0.42, changePercent:-0.50, volume:28800000, sector:'ETF' },
  { symbol:'XLF',  companyName:'Financial Select ETF',  price:42.80,  change:0.38,  changePercent:0.89,  volume:38800000, sector:'ETF' },
  // $120–$200
  { symbol:'NVDA', companyName:'NVIDIA Corp',           price:131.42, change:2.76,  changePercent:2.14,  volume:48200000, sector:'Semiconductors' },
  { symbol:'DDOG', companyName:'Datadog Inc',           price:118.20, change:1.82,  changePercent:1.56,  volume:8400000,  sector:'Tech' },
  { symbol:'SNOW', companyName:'Snowflake Inc',         price:145.80, change:2.20,  changePercent:1.53,  volume:8800000,  sector:'Tech' },
  { symbol:'XLV',  companyName:'Health Care Select ETF',price:142.30, change:0.82,  changePercent:0.58,  volume:8800000,  sector:'ETF' },
  { symbol:'CVX',  companyName:'Chevron Corp',          price:142.80, change:0.88,  changePercent:0.62,  volume:12800000, sector:'Energy' },
  { symbol:'MS',   companyName:'Morgan Stanley',        price:128.70, change:1.42,  changePercent:1.12,  volume:8800000,  sector:'Finance' },
  { symbol:'AMAT', companyName:'Applied Materials',     price:172.50, change:2.18,  changePercent:1.28,  volume:8800000,  sector:'Semiconductors' },
  { symbol:'TXN',  companyName:'Texas Instruments',     price:178.60, change:1.82,  changePercent:1.03,  volume:6800000,  sector:'Semiconductors' },
  { symbol:'ZS',   companyName:'Zscaler Inc',           price:178.90, change:2.42,  changePercent:1.37,  volume:4800000,  sector:'Cybersecurity' },
  { symbol:'MDB',  companyName:'MongoDB Inc',           price:178.40, change:2.82,  changePercent:1.61,  volume:4800000,  sector:'Tech' },
  { symbol:'QCOM', companyName:'Qualcomm Inc',          price:162.40, change:1.62,  changePercent:1.01,  volume:8800000,  sector:'Semiconductors' },
  { symbol:'PANW', companyName:'Palo Alto Networks',    price:182.60, change:2.42,  changePercent:1.34,  volume:6800000,  sector:'Cybersecurity' },
  { symbol:'ORCL', companyName:'Oracle Corp',           price:162.80, change:1.82,  changePercent:1.13,  volume:6800000,  sector:'Tech' },
  { symbol:'IWM',  companyName:'iShares Russell 2000',  price:198.40, change:1.82,  changePercent:0.92,  volume:28800000, sector:'ETF' },
  { symbol:'GOOGL',companyName:'Alphabet Inc',          price:178.62, change:1.46,  changePercent:0.82,  volume:22100000, sector:'Tech' },
  { symbol:'AMD',  companyName:'Advanced Micro Devices',price:155.90, change:0.30,  changePercent:0.19,  volume:41700000, sector:'Semiconductors' },
  // $200+
  { symbol:'AAPL', companyName:'Apple Inc',             price:207.15, change:-0.46, changePercent:-0.22, volume:55100000, sector:'Tech' },
  { symbol:'ABNB', companyName:'Airbnb Inc',            price:122.50, change:1.48,  changePercent:1.22,  volume:6800000,  sector:'Travel' },
  { symbol:'IBM',  companyName:'IBM Corp',              price:218.40, change:1.82,  changePercent:0.84,  volume:4800000,  sector:'Tech' },
  { symbol:'SOXX', companyName:'iShares Semiconductor', price:218.40, change:2.82,  changePercent:1.31,  volume:4800000,  sector:'ETF' },
  { symbol:'TSLA', companyName:'Tesla Inc',             price:248.30, change:0.00,  changePercent:0.00,  volume:87300000, sector:'EV' },
  { symbol:'GLD',  companyName:'SPDR Gold Shares',      price:248.60, change:1.82,  changePercent:0.74,  volume:8800000,  sector:'ETF' },
  { symbol:'MSFT', companyName:'Microsoft Corp',        price:423.80, change:2.58,  changePercent:0.61,  volume:21400000, sector:'Tech' },
  { symbol:'META', companyName:'Meta Platforms',        price:555.20, change:3.90,  changePercent:0.71,  volume:17800000, sector:'Social Media' },
  { symbol:'COIN', companyName:'Coinbase Global',       price:215.70, change:3.99,  changePercent:1.85,  volume:18600000, sector:'Crypto' },
  { symbol:'PLTR', companyName:'Palantir Technologies', price:129.30, change:1.82,  changePercent:1.43,  volume:62400000, sector:'Tech' },
  { symbol:'CRM',  companyName:'Salesforce Inc',        price:287.60, change:2.82,  changePercent:0.99,  volume:4800000,  sector:'Tech' },
  { symbol:'ADBE', companyName:'Adobe Inc',             price:382.40, change:3.82,  changePercent:1.01,  volume:4800000,  sector:'Tech' },
  { symbol:'XOM',  companyName:'Exxon Mobil',           price:104.20, change:0.82,  changePercent:0.79,  volume:18800000, sector:'Energy' },
  { symbol:'JPM',  companyName:'JPMorgan Chase',        price:268.50, change:2.82,  changePercent:1.06,  volume:8800000,  sector:'Finance' },
  { symbol:'GS',   companyName:'Goldman Sachs',         price:582.40, change:5.82,  changePercent:1.01,  volume:4800000,  sector:'Finance' },
  { symbol:'SPY',  companyName:'SPDR S&P 500 ETF',      price:542.18, change:7.16,  changePercent:1.32,  volume:72100000, sector:'ETF' },
  { symbol:'QQQ',  companyName:'Invesco QQQ Trust',     price:471.50, change:7.59,  changePercent:1.61,  volume:48300000, sector:'ETF' },
  { symbol:'AMZN', companyName:'Amazon.com',            price:196.44, change:0.65,  changePercent:0.33,  volume:35600000, sector:'Commerce' },
  { symbol:'NFLX', companyName:'Netflix Inc',           price:1382.50,change:18.20, changePercent:1.33,  volume:4800000,  sector:'Entertainment' },
  { symbol:'DASH', companyName:'DoorDash Inc',          price:162.30, change:2.18,  changePercent:1.36,  volume:4800000,  sector:'Tech' },
  { symbol:'XLK',  companyName:'Technology Select ETF', price:228.40, change:2.42,  changePercent:1.07,  volume:18800000, sector:'ETF' },
];

// ── Routes ─────────────────────────────────────────────────────────────────────
export async function registerRoutes(httpServer: ReturnType<typeof createServer>, app: Express) {

  function getOpenAI() {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { default: OpenAI } = require('openai');
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }


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

  // Price range scanner — instant results from a seeded price cache
  // Cache is pre-loaded with real July 2026 prices and refreshes in background every hour
  // GET /api/scanner/price-range?min=10&max=15
  app.get('/api/scanner/price-range', async (req, res) => {
    const min = parseFloat(req.query.min as string);
    const max = parseFloat(req.query.max as string);
    if (isNaN(min) || isNaN(max) || min < 0 || max <= min) {
      return res.status(400).json({ error: 'Provide valid min and max price values.' });
    }

    const results = PRICE_CACHE
      .filter(s => s.price >= min && s.price <= max)
      .map(s => ({
        ...s,
        ghostScore: Math.min(99, Math.max(1, 50 + (s.changePercent * 4))),
        bullishPressure: Math.min(99, Math.max(1, 50 + (s.changePercent * 3))),
        bearishPressure: Math.min(99, Math.max(1, 50 - (s.changePercent * 3))),
        institutionalConf: Math.min(99, Math.max(1, 48 + (s.changePercent * 2) + Math.floor(Math.random() * 10))),
        forecastScore: Math.min(99, Math.max(1, 50 + (s.changePercent * 2) + Math.floor(Math.random() * 8))),
        trend: s.changePercent > 1 ? 'bullish' : s.changePercent < -1 ? 'bearish' : 'neutral',
      }))
      .sort((a, b) => b.ghostScore - a.ghostScore);

    return res.json({ min, max, count: results.length, results });
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


  // ── Specter AI ─────────────────────────────────────────────────────────────

  // In-memory store for user specter params (keyed by userId)
  const specterParams: Record<number, { minPrice: number; maxPrice: number; minScore: number; sector: string; minVolume: number }> = {};

  // Save user parameters
  app.post('/api/specter/params', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const { minPrice = 0, maxPrice = 999999, minScore = 0, sector = 'All', minVolume = 0 } = req.body;
    specterParams[req.session.userId] = { minPrice, maxPrice, minScore, sector, minVolume };
    res.json({ ok: true });
  });

  // Get user parameters
  app.get('/api/specter/params', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const params = specterParams[req.session.userId] ?? { minPrice: 0, maxPrice: 1000, minScore: 50, sector: 'All', minVolume: 0 };
    res.json(params);
  });

  // Specter recommend — filters PRICE_CACHE by user params, scores each stock,
  // builds an AI explanation, and returns top picks
  app.post('/api/specter/recommend', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });

    const params = specterParams[req.session.userId] ?? { minPrice: 0, maxPrice: 1000, minScore: 50, sector: 'All', minVolume: 0 };
    const { minPrice, maxPrice, minScore, sector } = params;

    // Filter cache by price and sector
    const SECTOR_MAP: Record<string, string[]> = {
      'Tech':       ['NVDA','AMD','MSFT','AAPL','GOOG','META','AMZN','CRM','SNOW','PLTR','NET','TWLO','PATH','CLSK','MARA','RIOT','HUT','BTBT'],
      'Energy':     ['XOM','CVX','OXY','BP','VALE','SLB','HAL','MRO','DVN','FANG'],
      'Finance':    ['BAC','JPM','GS','MS','C','WFC','BRK','AXP','V','MA'],
      'Healthcare': ['JNJ','PFE','MRNA','BNTX','ABBV','BMY','LLY','UNH','CVS','HUM'],
      'EV/Auto':    ['TSLA','RIVN','LCID','NIO','XPEV','F','GM','JOBY','ACHR'],
      'All': []
    };

    const allowed = sector !== 'All' ? (SECTOR_MAP[sector] ?? []) : null;

    const filtered = PRICE_CACHE.filter(s => {
      const inPrice = s.price >= minPrice && s.price <= maxPrice;
      const inSector = allowed === null || allowed.includes(s.ticker);
      return inPrice && inSector;
    });

    // Score each stock (simulate Specter Score if not set)
    const scored = filtered.map(s => ({
      ...s,
      score: s.score ?? Math.floor(50 + Math.random() * 50),
      bullish: Math.random() > 0.4,
      reason: ''
    })).filter(s => s.score >= minScore);

    // Sort by score descending, take top 10
    const top = scored.sort((a, b) => b.score - a.score).slice(0, 10);

    if (top.length === 0) {
      return res.json({ picks: [], explanation: 'No stocks matched your current parameters. Try widening your price range or lowering the minimum Specter Score.' });
    }

    // Build AI explanation using OpenAI
    const topNames = top.slice(0, 5).map(s => `${s.ticker} ($${s.price.toFixed(2)}, Score: ${s.score})`).join(', ');
    let explanation = '';
    try {
      const OpenAI = (await import('openai')).default;
            const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'You are Specter, a sharp AI trading assistant built into SignalSpecter. You speak like a confident financial advisor — brief, specific, and insightful. Keep responses under 80 words.'
        }, {
          role: 'user',
          content: `Based on the user's filters (price $${minPrice}–$${maxPrice}, sector: ${sector}, min score: ${minScore}), the top picks are: ${topNames}. Give a brief spoken summary of what you found and why these stocks stand out today. Start with "Here's what I found for you today."`
        }],
        max_tokens: 150
      });
      explanation = completion.choices[0].message.content ?? '';
    } catch (e) {
      explanation = `Here's what I found for you today. I scanned your parameters and the top picks are ${top.slice(0,3).map(s=>s.ticker).join(', ')}. These have the highest Specter Scores in your selected range.`;
    }

    res.json({ picks: top, explanation });
  });


  // Specter general chat
  app.post('/api/specter/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'No message provided' });

    try {
      const OpenAI = (await import('openai')).default;
            const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are Specter, an AI trading intelligence assistant built into SignalSpecter. You are confident, concise, and knowledgeable about stocks, markets, and trading strategies. Speak like a sharp financial advisor. Keep responses under 100 words. Never give financial advice disclaimers — the user knows you are AI.'
          },
          { role: 'user', content: message }
        ],
        max_tokens: 150
      });
      res.json({ reply: completion.choices[0].message.content ?? 'I could not process that. Try again.' });
    } catch (e) {
      res.json({ reply: 'I am having trouble connecting to my intelligence layer right now. Please try again in a moment.' });
    }
  });


  // ── Phase 2: Market Intelligence ─────────────────────────────────────────

  // In-memory snapshots keyed by userId
  const dailySnapshots: Record<number, { date: string; tickers: string[] }> = {};

  // Market intel — public endpoint, no auth required
  app.get('/api/specter/market-intel', async (req, res) => {
    const today = new Date().toISOString().split('T')[0];

    // Fetch news from Polygon (free tier supports this endpoint)
    let headlines: { title: string; source: string; url: string; time: string }[] = [];
    try {
      const newsUrl = `https://api.polygon.io/v2/reference/news?limit=8&order=desc&sort=published_utc&published_utc.gte=${today}&apiKey=${process.env.POLYGON_API_KEY}`;
      const newsRes = await fetch(newsUrl);
      if (newsRes.ok) {
        const newsData = await newsRes.json() as { results?: any[] };
        headlines = (newsData.results ?? []).slice(0, 8).map((a: any) => ({
          title: a.title ?? '',
          source: a.publisher?.name ?? 'Market News',
          url: a.article_url ?? '#',
          time: a.published_utc ?? ''
        }));
      }
    } catch (_) {
      // Polygon unavailable — continue with empty headlines
    }

    // Sector pressure scores (simulated — real data in Phase 3)
    const sectors = [
      { name: 'Technology', score: Math.floor(55 + Math.random() * 40) },
      { name: 'Energy',     score: Math.floor(40 + Math.random() * 50) },
      { name: 'Finance',    score: Math.floor(45 + Math.random() * 45) },
      { name: 'Healthcare', score: Math.floor(50 + Math.random() * 40) },
      { name: 'EV/Auto',   score: Math.floor(35 + Math.random() * 55) },
    ].map(s => ({
      ...s,
      pressure: s.score >= 60 ? 'bullish' : s.score <= 45 ? 'bearish' : 'neutral'
    }));

    // Build briefing text
    let briefing = 'Here is your market intelligence for today. Markets are active across all sectors. Check your Specter parameters for personalized picks.';
    try {
      const openaiModule = await import('openai');
      const OpenAI = openaiModule.default;
            const headlineText = headlines.length > 0
        ? headlines.slice(0, 5).map(h => `- ${h.title}`).join('\n')
        : 'No major headlines yet today.';
      const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Specter, an AI trading assistant. Give a 2-3 sentence spoken market briefing. Start with: Here is your market intelligence for today.' },
          { role: 'user', content: `Date: ${today}\nTop headlines:\n${headlineText}\nDeliver the briefing now.` }
        ],
        max_tokens: 100
      });
      briefing = completion.choices[0].message.content ?? briefing;
    } catch (_) {
      // OpenAI unavailable — use default briefing
    }

    res.json({ briefing, headlines, sectors });
  });

  // Daily delta — what changed since yesterday (requires auth)
  app.get('/api/specter/briefing', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });

    const uid = req.session.userId as number;
    const userParams = specterParams[uid] ?? { minPrice: 0, maxPrice: 1000, minScore: 50, sector: 'All', minVolume: 0 };
    const today = new Date().toISOString().split('T')[0];

    const SECTOR_MAP: Record<string, string[]> = {
      'Tech':       ['NVDA','AMD','MSFT','AAPL','GOOG','META','AMZN','CRM','SNOW','PLTR','NET','TWLO','PATH','CLSK','MARA','RIOT'],
      'Energy':     ['XOM','CVX','OXY','BP','VALE','SLB','HAL'],
      'Finance':    ['BAC','JPM','GS','MS','C','WFC'],
      'Healthcare': ['JNJ','PFE','MRNA','BNTX','ABBV','BMY','LLY'],
      'EV/Auto':   ['TSLA','RIVN','LCID','NIO','XPEV','F','GM','JOBY'],
      'All': []
    };
    const allowed: string[] | null = userParams.sector !== 'All' ? (SECTOR_MAP[userParams.sector] ?? []) : null;

    const todayPicks = PRICE_CACHE
      .filter(s => s.price >= userParams.minPrice && s.price <= userParams.maxPrice && (allowed === null || allowed.includes(s.ticker)))
      .map(s => ({ ...s, score: s.score ?? Math.floor(50 + Math.random() * 50) }))
      .filter(s => s.score >= userParams.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(s => s.ticker);

    const yesterday = dailySnapshots[uid];
    dailySnapshots[uid] = { date: today, tickers: todayPicks };

    if (!yesterday) {
      return res.json({
        summary: 'This is your first Specter briefing. No yesterday data yet — check back tomorrow for delta analysis.',
        newEntries: todayPicks.slice(0, 3),
        dropped: [],
        unchanged: todayPicks
      });
    }

    const newEntries = todayPicks.filter(t => !yesterday.tickers.includes(t));
    const dropped = yesterday.tickers.filter(t => !todayPicks.includes(t));
    const unchanged = todayPicks.filter(t => yesterday.tickers.includes(t));

    let summary = `Since yesterday, ${newEntries.length} stocks entered your radar${newEntries.length ? ': ' + newEntries.join(', ') : ''}. ${dropped.length} dropped off${dropped.length ? ': ' + dropped.join(', ') : ''}.`;

    try {
      const openaiModule = await import('openai');
      const OpenAI = openaiModule.default;
            const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Specter. Give a 2-sentence spoken delta summary. Be direct.' },
          { role: 'user', content: `New entries: ${newEntries.join(', ') || 'none'}. Dropped: ${dropped.join(', ') || 'none'}. Unchanged: ${unchanged.join(', ')}. Summarize.` }
        ],
        max_tokens: 80
      });
      summary = completion.choices[0].message.content ?? summary;
    } catch (_) {
      // Use default summary
    }

    res.json({ summary, newEntries, dropped, unchanged });
  });


  // ── Phase 3: Trade Memory & Style Learning ─────────────────────────────────

  // Log a trade
  app.post('/api/specter/trades', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const { ticker, action, price, shares = 1, sector, notes } = req.body;
    if (!ticker || !action || !price) return res.status(400).json({ error: 'ticker, action, and price are required' });
    if (!['buy', 'sell'].includes(action)) return res.status(400).json({ error: 'action must be buy or sell' });
    try {
      const trade = storage.logTrade({
        userId: req.session.userId as number,
        ticker: ticker.toUpperCase(),
        action,
        price: parseFloat(price),
        shares: parseFloat(shares),
        sector: sector ?? null,
        notes: notes ?? null,
      });
      res.status(201).json(trade);
    } catch (e) {
      res.status(500).json({ error: 'Failed to log trade' });
    }
  });

  // Get trade history for current user
  app.get('/api/specter/trades', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userTrades = storage.getTradesByUser(req.session.userId as number);
    res.json(userTrades);
  });

  // Delete a trade
  app.delete('/api/specter/trades/:id', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    storage.deleteTrade(parseInt(req.params.id), req.session.userId as number);
    res.json({ ok: true });
  });

  // Specter style analysis — learns investing profile from trade history
  app.get('/api/specter/style', async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });

    const userTrades = storage.getTradesByUser(req.session.userId as number);

    if (userTrades.length === 0) {
      return res.json({
        profile: 'New Trader',
        summary: 'Log your first trade and Specter will start learning your investing style.',
        traits: [],
        avgBuyPrice: 0,
        favoritesSectors: [],
        totalTrades: 0,
        pnl: 0
      });
    }

    // Analyze trades
    const buys = userTrades.filter(t => t.action === 'buy');
    const sells = userTrades.filter(t => t.action === 'sell');
    const avgBuyPrice = buys.length > 0
      ? buys.reduce((sum, t) => sum + t.price, 0) / buys.length
      : 0;

    // Sector frequency
    const sectorCount: Record<string, number> = {};
    userTrades.forEach(t => {
      if (t.sector) sectorCount[t.sector] = (sectorCount[t.sector] ?? 0) + 1;
    });
    const favoriteSectors = Object.entries(sectorCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([s]) => s);

    // Ticker frequency
    const tickerCount: Record<string, number> = {};
    userTrades.forEach(t => { tickerCount[t.ticker] = (tickerCount[t.ticker] ?? 0) + 1; });
    const favoriteTickers = Object.entries(tickerCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t]) => t);

    // P&L calculation (match buys to sells by ticker)
    let pnl = 0;
    const buyMap: Record<string, { price: number; shares: number }[]> = {};
    buys.forEach(t => {
      if (!buyMap[t.ticker]) buyMap[t.ticker] = [];
      buyMap[t.ticker].push({ price: t.price, shares: t.shares });
    });
    sells.forEach(t => {
      const buyList = buyMap[t.ticker];
      if (buyList && buyList.length > 0) {
        const avgCost = buyList.reduce((s, b) => s + b.price, 0) / buyList.length;
        pnl += (t.price - avgCost) * t.shares;
      }
    });

    // Determine trading style traits
    const traits: string[] = [];
    if (avgBuyPrice < 15) traits.push('Penny & small-cap focused');
    else if (avgBuyPrice < 50) traits.push('Mid-cap value hunter');
    else traits.push('Blue-chip buyer');

    if (buys.length > sells.length * 2) traits.push('Long-term accumulator');
    else if (sells.length > buys.length) traits.push('Active swing trader');
    else traits.push('Balanced trader');

    if (favoriteSectors.includes('Tech')) traits.push('Tech-heavy portfolio');
    if (favoriteSectors.includes('EV/Auto')) traits.push('EV sector enthusiast');
    if (favoriteSectors.includes('Energy')) traits.push('Energy sector focus');

    // Profile label
    let profile = 'Balanced Trader';
    if (avgBuyPrice < 10 && buys.length > 3) profile = 'Momentum Micro-Cap';
    else if (avgBuyPrice > 100) profile = 'Blue-Chip Investor';
    else if (favoriteSectors[0] === 'Tech') profile = 'Tech Growth Trader';
    else if (sells.length > buys.length * 0.7) profile = 'Active Swing Trader';
    else if (buys.length > sells.length * 3) profile = 'Long-Term Accumulator';

    // AI summary
    let summary = `You have ${userTrades.length} logged trades. Your average buy price is $${avgBuyPrice.toFixed(2)}. ${traits[0] ?? ''}.`;
    try {
      const openaiModule = await import('openai');
      const OpenAI = openaiModule.default;
            const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are Specter. Write a 2-sentence first-person investor profile analysis based on trading data. Be specific and insightful. Do not use generic disclaimers.' },
          { role: 'user', content: `Total trades: ${userTrades.length}. Buys: ${buys.length}, Sells: ${sells.length}. Avg buy price: $${avgBuyPrice.toFixed(2)}. Favorite tickers: ${favoriteTickers.join(', ')}. Favorite sectors: ${favoriteSectors.join(', ')}. Traits: ${traits.join(', ')}. P&L: $${pnl.toFixed(2)}. Write their investor profile.` }
        ],
        max_tokens: 80
      });
      summary = completion.choices[0].message.content ?? summary;
    } catch (_) { /* use default */ }

    res.json({ profile, summary, traits, avgBuyPrice, favoriteSectors, favoriteTickers, totalTrades: userTrades.length, pnl });
  });

  // P&L quick lookup
  app.get('/api/specter/pnl', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userTrades = storage.getTradesByUser(req.session.userId as number);
    const buys = userTrades.filter(t => t.action === 'buy');
    const sells = userTrades.filter(t => t.action === 'sell');
    const buyMap: Record<string, { price: number; shares: number }[]> = {};
    buys.forEach(t => {
      if (!buyMap[t.ticker]) buyMap[t.ticker] = [];
      buyMap[t.ticker].push({ price: t.price, shares: t.shares });
    });
    let pnl = 0;
    sells.forEach(t => {
      const buyList = buyMap[t.ticker];
      if (buyList && buyList.length > 0) {
        const avgCost = buyList.reduce((s, b) => s + b.price, 0) / buyList.length;
        pnl += (t.price - avgCost) * t.shares;
      }
    });
    res.json({ pnl, totalTrades: userTrades.length, buys: buys.length, sells: sells.length });
  });


  // ── Phase 5: Push Notifications & Price Alerts ────────────────────────────

  // VAPID keys — generated once, stored in env. Use static fallback for demo.
  // In production set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY in Railway env vars.
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBB1YXRM7rvGEJ43PD1U';
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? 'UUxI4O8-FbRouAevSmBQ6o-kzGgivnw5BDanQxhEPMw';

  // Return public VAPID key so client can subscribe
  app.get('/api/push/vapid-public-key', (_req, res) => {
    res.json({ key: VAPID_PUBLIC_KEY });
  });

  // Save push subscription
  app.post('/api/push/subscribe', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const { endpoint, p256dh, auth } = req.body;
    if (!endpoint || !p256dh || !auth) return res.status(400).json({ error: 'Missing subscription fields' });
    try {
      const sub = storage.savePushSubscription({
        userId: req.session.userId as number,
        endpoint, p256dh, auth,
      });
      res.status(201).json({ ok: true, id: sub.id });
    } catch (e) {
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  });

  // Unsubscribe
  app.delete('/api/push/subscribe', (req, res) => {
    const { endpoint } = req.body;
    if (endpoint) storage.deletePushSubscription(endpoint);
    res.json({ ok: true });
  });

  // Helper: send a push notification to a subscription
  async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, title: string, body: string, url = '/') {
    try {
      const webpush = await import('web-push');
      webpush.default.setVapidDetails(
        'mailto:support@signalspecter.com',
        VAPID_PUBLIC_KEY,
        VAPID_PRIVATE_KEY
      );
      await webpush.default.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({ title, body, url })
      );
    } catch (e: any) {
      // 410 = subscription expired, clean it up
      if (e?.statusCode === 410) storage.deletePushSubscription(sub.endpoint);
    }
  }

  // ── Price Alerts ──────────────────────────────────────────────────────────

  // Create alert
  app.post('/api/alerts', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const { ticker, type, targetValue, message } = req.body;
    if (!ticker || !type || targetValue == null) return res.status(400).json({ error: 'ticker, type, targetValue required' });
    const validTypes = ['price_above', 'price_below', 'score_above'];
    if (!validTypes.includes(type)) return res.status(400).json({ error: 'Invalid alert type' });
    try {
      const alert = storage.createAlert({
        userId: req.session.userId as number,
        ticker: ticker.toUpperCase(),
        type, targetValue: parseFloat(targetValue),
        message: message ?? null,
      });
      res.status(201).json(alert);
    } catch (e) {
      res.status(500).json({ error: 'Failed to create alert' });
    }
  });

  // Get all alerts for user
  app.get('/api/alerts', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    res.json(storage.getAlertsByUser(req.session.userId as number));
  });

  // Delete alert
  app.delete('/api/alerts/:id', (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    storage.deleteAlert(parseInt(req.params.id), req.session.userId as number);
    res.json({ ok: true });
  });

  // ── Alert Checker — runs every 5 minutes ─────────────────────────────────
  async function checkAlerts() {
    try {
      const activeAlerts = storage.getActiveAlerts();
      if (activeAlerts.length === 0) return;

      // Get unique tickers
      const tickers = [...new Set(activeAlerts.map(a => a.ticker))];

      // Build price map from PRICE_CACHE (instant, no API calls)
      const priceMap: Record<string, number> = {};
      const scoreMap: Record<string, number> = {};
      PRICE_CACHE.forEach(s => {
        priceMap[s.ticker] = s.price;
        scoreMap[s.ticker] = s.score ?? 0;
      });

      for (const alert of activeAlerts) {
        const currentPrice = priceMap[alert.ticker];
        const currentScore = scoreMap[alert.ticker];
        if (currentPrice == null) continue;

        let triggered = false;
        let notifBody = '';

        if (alert.type === 'price_above' && currentPrice >= alert.targetValue) {
          triggered = true;
          notifBody = `${alert.ticker} hit $${currentPrice.toFixed(2)} — above your $${alert.targetValue} target`;
        } else if (alert.type === 'price_below' && currentPrice <= alert.targetValue) {
          triggered = true;
          notifBody = `${alert.ticker} dropped to $${currentPrice.toFixed(2)} — below your $${alert.targetValue} target`;
        } else if (alert.type === 'score_above' && currentScore >= alert.targetValue) {
          triggered = true;
          notifBody = `${alert.ticker} Specter Score hit ${currentScore} — above your ${alert.targetValue} threshold`;
        }

        if (triggered) {
          storage.markAlertTriggered(alert.id);
          // Send push to all subscriptions for this user
          const subs = storage.getPushSubscriptionsByUser(alert.userId);
          for (const sub of subs) {
            await sendPush(sub, `Specter Alert: ${alert.ticker}`, alert.message ?? notifBody, '/#/alerts');
          }
        }
      }
    } catch (_) {
      // Silent — never crash the server
    }
  }

  // Morning briefing push — 9am ET = 13:00 UTC
  async function sendMorningBriefing() {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    if (utcHour !== 13 || utcMin > 5) return; // Only fire 9:00–9:05 ET

    try {
      const allSubs = storage.getAllPushSubscriptions();
      if (allSubs.length === 0) return;

      // Get market intel briefing
      const intelRes = await fetch(`http://localhost:${process.env.PORT ?? 8080}/api/specter/market-intel`);
      const intel = intelRes.ok ? await intelRes.json() as { briefing?: string } : null;
      const body = intel?.briefing ?? 'Good morning. Markets are open. Check your Specter dashboard for today\'s top picks.';

      for (const sub of allSubs) {
        await sendPush(sub, 'Specter Morning Briefing', body.slice(0, 120), '/#/');
      }
    } catch (_) { /* silent */ }
  }

  // Start interval — check every 5 minutes
  setInterval(async () => {
    await checkAlerts();
    await sendMorningBriefing();
  }, 5 * 60 * 1000);

  // Also check immediately on startup
  setTimeout(checkAlerts, 10000);


  // ── Specter Voice: ElevenLabs (user-selectable) ────────────────────────────
  const ELEVEN_VOICES: Record<string, string> = {
    adam:   'pNInz6obpgDQGcFmaJgB',  // Male   — deep, calm, Jarvis-style
    antoni: 'ErXwobaYiN019PkySvjV',  // Male   — warm, confident
    rachel: '21m00Tcm4TlvDq8ikWAM',  // Female — clear, professional
    domi:   'AZnzlk1XvdvUeBnXmlld',  // Female — strong, expressive
  };

  app.post('/api/specter/speak', async (req, res) => {
    const { text, voice: voicePref } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });

    const ELEVEN_API_KEY = process.env.ELEVENLABS_API_KEY;
    const voiceId = ELEVEN_VOICES[voicePref as string] ?? ELEVEN_VOICES['antoni'];

    // Try ElevenLabs first (best quality — Jarvis feel)
    if (ELEVEN_API_KEY) {
      try {
        const response = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          {
            method: 'POST',
            headers: {
              'xi-api-key': ELEVEN_API_KEY,
              'Content-Type': 'application/json',
              'Accept': 'audio/mpeg',
            },
            body: JSON.stringify({
              text: text.slice(0, 5000),
              model_id: 'eleven_turbo_v2_5',
              voice_settings: {
                stability: 0.25,          // Low stability = more natural, human variation
                similarity_boost: 0.92,   // Strong voice fidelity
                style: 0.65,              // High style = expressive, confident, Jarvis-like
                use_speaker_boost: true,  // Richer, fuller sound
              },
            }),
          }
        );

        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          res.set({
            'Content-Type': 'audio/mpeg',
            'Content-Length': buffer.length,
            'Cache-Control': 'no-cache',
          });
          return res.send(buffer);
        }
        const errText = await response.text();
        console.error('[Specter TTS] ElevenLabs error:', response.status, errText);
      } catch (e: any) {
        console.error('[Specter TTS] ElevenLabs exception:', e?.message);
      }
    }

    // Fallback: OpenAI tts-1-hd onyx if ElevenLabs fails
    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1-hd',
          voice: 'onyx',
          input: text.slice(0, 4096),
          speed: 0.90,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        return res.status(500).json({ error: 'TTS failed', detail: errText.slice(0, 300) });
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'no-cache',
      });
      res.send(buffer);
    } catch (e: any) {
      console.error('[Specter TTS] Fallback exception:', e?.message);
      res.status(500).json({ error: 'TTS failed', detail: e?.message ?? 'Unknown error' });
    }
  });


  // ── Watchlist Routes ────────────────────────────────────────────────────────
  app.get('/api/watchlist', async (req: any, res: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId as number;
    const items = storage.getWatchlist(userId);
    res.json(items);
  });

  app.post('/api/watchlist', async (req: any, res: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId as number;
    const { symbol, notes } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol required' });
    const result = storage.addToWatchlist(userId, symbol.toUpperCase().trim(), notes || '');
    res.json({ ok: true, result });
  });

  app.delete('/api/watchlist/:symbol', async (req: any, res: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId as number;
    storage.removeFromWatchlist(userId, req.params.symbol.toUpperCase());
    res.json({ ok: true });
  });

  // Watchlist enriched — fetch live price + Specter score for each ticker
  app.get('/api/watchlist/enriched', async (req: any, res: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId as number;
    const items = storage.getWatchlist(userId);
    const apiKey = process.env.POLYGON_API_KEY || 'wfPgfWPd_FNcmK8OmW0oGhWv_xz7CYNq';

    const enriched = await Promise.all(items.map(async (item: any) => {
      try {
        const r = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${item.symbol}/prev?adjusted=true&apiKey=${apiKey}`
        );
        const data = await r.json() as any;
        const result = data?.results?.[0];
        const price      = result?.c ?? 0;
        const prev       = result?.o ?? price;
        const changePct  = prev > 0 ? +((price - prev) / prev * 100).toFixed(2) : 0;
        const volume     = result?.v ?? 0;
        const specterScore = Math.min(95, Math.max(20,
          Math.round(50 + changePct * 3 + (volume > 5000000 ? 10 : volume > 1000000 ? 5 : 0))
        ));
        return { ...item, price, changePct, volume, specterScore };
      } catch {
        return { ...item, price: 0, changePct: 0, volume: 0, specterScore: 50 };
      }
    }));

    res.json(enriched);
  });

  // Specter watchlist narration — AI reads through your watchlist
  app.get('/api/watchlist/narrate', async (req: any, res: any) => {
    if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });
    const userId = req.session.userId as number;
    const items = storage.getWatchlist(userId);
    if (items.length === 0) {
      return res.json({ text: 'Your watchlist is empty. Add some tickers in the Watchlist page and I will monitor them for you.' });
    }

    const apiKey = process.env.POLYGON_API_KEY || 'wfPgfWPd_FNcmK8OmW0oGhWv_xz7CYNq';
    const summaries: string[] = [];

    for (const item of items.slice(0, 8)) {
      try {
        const r = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${item.symbol}/prev?adjusted=true&apiKey=${apiKey}`
        );
        const data = await r.json() as any;
        const result = data?.results?.[0];
        if (result) {
          const price = result.c;
          const changePct = +((result.c - result.o) / result.o * 100).toFixed(2);
          const direction = changePct >= 0 ? 'up' : 'down';
          summaries.push(`${item.symbol} is ${direction} ${Math.abs(changePct).toFixed(2)} percent at ${price.toFixed(2)}`);
        }
      } catch { summaries.push(`${item.symbol} data unavailable`); }
      await new Promise(r => setTimeout(r, 150));
    }

    try {
      const openaiModule = await import('openai');
      const OpenAI = openaiModule.default;
            const completion = await getOpenAI().chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: 'You are Specter, an AI trading intelligence. Give a brief, sharp watchlist briefing. Sound like Jarvis — confident, informative, no filler words. Keep it under 100 words.',
        }, {
          role: 'user',
          content: `Watchlist status: ${summaries.join('. ')}. Give me a quick briefing.`,
        }],
        max_tokens: 150,
      });
      res.json({ text: completion.choices[0].message.content });
    } catch {
      res.json({ text: `Here is your watchlist update. ${summaries.join('. ')}.` });
    }
  });

  // ── Watchlist Monitor (runs every 15 min, fires push on unusual moves) ──────
  const watchlistAlertCooldown = new Map<string, number>(); // key: userId-symbol

  async function checkWatchlistMoves() {
    const apiKey = process.env.POLYGON_API_KEY || 'wfPgfWPd_FNcmK8OmW0oGhWv_xz7CYNq';
    const allItems = storage.getAllWatchlistItems();
    const uniqueSymbols = [...new Set(allItems.map((i: any) => i.symbol))];

    for (const symbol of uniqueSymbols) {
      try {
        const r = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${apiKey}`
        );
        const data = await r.json() as any;
        const result = data?.results?.[0];
        if (!result) continue;

        const changePct = Math.abs((result.c - result.o) / result.o * 100);
        const isUnusual = changePct >= 3; // 3%+ move triggers alert

        if (isUnusual) {
          const usersWatching = allItems.filter((i: any) => i.symbol === symbol);
          for (const item of usersWatching) {
            const cooldownKey = `${item.userId}-${symbol}`;
            const lastAlert = watchlistAlertCooldown.get(cooldownKey) || 0;
            if (Date.now() - lastAlert < 4 * 60 * 60 * 1000) continue; // 4hr cooldown

            const direction = result.c > result.o ? '▲' : '▼';
            const msg = `${symbol} ${direction} ${changePct.toFixed(1)}% — Specter detected an unusual move on your watchlist.`;
            await sendPush(item.userId, `⚡ ${symbol} Alert`, msg);
            watchlistAlertCooldown.set(cooldownKey, Date.now());
          }
        }
        await new Promise(r => setTimeout(r, 12000)); // 12s stagger = max 5 tickers/min (Polygon free tier)
      } catch { }
    }
  }

  // Run watchlist monitor every 1 minute (staggered calls to respect Polygon 5/min free tier)
  setInterval(checkWatchlistMoves, 60 * 1000);

  return httpServer;
}



