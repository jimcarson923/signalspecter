// Chart Plans v2 — Phase 8
import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, TrendingUp, TrendingDown, Target, ShieldAlert, ArrowUpCircle, BarChart2, RefreshCw, Volume2, VolumeX } from 'lucide-react';

interface Candle { t: number; o: number; h: number; l: number; c: number; v: number; }
interface ChartLevels { support1: number; support2: number; resistance1: number; resistance2: number; }
interface Zone { low: number; high: number; }
interface Plan { entry: number; target: number; stop: number; rr: number; }
interface ChartData {
  symbol: string;
  timeframe: string;
  currentPrice: number;
  trend: string;
  sma20: number;
  candles: Candle[];
  levels: ChartLevels;
  buyZone: Zone;
  sellZone: Zone;
  plan: Plan;
  narrative: string;
}

interface TooltipState { x: number; y: number; candle: Candle; }

const TIMEFRAMES = ['1D', '1W', '1M', '3M'];
const W = 900, H = 420;
const PAD = { top: 20, right: 70, bottom: 40, left: 10 };
const chartW = W - PAD.left - PAD.right;
const chartH = H - PAD.top - PAD.bottom;

function CandlestickChart({ data }: { data: ChartData }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const candles = data.candles;
  const allPrices: number[] = [
    ...candles.flatMap(c => [c.h, c.l]),
    data.levels.resistance2, data.levels.support2,
    data.buyZone.low, data.sellZone.high,
  ];
  const priceMin = Math.min(...allPrices) * 0.999;
  const priceMax = Math.max(...allPrices) * 1.001;
  const priceRange = priceMax - priceMin || 1;

  const xScale = (i: number) => PAD.left + (i / Math.max(candles.length - 1, 1)) * chartW;
  const yScale = (p: number) => PAD.top + chartH - ((p - priceMin) / priceRange) * chartH;

  const candleW = Math.max(1, Math.min(10, chartW / candles.length - 1));

  let buyIdx = -1;
  let sellIdx = -1;
  candles.forEach((c, i) => {
    if (c.l <= data.buyZone.high && c.l >= data.buyZone.low) buyIdx = i;
    if (c.h >= data.sellZone.low && c.h <= data.sellZone.high) sellIdx = i;
  });

  const gridPrices = Array.from({ length: 6 }, (_, i) => priceMin + priceRange * (i / 5));

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl"
        style={{ background: '#080C10', minWidth: 500 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {gridPrices.map((p, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={yScale(p)} y2={yScale(p)} stroke="#1a2332" strokeWidth="1" />
            <text x={W - PAD.right + 4} y={yScale(p) + 4} fill="#4a6080" fontSize="10" fontFamily="monospace">
              ${p.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Buy zone band */}
        <rect x={PAD.left} y={yScale(data.buyZone.high)} width={chartW}
          height={Math.abs(yScale(data.buyZone.low) - yScale(data.buyZone.high))}
          fill="rgba(0,255,136,0.07)" />
        <line x1={PAD.left} x2={W - PAD.right} y1={yScale(data.levels.support1)} y2={yScale(data.levels.support1)}
          stroke="#00FF88" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
        <text x={PAD.left + 4} y={yScale(data.levels.support1) - 3} fill="#00FF88" fontSize="9" fontFamily="monospace">
          S1 ${data.levels.support1}
        </text>

        {/* Sell zone band */}
        <rect x={PAD.left} y={yScale(data.sellZone.high)} width={chartW}
          height={Math.abs(yScale(data.sellZone.low) - yScale(data.sellZone.high))}
          fill="rgba(255,59,59,0.07)" />
        <line x1={PAD.left} x2={W - PAD.right} y1={yScale(data.levels.resistance1)} y2={yScale(data.levels.resistance1)}
          stroke="#FF3B3B" strokeWidth="1" strokeDasharray="4,3" opacity="0.6" />
        <text x={PAD.left + 4} y={yScale(data.levels.resistance1) - 3} fill="#FF3B3B" fontSize="9" fontFamily="monospace">
          R1 ${data.levels.resistance1}
        </text>

        {/* SMA20 */}
        <line x1={PAD.left} x2={W - PAD.right} y1={yScale(data.sma20)} y2={yScale(data.sma20)}
          stroke="#F59E0B" strokeWidth="1" strokeDasharray="6,3" opacity="0.5" />
        <text x={PAD.left + 4} y={yScale(data.sma20) - 3} fill="#F59E0B" fontSize="9" fontFamily="monospace">
          SMA20 ${data.sma20}
        </text>

        {/* Candlesticks */}
        {candles.map((c, i) => {
          const x  = xScale(i);
          const yo = yScale(c.o);
          const yc = yScale(c.c);
          const yh = yScale(c.h);
          const yl = yScale(c.l);
          const bull = c.c >= c.o;
          const color = bull ? '#00FF88' : '#FF3B3B';
          const bodyTop = Math.min(yo, yc);
          const bodyH   = Math.max(1, Math.abs(yo - yc));
          return (
            <g key={c.t} onMouseEnter={() => setTooltip({ x, y: yh, candle: c })}>
              <line x1={x} x2={x} y1={yh} y2={yl} stroke={color} strokeWidth="1" opacity="0.7" />
              <rect x={x - candleW / 2} y={bodyTop} width={candleW} height={bodyH}
                fill={bull ? 'rgba(0,255,136,0.85)' : 'rgba(255,59,59,0.85)'}
                stroke={color} strokeWidth="0.5" rx="0.5" />
            </g>
          );
        })}

        {/* Buy arrow */}
        {buyIdx >= 0 && (() => {
          const bx = xScale(buyIdx);
          const by = yScale(candles[buyIdx].l) + 22;
          return (
            <g>
              <polygon points={`${bx},${by} ${bx - 8},${by + 16} ${bx + 8},${by + 16}`} fill="#00FF88" opacity="0.95" />
              <text x={bx} y={by + 30} textAnchor="middle" fill="#00FF88" fontSize="9" fontWeight="bold" fontFamily="monospace">BUY</text>
            </g>
          );
        })()}

        {/* Sell arrow */}
        {sellIdx >= 0 && (() => {
          const sx = xScale(sellIdx);
          const sy = yScale(candles[sellIdx].h) - 22;
          return (
            <g>
              <polygon points={`${sx},${sy} ${sx - 8},${sy - 16} ${sx + 8},${sy - 16}`} fill="#FF3B3B" opacity="0.95" />
              <text x={sx} y={sy - 20} textAnchor="middle" fill="#FF3B3B" fontSize="9" fontWeight="bold" fontFamily="monospace">SELL</text>
            </g>
          );
        })()}

        {/* Current price */}
        <line x1={PAD.left} x2={W - PAD.right} y1={yScale(data.currentPrice)} y2={yScale(data.currentPrice)}
          stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2,2" opacity="0.35" />
        <text x={W - PAD.right + 4} y={yScale(data.currentPrice) + 4} fill="#FFFFFF" fontSize="10" fontFamily="monospace" fontWeight="bold">
          ${data.currentPrice}
        </text>

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect x={Math.min(tooltip.x + 8, W - 135)} y={Math.max(tooltip.y - 10, PAD.top)}
              width={122} height={74} rx="4" fill="#0d1219" stroke="#1a2332" />
            <text x={Math.min(tooltip.x + 14, W - 129)} y={Math.max(tooltip.y + 8, PAD.top + 18)}
              fill="#FFFFFF" fontSize="10" fontFamily="monospace">
              O: ${tooltip.candle.o.toFixed(2)}  H: ${tooltip.candle.h.toFixed(2)}
            </text>
            <text x={Math.min(tooltip.x + 14, W - 129)} y={Math.max(tooltip.y + 22, PAD.top + 32)}
              fill="#FFFFFF" fontSize="10" fontFamily="monospace">
              L: ${tooltip.candle.l.toFixed(2)}  C: ${tooltip.candle.c.toFixed(2)}
            </text>
            <text x={Math.min(tooltip.x + 14, W - 129)} y={Math.max(tooltip.y + 36, PAD.top + 46)}
              fill="#4a6080" fontSize="9" fontFamily="monospace">
              Vol: {(tooltip.candle.v / 1000).toFixed(0)}K
            </text>
            <text x={Math.min(tooltip.x + 14, W - 129)} y={Math.max(tooltip.y + 50, PAD.top + 60)}
              fill="#4a6080" fontSize="9" fontFamily="monospace">
              {new Date(tooltip.candle.t).toLocaleTimeString()}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export default function ChartPlansPage() {
  const [ticker, setTicker]       = useState('');
  const [input, setInput]         = useState('');
  const [timeframe, setTimeframe] = useState('1D');
  const [data, setData]           = useState<ChartData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [speaking, setSpeaking]   = useState(false);
  const audioRef                  = useRef<HTMLAudioElement | null>(null);
  const narratedRef               = useRef('');

  const fetchChart = useCallback(async (sym: string, tf: string) => {
    if (!sym) return;
    setLoading(true); setError(''); setData(null);
    try {
      const res = await fetch(`/api/chart/${sym}?timeframe=${tf}`, { credentials: 'include' });
      if (!res.ok) {
        const e = await res.json() as { error?: string };
        throw new Error(e.error ?? 'Failed to load chart');
      }
      const d = await res.json() as ChartData;
      setData(d);
      narratedRef.current = '';
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSearch = () => {
    const sym = input.trim().toUpperCase();
    if (!sym) return;
    setTicker(sym);
    fetchChart(sym, timeframe);
  };

  const handleTF = (tf: string) => {
    setTimeframe(tf);
    if (ticker) fetchChart(ticker, tf);
  };

  const narrate = useCallback(async (text: string) => {
    if (narratedRef.current === text) return;
    narratedRef.current = text;
    setSpeaking(true);
    try {
      let voicePref = 'daniel';
      try {
        const pr = await fetch('/api/specter/params', { credentials: 'include' });
        if (pr.ok) {
          const pd = await pr.json() as { voice?: string };
          voicePref = pd.voice ?? 'daniel';
        }
      } catch { /* use default */ }
      const res = await fetch('/api/specter/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text, voice: voicePref }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => setSpeaking(false);
        await audio.play();
      } else {
        setSpeaking(false);
      }
    } catch {
      setSpeaking(false);
    }
  }, []);

  useEffect(() => {
    if (data?.narrative && narratedRef.current !== data.narrative) {
      void narrate(data.narrative);
    }
  }, [data, narrate]);

  const stopSpeaking = () => { audioRef.current?.pause(); setSpeaking(false); };

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}>
            <BarChart2 size={18} style={{ color: '#00FF88' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Chart Plans</h1>
            <p className="text-xs mt-0.5" style={{ color: '#4a6080' }}>
              Specter reads the chart and marks your optimal buy &amp; sell zones
            </p>
          </div>
        </div>
        {/* Timeframe pills */}
        <div className="flex items-center gap-1">
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => handleTF(tf)}
              className="px-3 py-1.5 rounded text-xs font-bold transition-all"
              style={{
                background: timeframe === tf ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.04)',
                color: timeframe === tf ? '#00FF88' : '#4a6080',
                border: `1px solid ${timeframe === tf ? 'rgba(0,255,136,0.35)' : '#1a2332'}`,
              }}>
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4a6080' }} />
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
            placeholder="Enter ticker — NVDA, AAPL, TSLA, SPY..."
            className="w-full pl-9 pr-4 py-3 rounded-lg text-sm outline-none text-white"
            style={{ background: '#0d1219', border: '1px solid #1a2332' }}
          />
        </div>
        <button onClick={handleSearch} disabled={loading || !input}
          className="px-5 py-3 rounded-lg text-sm font-bold transition-all"
          style={{
            background: loading ? 'rgba(0,255,136,0.08)' : 'rgba(0,255,136,0.15)',
            color: '#00FF88', border: '1px solid rgba(0,255,136,0.3)',
            opacity: !input ? 0.5 : 1,
          }}>
          {loading ? <RefreshCw size={15} className="animate-spin" /> : 'Analyze'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg px-4 py-3 text-sm"
          style={{ background: 'rgba(255,59,59,0.1)', border: '1px solid rgba(255,59,59,0.2)', color: '#FF3B3B' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw size={28} className="animate-spin" style={{ color: '#00FF88' }} />
          <p className="text-sm" style={{ color: '#4a6080' }}>Specter is reading the chart for {ticker}...</p>
        </div>
      )}

      {/* Chart + Plan */}
      {data && !loading && (
        <>
          {/* Ticker bar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-white">{data.symbol}</span>
              <span className="text-xl font-bold" style={{ color: '#00FF88' }}>${data.currentPrice}</span>
              <span className="flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded"
                style={{
                  background: data.trend === 'Bullish' ? 'rgba(0,255,136,0.12)' : 'rgba(255,59,59,0.12)',
                  color: data.trend === 'Bullish' ? '#00FF88' : '#FF3B3B',
                  border: `1px solid ${data.trend === 'Bullish' ? 'rgba(0,255,136,0.25)' : 'rgba(255,59,59,0.25)'}`,
                }}>
                {data.trend === 'Bullish' ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                {data.trend}
              </span>
            </div>
            <button onClick={speaking ? stopSpeaking : () => { void narrate(data.narrative); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: speaking ? 'rgba(0,255,136,0.2)' : 'rgba(0,255,136,0.08)',
                color: '#00FF88', border: '1px solid rgba(0,255,136,0.25)',
              }}>
              {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
              {speaking ? 'Stop' : 'Hear Plan'}
            </button>
          </div>

          {/* Chart */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a2332' }}>
            <CandlestickChart data={data} />
          </div>

          {/* Specter narrative */}
          <div className="rounded-xl px-5 py-4" style={{ background: '#0d1219', border: '1px solid rgba(0,255,136,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#00FF88' }} />
              <span className="text-xs font-bold" style={{ color: '#00FF88' }}>SPECTER ANALYSIS</span>
              {speaking && <span className="text-xs animate-pulse" style={{ color: '#4a6080' }}>Speaking...</span>}
            </div>
            <p className="text-sm leading-relaxed text-white">{data.narrative}</p>
          </div>

          {/* Plan cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              { label: 'Entry',       value: `$${data.plan.entry}`,  Icon: ArrowUpCircle, color: '#00FF88' },
              { label: 'Target',      value: `$${data.plan.target}`, Icon: Target,        color: '#3B82F6' },
              { label: 'Stop Loss',   value: `$${data.plan.stop}`,   Icon: ShieldAlert,   color: '#FF3B3B' },
              { label: 'Risk/Reward', value: `${data.plan.rr}:1`,    Icon: BarChart2,     color: '#F59E0B' },
            ] as const).map(({ label, value, Icon, color }) => (
              <div key={label} className="rounded-xl p-4 text-center"
                style={{ background: '#0d1219', border: '1px solid #1a2332' }}>
                <Icon size={18} className="mx-auto mb-2" style={{ color }} />
                <div className="text-xs mb-1" style={{ color: '#4a6080' }}>{label}</div>
                <div className="text-lg font-black text-white">{value}</div>
              </div>
            ))}
          </div>

          {/* Key levels */}
          <div className="grid grid-cols-2 gap-3">
            {([
              { label: 'Buy Zone',  low: data.buyZone.low,   high: data.buyZone.high,   color: '#00FF88' },
              { label: 'Sell Zone', low: data.sellZone.low,  high: data.sellZone.high,  color: '#FF3B3B' },
            ] as const).map(({ label, low, high, color }) => (
              <div key={label} className="rounded-xl px-4 py-3"
                style={{ background: '#0d1219', border: '1px solid #1a2332' }}>
                <div className="text-xs mb-1" style={{ color: '#4a6080' }}>{label}</div>
                <div className="text-sm font-bold" style={{ color }}>${low} – ${high}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <BarChart2 size={40} style={{ color: '#1a2332' }} />
          <p className="text-sm" style={{ color: '#4a6080' }}>
            Enter a ticker above and Specter will map out your trade plan
          </p>
        </div>
      )}
    </div>
  );
}
