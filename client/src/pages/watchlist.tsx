import { useState, useEffect } from 'react';
import { Plus, Trash2, TrendingUp, TrendingDown, Star, RefreshCw, Mic } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type WatchItem = {
  id: number;
  symbol: string;
  addedAt: number;
  notes: string;
  price?: number;
  changePct?: number;
  volume?: number;
  specterScore?: number;
};

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? '#00FF88' : score >= 45 ? '#F59E0B' : '#FF4444';
  return (
    <div className="flex flex-col items-center justify-center w-12 h-12 rounded-full border-2"
      style={{ borderColor: color, background: `${color}12` }}>
      <span className="text-xs font-black tabular" style={{ color }}>{Math.round(score)}</span>
    </div>
  );
}

function PctChange({ value }: { value: number }) {
  const up = value >= 0;
  return (
    <span className="text-sm tabular font-bold flex items-center gap-1"
      style={{ color: up ? '#00FF88' : '#FF4444' }}>
      {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {up ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

export default function WatchlistPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [adding, setAdding] = useState(false);
  const [narrating, setNarrating] = useState(false);

  const fetchWatchlist = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/watchlist/enriched', { credentials: 'include' });
      if (res.ok) setItems(await res.json());
    } catch { }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { fetchWatchlist(); }, []);

  const addTicker = async () => {
    const sym = newSymbol.trim().toUpperCase();
    if (!sym) return;
    setAdding(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ symbol: sym }),
      });
      if (res.ok) {
        setNewSymbol('');
        toast({ title: `${sym} added to watchlist`, description: 'Specter is now monitoring this stock.' });
        await fetchWatchlist();
      } else {
        toast({ title: 'Could not add ticker', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error adding ticker', variant: 'destructive' });
    }
    setAdding(false);
  };

  const removeTicker = async (symbol: string) => {
    try {
      await fetch(`/api/watchlist/${symbol}`, { method: 'DELETE', credentials: 'include' });
      setItems(prev => prev.filter(i => i.symbol !== symbol));
      toast({ title: `${symbol} removed from watchlist` });
    } catch {
      toast({ title: 'Error removing ticker', variant: 'destructive' });
    }
  };

  const narrateWatchlist = async () => {
    if (narrating) return;
    setNarrating(true);
    try {
      const res = await fetch('/api/watchlist/narrate', { credentials: 'include' });
      const data = await res.json();
      if (data.text) {
        // Speak via ElevenLabs
        const savedParams = (() => { try { return JSON.parse(localStorage.getItem('specterParams') || '{}'); } catch { return {}; } })();
        const voicePref = savedParams.voice || 'adam';
        const audioRes = await fetch('/api/specter/speak', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ text: data.text, voice: voicePref }),
        });
        if (audioRes.ok) {
          const blob = await audioRes.blob();
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => { URL.revokeObjectURL(url); setNarrating(false); };
          audio.onerror = () => setNarrating(false);
          await audio.play();
          return;
        }
      }
    } catch { }
    setNarrating(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0" style={{ background: '#0B0F14' }}>

      {/* Header */}
      <div className="px-6 py-4 border-b flex-shrink-0 flex items-center justify-between"
        style={{ background: '#080C10', borderColor: '#1a2332' }}>
        <div>
          <h1 className="text-xl font-black text-white flex items-center gap-2">
            <Star size={20} style={{ color: '#00FF88' }} />
            WATCHLIST
          </h1>
          <p className="text-xs mt-0.5" style={{ color: '#4a6080' }}>
            Specter monitors these 24/7 and alerts you on unusual moves
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={narrateWatchlist}
            disabled={narrating || items.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-semibold transition-all"
            style={{
              background: narrating ? 'rgba(0,255,136,0.15)' : 'rgba(0,255,136,0.08)',
              color: '#00FF88',
              border: '1px solid rgba(0,255,136,0.25)',
              opacity: items.length === 0 ? 0.4 : 1,
            }}>
            <Mic size={14} className={narrating ? 'animate-pulse' : ''} />
            {narrating ? 'Specter Speaking...' : 'Brief Me'}
          </button>
          <button
            onClick={() => fetchWatchlist(true)}
            disabled={refreshing}
            className="p-2 rounded transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #1a2332', color: '#4a6080' }}>
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Add ticker bar */}
      <div className="px-6 py-3 flex-shrink-0 flex items-center gap-3"
        style={{ background: '#0d1219', borderBottom: '1px solid #1a2332' }}>
        <input
          value={newSymbol}
          onChange={e => setNewSymbol(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker — e.g. NVDA, AAPL, TSLA"
          className="flex-1 px-4 py-2 rounded text-sm outline-none"
          style={{ background: '#11161C', border: '1px solid #1a2332', color: '#fff' }}
          maxLength={8}
        />
        <button
          onClick={addTicker}
          disabled={adding || !newSymbol.trim()}
          className="flex items-center gap-2 px-5 py-2 rounded text-sm font-bold transition-all"
          style={{
            background: '#00FF88',
            color: '#000',
            opacity: adding || !newSymbol.trim() ? 0.5 : 1,
          }}>
          <Plus size={15} />
          {adding ? 'Adding...' : 'Add'}
        </button>
      </div>

      {/* Watchlist table */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-16 rounded" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Star size={40} style={{ color: '#1a2332' }} className="mb-4" />
            <p className="text-white font-bold mb-1">Your watchlist is empty</p>
            <p className="text-sm" style={{ color: '#4a6080' }}>
              Add tickers above and Specter will monitor them around the clock
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-semibold"
              style={{ color: '#4a6080' }}>
              <div className="col-span-1">SCORE</div>
              <div className="col-span-2">SYMBOL</div>
              <div className="col-span-3">PRICE</div>
              <div className="col-span-3">CHANGE</div>
              <div className="col-span-2">VOLUME</div>
              <div className="col-span-1"></div>
            </div>

            {items.map(item => (
              <div key={item.id}
                className="grid grid-cols-12 gap-4 items-center px-4 py-3 rounded transition-all"
                style={{ background: '#11161C', border: '1px solid #1a2332' }}>

                {/* Score */}
                <div className="col-span-1">
                  <ScoreRing score={item.specterScore ?? 50} />
                </div>

                {/* Symbol */}
                <div className="col-span-2">
                  <div className="font-black text-base" style={{ color: '#00FF88' }}>{item.symbol}</div>
                  <div className="text-xs" style={{ color: '#4a6080' }}>
                    {new Date(item.addedAt).toLocaleDateString()}
                  </div>
                </div>

                {/* Price */}
                <div className="col-span-3">
                  <div className="text-lg font-black tabular text-white">
                    {item.price && item.price > 0 ? `$${item.price.toFixed(2)}` : '—'}
                  </div>
                </div>

                {/* Change */}
                <div className="col-span-3">
                  {item.changePct !== undefined
                    ? <PctChange value={item.changePct} />
                    : <span className="text-zinc-600">—</span>
                  }
                </div>

                {/* Volume */}
                <div className="col-span-2">
                  <div className="text-sm tabular" style={{ color: '#8899aa' }}>
                    {item.volume
                      ? item.volume >= 1_000_000
                        ? `${(item.volume / 1_000_000).toFixed(1)}M`
                        : `${(item.volume / 1_000).toFixed(0)}K`
                      : '—'
                    }
                  </div>
                </div>

                {/* Remove */}
                <div className="col-span-1 flex justify-end">
                  <button
                    onClick={() => removeTicker(item.symbol)}
                    className="p-1.5 rounded transition-all hover:bg-red-500/10"
                    style={{ color: '#4a6080' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
