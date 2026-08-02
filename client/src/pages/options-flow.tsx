// Unusual Volume / Smart Money Flow — Phase 10
import { useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Volume2, VolumeX, Zap, BarChart2, Filter } from 'lucide-react';

interface FlowRow {
  symbol: string; price: number; change: number; changePct: number;
  todayVol: number; avgVol: number; volMultiple: number;
  sentiment: string; sector: string; signal: string;
}
interface FlowData {
  results: FlowRow[]; narrative: string; scannedAt: string; count: number;
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + 'M';
  if (v >= 1_000)     return (v / 1_000).toFixed(0) + 'K';
  return String(v);
}

function MultipleBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100);
  const color = value >= 5 ? '#FF3B3B' : value >= 3 ? '#F59E0B' : '#00FF88';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: '#1a2332' }}>
        <div style={{ width: pct + '%', background: color, height: '100%', borderRadius: 4, transition: 'width 0.4s' }} />
      </div>
      <span className="text-xs font-bold w-10 text-right" style={{ color }}>{value}x</span>
    </div>
  );
}

const FILTERS = ['All', 'Bullish', 'Bearish'] as const;
type FilterType = typeof FILTERS[number];

const MIN_MULTIPLES = [1.5, 2, 3, 5] as const;
type MinMultipleType = typeof MIN_MULTIPLES[number];

export default function OptionsFlowPage() {
  const [data, setData]           = useState<FlowData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [filter, setFilter]       = useState<FilterType>('All');
  const [minMult, setMinMult]     = useState<MinMultipleType>(1.5);
  const [speaking, setSpeaking]   = useState(false);
  const [error, setError]         = useState('');
  const audioRef                  = useRef<HTMLAudioElement | null>(null);
  const hasFetched                = useRef(false);

  const fetchFlow = async (f: FilterType = filter, m: MinMultipleType = minMult) => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/flow?filter=' + f.toLowerCase() + '&minMultiple=' + m, { credentials: 'include' });
      if (!res.ok) throw new Error('Scan failed');
      const d = await res.json() as FlowData;
      setData(d);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Scan failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    if (!hasFetched.current) { hasFetched.current = true; void fetchFlow(); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilter = (f: FilterType) => { setFilter(f); void fetchFlow(f, minMult); };
  const handleMult   = (m: MinMultipleType) => { setMinMult(m); void fetchFlow(filter, m); };

  const speakNarrative = async () => {
    if (!data?.narrative) return;
    setSpeaking(true);
    try {
      let voice = 'daniel';
      try {
        const pr = await fetch('/api/specter/params', { credentials: 'include' });
        if (pr.ok) { const pd = await pr.json() as { voice?: string }; voice = pd.voice ?? 'daniel'; }
      } catch { /* default */ }
      const res = await fetch('/api/specter/speak', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ text: data.narrative, voice }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => setSpeaking(false);
        await audio.play();
      } else { setSpeaking(false); }
    } catch { setSpeaking(false); }
  };

  const stopSpeaking = () => { audioRef.current?.pause(); setSpeaking(false); };

  const maxMult = Math.max(...(data?.results.map(r => r.volMultiple) ?? [1]), 1);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}>
            <Zap size={18} style={{ color: '#00FF88' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Smart Money Flow</h1>
            <p className="text-xs mt-0.5" style={{ color: '#4a6080' }}>
              Stocks with unusual volume — where big money is moving right now
            </p>
          </div>
        </div>
        <button onClick={() => void fetchFlow()} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Scanning...' : 'Scan Now'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sentiment filter */}
        <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
          {FILTERS.map(f => (
            <button key={f} onClick={() => handleFilter(f)}
              className="px-3 py-1.5 text-xs font-bold transition-all"
              style={{
                background: filter === f ? 'rgba(0,255,136,0.12)' : 'transparent',
                color: filter === f ? '#00FF88' : '#4a6080',
              }}>
              {f}
            </button>
          ))}
        </div>

        {/* Min volume multiple */}
        <div className="flex items-center gap-2">
          <Filter size={13} style={{ color: '#4a6080' }} />
          <span className="text-xs" style={{ color: '#4a6080' }}>Min multiple:</span>
          <div className="flex items-center gap-1 rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
            {MIN_MULTIPLES.map(m => (
              <button key={m} onClick={() => handleMult(m)}
                className="px-3 py-1.5 text-xs font-bold transition-all"
                style={{
                  background: minMult === m ? 'rgba(0,255,136,0.12)' : 'transparent',
                  color: minMult === m ? '#00FF88' : '#4a6080',
                }}>
                {m}x
              </button>
            ))}
          </div>
        </div>

        {data && (
          <span className="text-xs ml-auto" style={{ color: '#4a6080' }}>
            {data.count} alerts · scanned {new Date(data.scannedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Specter narrative */}
      {data?.narrative && (
        <div className="rounded-xl px-5 py-4" style={{ background: '#0d1219', border: '1px solid rgba(0,255,136,0.15)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#00FF88' }} />
              <span className="text-xs font-bold" style={{ color: '#00FF88' }}>SPECTER READING THE FLOW</span>
              {speaking && <span className="text-xs animate-pulse" style={{ color: '#4a6080' }}>Speaking...</span>}
            </div>
            <button onClick={speaking ? stopSpeaking : () => void speakNarrative()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}>
              {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
              {speaking ? 'Stop' : 'Hear Analysis'}
            </button>
          </div>
          <p className="text-sm leading-relaxed text-white">{data.narrative}</p>
        </div>
      )}

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
          <div className="relative">
            <RefreshCw size={28} className="animate-spin" style={{ color: '#00FF88' }} />
          </div>
          <p className="text-sm" style={{ color: '#4a6080' }}>Specter is scanning 40 tickers for unusual activity...</p>
          <p className="text-xs" style={{ color: '#1a2332' }}>This takes ~10 seconds to be accurate</p>
        </div>
      )}

      {/* Results table */}
      {data && !loading && (
        data.results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <BarChart2 size={36} style={{ color: '#1a2332' }} />
            <p className="text-sm" style={{ color: '#4a6080' }}>No unusual volume detected with current filters</p>
            <p className="text-xs" style={{ color: '#1a2332' }}>Try lowering the minimum multiple or checking during market hours</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a2332' }}>
            {/* Table header */}
            <div className="grid text-xs font-bold px-4 py-2.5"
              style={{ gridTemplateColumns: '80px 80px 90px 1fr 80px 80px 100px', background: '#080C10', borderBottom: '1px solid #1a2332', color: '#4a6080' }}>
              <span>TICKER</span>
              <span>PRICE</span>
              <span>CHANGE</span>
              <span>VOLUME MULTIPLE</span>
              <span>TODAY VOL</span>
              <span>AVG VOL</span>
              <span>SIGNAL</span>
            </div>

            {/* Rows */}
            <div className="divide-y" style={{ borderColor: '#1a2332', background: '#0d1219' }}>
              {data.results.map((row, i) => (
                <div key={row.symbol + i} className="grid items-center px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  style={{ gridTemplateColumns: '80px 80px 90px 1fr 80px 80px 100px' }}>
                  {/* Symbol */}
                  <div>
                    <div className="font-black text-white text-sm">{row.symbol}</div>
                    <div className="text-xs" style={{ color: '#4a6080' }}>{row.sector}</div>
                  </div>

                  {/* Price */}
                  <div className="font-bold text-white text-sm">${row.price.toFixed(2)}</div>

                  {/* Change */}
                  <div className="flex items-center gap-1">
                    {row.changePct >= 0
                      ? <TrendingUp size={12} style={{ color: '#00FF88' }} />
                      : <TrendingDown size={12} style={{ color: '#FF3B3B' }} />}
                    <span className="text-sm font-bold" style={{ color: row.changePct >= 0 ? '#00FF88' : '#FF3B3B' }}>
                      {row.changePct >= 0 ? '+' : ''}{row.changePct.toFixed(2)}%
                    </span>
                  </div>

                  {/* Volume bar */}
                  <div className="pr-4">
                    <MultipleBar value={row.volMultiple} max={maxMult} />
                  </div>

                  {/* Today vol */}
                  <div className="text-xs text-white">{fmtVol(row.todayVol)}</div>

                  {/* Avg vol */}
                  <div className="text-xs" style={{ color: '#4a6080' }}>{fmtVol(row.avgVol)}</div>

                  {/* Signal badge */}
                  <div>
                    <span className="text-xs font-bold px-2 py-0.5 rounded"
                      style={{
                        background: row.volMultiple >= 5 ? 'rgba(255,59,59,0.15)' : row.volMultiple >= 3 ? 'rgba(245,158,11,0.15)' : 'rgba(0,255,136,0.1)',
                        color: row.volMultiple >= 5 ? '#FF3B3B' : row.volMultiple >= 3 ? '#F59E0B' : '#00FF88',
                      }}>
                      {row.signal}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 flex-wrap">
        {[
          { color: '#00FF88', label: '1.5–2x — Elevated Volume' },
          { color: '#F59E0B', label: '3–5x — Heavy Volume' },
          { color: '#FF3B3B', label: '5x+ — Extreme Volume' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-xs" style={{ color: '#4a6080' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
