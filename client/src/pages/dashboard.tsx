import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useState, useEffect, useRef } from 'react';
import { TrendingUp, TrendingDown, Activity, Search, Wifi } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import type { Stock } from '@shared/schema';

// ── Live price hook via WebSocket ──────────────────────────────────────────
type PriceData = { price: number; change: number; changePct: number; prev: number };
type PriceMap  = Record<string, PriceData>;

function useLivePrices(): { prices: PriceMap; connected: boolean } {
  const [prices, setPrices] = useState<PriceMap>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Initial REST load so prices show instantly before WS connects
    fetch('/api/prices/live')
      .then(r => r.json())
      .then(d => { if (d.prices) setPrices(d.prices); })
      .catch(() => {});

    // Connect WebSocket
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws/prices`);
    wsRef.current = ws;

    ws.onopen  = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'price_update') {
          setPrices(prev => ({ ...prev, ...msg.data }));
        }
      } catch (_) {}
    };

    return () => { ws.close(); };
  }, []);

  return { prices, connected };
}

// ── Flash on price change ──────────────────────────────────────────────────
function useFlash(value: number) {
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    setFlash(value > prev.current ? 'up' : 'down');
    prev.current = value;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [value]);
  return flash;
}

// ── Live price cell (flashes green/red on change) ─────────────────────────
function LivePrice({ ticker, prices }: { ticker: string; prices: PriceMap }) {
  const data = prices[ticker];
  const price = data?.price ?? 0;
  const flash = useFlash(price);
  const bg = flash === 'up' ? 'rgba(0,255,136,0.18)' : flash === 'down' ? 'rgba(255,68,68,0.18)' : 'transparent';
  return (
    <span
      className="tabular font-bold transition-colors duration-300 rounded px-1"
      style={{ color: '#fff', background: bg }}
    >
      {price > 0 ? `$${price.toFixed(2)}` : '—'}
    </span>
  );
}

// ── Scrolling ticker bar ───────────────────────────────────────────────────
const TICKER_SYMBOLS = ['SPY','QQQ','NVDA','AAPL','MSFT','TSLA','AMZN','META','GOOGL','AMD','PLTR','COIN','MARA','SOFI','HOOD','MSTR'];

function TickerBar({ prices }: { prices: PriceMap }) {
  const items = [...TICKER_SYMBOLS, ...TICKER_SYMBOLS]; // doubled for seamless loop
  return (
    <div className="overflow-hidden flex-shrink-0" style={{ background: '#080C10', borderBottom: '1px solid #1a2332', height: 32 }}>
      <div className="ticker-scroll flex items-center h-full gap-6 whitespace-nowrap">
        {items.map((sym, i) => {
          const d = prices[sym];
          const up = (d?.changePct ?? 0) >= 0;
          return (
            <span key={`${sym}-${i}`} className="text-xs flex items-center gap-1.5">
              <span className="font-bold" style={{ color: '#00FF88' }}>{sym}</span>
              <span className="tabular" style={{ color: '#fff' }}>
                {d?.price ? `$${d.price.toFixed(2)}` : '—'}
              </span>
              <span className="tabular text-xs" style={{ color: up ? '#00FF88' : '#FF4444' }}>
                {d ? `${up ? '▲' : '▼'} ${Math.abs(d.changePct).toFixed(2)}%` : ''}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────
function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? '#00FF88' : score >= 45 ? '#F59E0B' : '#FF4444';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full h-1.5" style={{ background: '#1a2332' }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-xs tabular font-bold w-6 text-right" style={{ color }}>{Math.round(score)}</span>
    </div>
  );
}

function PctChange({ value }: { value: number }) {
  if (Math.abs(value) < 0.001)
    return <span className="text-xs tabular font-semibold" style={{ color: '#94a3b8' }}>— 0.00%</span>;
  const up = value > 0;
  return (
    <span className="text-xs tabular font-semibold" style={{ color: up ? '#00FF88' : '#FF4444' }}>
      {up ? '▲' : '▼'} {Math.abs(value).toFixed(2)}%
    </span>
  );
}

const chartData = Array.from({ length: 28 }, (_, i) => ({
  t: `${Math.floor(9.5 + i * 0.25)}:${i % 4 === 0 ? '00' : i % 4 === 1 ? '15' : i % 4 === 2 ? '30' : '45'}`,
  v: 4050 + Math.sin(i * 0.4) * 60 + i * 5 + Math.random() * 20,
}));

const sectorData = [
  { name: 'Technology',   pct: '+2.31', signal: 'bullish' },
  { name: 'Communication',pct: '+1.89', signal: 'bullish' },
  { name: 'Consumer Cyc.',pct: '+1.72', signal: 'bullish' },
  { name: 'Financial',    pct: '+1.41', signal: 'bullish' },
  { name: 'Industrials',  pct: '+0.98', signal: 'bullish' },
  { name: 'Healthcare',   pct: '+0.76', signal: 'neutral' },
  { name: 'Consumer Def.',pct: '+0.61', signal: 'neutral' },
  { name: 'Energy',       pct: '+0.32', signal: 'neutral' },
  { name: 'Utilities',    pct: '-0.12', signal: 'bearish' },
  { name: 'Real Estate',  pct: '-0.45', signal: 'bearish' },
];

const recentAlerts = [
  { symbol: 'NVDA', msg: 'Specter Score surged to 90+', time: '10:42 AM' },
  { symbol: 'RBLX', msg: 'Unusual volume detected',    time: '10:32 AM' },
  { symbol: 'SOFI', msg: 'RSI crossed above 60',       time: '10:15 AM' },
  { symbol: 'MSFT', msg: 'Institutional accumulation', time: '9:58 AM' },
];

export default function Dashboard() {
  const { prices, connected } = useLivePrices();

  const { data: topStocks = [], isLoading: loadingTop } = useQuery<Stock[]>({
    queryKey: ['/api/market/top'],
    queryFn: () => apiRequest('GET', '/api/market/top').then(r => r.json()),
    refetchInterval: 30000,
  });

  const { data: overview } = useQuery({
    queryKey: ['/api/market/overview'],
    queryFn: () => apiRequest('GET', '/api/market/overview').then(r => r.json()),
    refetchInterval: 30000,
  });

  const sortedStocks = [...topStocks].sort((a, b) => b.ghostScore - a.ghostScore);
  const leader = sortedStocks[0];

  // Merge live prices into top stocks table
  const enrichedStocks = topStocks.slice(0, 10).map(s => ({
    ...s,
    price: prices[s.symbol]?.price ?? s.price,
    changePercent: prices[s.symbol]?.changePct ?? s.changePercent,
  }));

  // Live SPY/QQQ/DIA from WS
  const liveIndices = [
    { sym: 'SPY', name: 'S&P 500 ETF' },
    { sym: 'DIA', name: 'DJIA ETF' },
    { sym: 'QQQ', name: 'NASDAQ ETF' },
  ];

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: '#0B0F14' }}>

      {/* ── Live ticker bar ──────────────────────────────────────────── */}
      <TickerBar prices={prices} />

      {/* ── Search + connection status ───────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-2 border-b flex-shrink-0"
        style={{ background: '#080C10', borderColor: '#1a2332' }}>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded"
          style={{ background: '#11161C', border: '1px solid #1a2332' }}>
          <Search size={13} style={{ color: '#4a6080' }} />
          <input
            placeholder="Search symbol..."
            className="bg-transparent outline-none text-sm w-40"
            style={{ color: '#8899aa' }}
          />
        </div>
        <div className="flex items-center gap-1.5 text-xs"
          style={{ color: connected ? '#00FF88' : '#4a6080' }}>
          <Wifi size={12} />
          <span>{connected ? 'LIVE' : 'CONNECTING...'}</span>
        </div>
      </div>

      {/* ── KPI bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-3 px-5 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #1a2332' }}>
        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: '#4a6080' }}>SPECTER SCORE LEADER</div>
          {loadingTop ? (
            <div className="skeleton h-8 w-24 mb-1" />
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-2xl font-black" style={{ color: '#00FF88', textShadow: '0 0 12px rgba(0,255,136,0.4)' }}>
                {leader?.symbol ?? 'NVDA'}
              </span>
              <span className="text-2xl font-black text-white mb-0.5">{leader ? Math.round(leader.ghostScore) : 96}</span>
            </div>
          )}
          <div className="text-xs" style={{ color: '#4a6080' }}>{leader?.companyName ?? 'NVIDIA Corporation'}</div>
          <PctChange value={prices[leader?.symbol ?? 'NVDA']?.changePct ?? leader?.changePercent ?? 4.21} />
        </div>

        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: '#4a6080' }}>MARKET HEALTH</div>
          <div className="text-xl font-black mb-1" style={{ color: '#00FF88' }}>BULLISH</div>
          <div className="text-2xl font-black text-white">{overview?.spyChange ? '72%' : '68%'}</div>
          <div className="text-xs" style={{ color: '#4a6080' }}>▲ {prices['SPY']?.changePct?.toFixed(2) ?? overview?.spyChange ?? '0.42'}% vs yesterday</div>
        </div>

        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: '#4a6080' }}>OPPORTUNITIES TODAY</div>
          <div className="text-3xl font-black text-white">28</div>
          <div className="text-xs mt-1" style={{ color: '#4a6080' }}>High conviction setups</div>
        </div>

        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: '#4a6080' }}>SCAN RESULTS</div>
          <div className="text-3xl font-black text-white">8,642</div>
          <div className="text-xs mt-1" style={{ color: '#4a6080' }}>Stocks analyzed</div>
        </div>

        <div className="kpi-card">
          <div className="text-xs mb-1" style={{ color: '#4a6080' }}>ACTIVE ALERTS</div>
          <div className="text-3xl font-black" style={{ color: '#3B82F6' }}>7</div>
          <div className="text-xs mt-1" style={{ color: '#4a6080' }}>Active alerts</div>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

        {/* Row 1: Top Opportunities + Market Overview */}
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-3 rounded" style={{ background: '#11161C', border: '1px solid #1a2332' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1a2332' }}>
              <span className="text-sm font-bold text-white uppercase tracking-wide">Top Opportunities</span>
              <div className="flex items-center gap-2">
                {connected && (
                  <span className="text-xs px-2 py-0.5 rounded animate-pulse"
                    style={{ background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}>
                    ● LIVE
                  </span>
                )}
                <button className="text-xs px-3 py-1 rounded"
                  style={{ background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}>
                  VIEW ALL
                </button>
              </div>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid #1a2332' }}>
                  {['#', 'SYMBOL', 'COMPANY', 'SPECTER SCORE', 'PRICE', 'CHANGE'].map(h => (
                    <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: '#4a6080' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingTop
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="data-table-row">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-3 py-2.5"><div className="skeleton h-3 w-16" /></td>
                        ))}
                      </tr>
                    ))
                  : enrichedStocks.map((s, i) => (
                      <tr key={s.symbol} className="data-table-row">
                        <td className="px-3 py-2.5" style={{ color: '#4a6080' }}>{i + 1}</td>
                        <td className="px-3 py-2.5 font-bold" style={{ color: '#00FF88' }}>{s.symbol}</td>
                        <td className="px-3 py-2.5" style={{ color: '#8899aa' }}>{s.companyName}</td>
                        <td className="px-3 py-2.5 w-32"><ScoreBar score={s.ghostScore} /></td>
                        <td className="px-3 py-2.5"><LivePrice ticker={s.symbol} prices={prices} /></td>
                        <td className="px-3 py-2.5"><PctChange value={s.changePercent} /></td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>

          {/* Market Overview */}
          <div className="col-span-2 rounded" style={{ background: '#11161C', border: '1px solid #1a2332' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1a2332' }}>
              <span className="text-sm font-bold text-white uppercase tracking-wide">Market Overview</span>
              <div className="flex gap-1">
                {['1D', '5D', '1M', '3M', '1Y'].map(p => (
                  <button key={p} className="text-xs px-2 py-0.5 rounded transition-colors"
                    style={{ background: p === '1D' ? 'rgba(0,255,136,0.12)' : 'transparent', color: p === '1D' ? '#00FF88' : '#4a6080' }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-3">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00FF88" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#00FF88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="t" tick={{ fill: '#4a6080', fontSize: 9 }} axisLine={false} tickLine={false} interval={6} />
                  <YAxis tick={{ fill: '#4a6080', fontSize: 9 }} axisLine={false} tickLine={false} width={38} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ background: '#11161C', border: '1px solid #1a2332', borderRadius: 4, fontSize: 11 }}
                    labelStyle={{ color: '#8899aa' }}
                    itemStyle={{ color: '#00FF88' }}
                  />
                  <Area type="monotone" dataKey="v" stroke="#00FF88" strokeWidth={1.5} fill="url(#greenGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            {/* Live index strip */}
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              {liveIndices.map(idx => {
                const d = prices[idx.sym];
                const up = (d?.changePct ?? 0) >= 0;
                return (
                  <div key={idx.sym} className="flex items-center justify-between px-3 py-2 rounded"
                    style={{ background: '#0d1219', border: '1px solid #1a2332' }}>
                    <div>
                      <div className="text-xs font-bold text-white">{idx.sym}</div>
                      <div className="text-xs" style={{ color: '#4a6080' }}>{idx.name}</div>
                    </div>
                    <div className="text-right">
                      <LivePrice ticker={idx.sym} prices={prices} />
                      <div className="text-xs tabular" style={{ color: up ? '#00FF88' : '#FF4444' }}>
                        {d ? `${up ? '▲' : '▼'} ${Math.abs(d.changePct).toFixed(2)}%` : '—'}
                      </div>
                    </div>
                  </div>
                );
              })}
              {/* VIX static */}
              <div className="flex items-center justify-between px-3 py-2 rounded"
                style={{ background: '#0d1219', border: '1px solid #1a2332' }}>
                <div>
                  <div className="text-xs font-bold text-white">VIX</div>
                  <div className="text-xs" style={{ color: '#4a6080' }}>Volatility Index</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-white tabular">13.64</div>
                  <div className="text-xs tabular" style={{ color: '#FF4444' }}>▼ 4.21%</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Sector Heatmap + AI Summary + Alerts */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded" style={{ background: '#11161C', border: '1px solid #1a2332' }}>
            <div className="px-4 py-3 border-b" style={{ borderColor: '#1a2332' }}>
              <span className="text-sm font-bold text-white uppercase tracking-wide">Sector Heat Map</span>
            </div>
            <div className="grid grid-cols-2 gap-2 p-3">
              {sectorData.map(s => (
                <div key={s.name} className={`sector-tile-${s.signal} rounded px-3 py-2`}>
                  <div className="text-xs font-semibold truncate">{s.name}</div>
                  <div className="text-sm font-black tabular">{s.pct}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded" style={{ background: '#11161C', border: '1px solid #1a2332' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1a2332' }}>
              <span className="text-sm font-bold text-white uppercase tracking-wide">AI Market Summary</span>
              <span className="text-xs px-2 py-0.5 rounded font-semibold"
                style={{ background: 'rgba(0,255,136,0.1)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.25)' }}>
                SPECTER AI
              </span>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm leading-relaxed" style={{ color: '#8899aa' }}>
                The market shows strong bullish momentum with improving breadth. Technology and Communication sectors are leading. Institutional buying is increasing in high-growth names.
              </p>
              <div className="space-y-2">
                {[
                  { label: 'Sentiment',  val: 'Bullish', color: '#00FF88' },
                  { label: 'Confidence', val: '74%',     color: '#3B82F6' },
                  { label: 'Trend',      val: 'Uptrend', color: '#00FF88' },
                ].map(m => (
                  <div key={m.label} className="flex justify-between items-center text-xs">
                    <span style={{ color: '#4a6080' }}>{m.label}</span>
                    <span className="font-bold" style={{ color: m.color }}>{m.val}</span>
                  </div>
                ))}
              </div>
              <button className="w-full py-2 rounded text-xs font-semibold mt-2"
                style={{ background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}>
                VIEW FULL ANALYSIS
              </button>
            </div>
          </div>

          <div className="rounded" style={{ background: '#11161C', border: '1px solid #1a2332' }}>
            <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: '#1a2332' }}>
              <span className="text-sm font-bold text-white uppercase tracking-wide">Recent Alerts</span>
              <span className="text-xs tabular font-bold px-2 py-0.5 rounded"
                style={{ background: 'rgba(59,130,246,0.1)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.25)' }}>
                7 ACTIVE
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: '#1a2332' }}>
              {recentAlerts.map((a, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 data-table-row">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0"
                    style={{ background: '#00FF88', boxShadow: '0 0 4px rgba(0,255,136,0.6)' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold" style={{ color: '#00FF88' }}>{a.symbol}</span>
                      <span className="text-xs" style={{ color: '#8899aa' }}>{a.msg}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#4a6080' }}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 border-t" style={{ borderColor: '#1a2332' }}>
              <button className="w-full py-1.5 rounded text-xs font-semibold"
                style={{ background: 'rgba(59,130,246,0.08)', color: '#3B82F6', border: '1px solid rgba(59,130,246,0.2)' }}>
                VIEW ALL ALERTS
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
