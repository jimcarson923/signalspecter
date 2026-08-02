// Paper Trading — Phase 9
import { useState, useRef } from 'react';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, Plus, Minus, Volume2, VolumeX, RotateCcw, ShieldAlert, BarChart2, Wallet } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface PaperAccount {
  id: number; userId: number; startingCash: number; cash: number;
  totalValue: number; totalReturn: number; totalReturnPct: number;
}
interface PaperPosition {
  id: number; symbol: string; shares: number; avgCost: number;
  currentPrice: number; value: number; pnl: number; pnlPct: number;
}
interface PaperTrade {
  id: number; symbol: string; action: string; shares: number;
  price: number; total: number; pnl: number | null; pnlPct: number | null;
  coaching: string | null; tradedAt: string;
}
interface Portfolio {
  hasAccount: boolean;
  account: PaperAccount;
  positions: PaperPosition[];
  trades: PaperTrade[];
}

// ── Helper ────────────────────────────────────────────────────────────────────
function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(n: number) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
function green(n: number) { return n >= 0 ? '#00FF88' : '#FF3B3B'; }

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: '#0d1219', border: '1px solid #1a2332' }}>
      <div className="text-xs mb-1" style={{ color: '#4a6080' }}>{label}</div>
      <div className="text-xl font-black" style={{ color: color ?? '#FFFFFF' }}>{value}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: '#4a6080' }}>{sub}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PaperTradingPage() {
  const [portfolio, setPortfolio]         = useState<Portfolio | null>(null);
  const [loading, setLoading]             = useState(false);
  const [tradeSymbol, setTradeSymbol]     = useState('');
  const [tradeShares, setTradeShares]     = useState('');
  const [tradeMode, setTradeMode]         = useState<'buy' | 'sell'>('buy');
  const [precheck, setPrecheck]           = useState('');
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [tradeLoading, setTradeLoading]   = useState(false);
  const [tradeResult, setTradeResult]     = useState<{ pnl?: number; pnlPct?: number; coaching?: string; price?: number; total?: number } | null>(null);
  const [startCash, setStartCash]         = useState('10000');
  const [creating, setCreating]           = useState(false);
  const [tab, setTab]                     = useState<'positions' | 'history'>('positions');
  const [speaking, setSpeaking]           = useState(false);
  const [error, setError]                 = useState('');
  const audioRef                          = useRef<HTMLAudioElement | null>(null);

  const loadPortfolio = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/paper/portfolio', { credentials: 'include' });
      const d   = await res.json() as Portfolio;
      setPortfolio(d);
    } catch { setError('Failed to load portfolio'); }
    finally { setLoading(false); }
  };

  // Auto-load on mount
  useState(() => { void loadPortfolio(); });

  const createAccount = async () => {
    setCreating(true); setError('');
    try {
      const res = await fetch('/api/paper/create', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ startingCash: Number(startCash) }),
      });
      if (!res.ok) { const e = await res.json() as { error?: string }; throw new Error(e.error ?? 'Failed'); }
      await loadPortfolio();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Error'); }
    finally { setCreating(false); }
  };

  const runPrecheck = async () => {
    if (!tradeSymbol || !tradeShares) return;
    setPrecheckLoading(true); setPrecheck(''); setTradeResult(null);
    try {
      // Get a rough price first
      const pRes  = await fetch('/api/paper/portfolio', { credentials: 'include' });
      const pData = await pRes.json() as Portfolio;
      const pos   = pData.positions?.find(p => p.symbol === tradeSymbol.toUpperCase());
      const price = pos?.currentPrice ?? 100;

      const res = await fetch('/api/paper/precheck', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ symbol: tradeSymbol.toUpperCase(), shares: Number(tradeShares), price }),
      });
      const d = await res.json() as { verdict?: string };
      setPrecheck(d.verdict ?? '');
      if (d.verdict) void speakText(d.verdict);
    } catch { setPrecheck(''); }
    finally { setPrecheckLoading(false); }
  };

  const executeTrade = async () => {
    if (!tradeSymbol || !tradeShares) return;
    setTradeLoading(true); setError(''); setTradeResult(null);
    try {
      const endpoint = tradeMode === 'buy' ? '/api/paper/buy' : '/api/paper/sell';
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ symbol: tradeSymbol.toUpperCase(), shares: Number(tradeShares) }),
      });
      const d = await res.json() as { ok?: boolean; error?: string; pnl?: number; pnlPct?: number; coaching?: string; price?: number; total?: number };
      if (!res.ok || !d.ok) throw new Error(d.error ?? 'Trade failed');
      setTradeResult(d);
      setPrecheck('');
      if (d.coaching) void speakText(d.coaching);
      await loadPortfolio();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Trade failed'); }
    finally { setTradeLoading(false); }
  };

  const resetAccount = async () => {
    if (!confirm('Reset your paper account back to starting cash? All positions will be wiped.')) return;
    await fetch('/api/paper/reset', { method: 'POST', credentials: 'include' });
    await loadPortfolio();
    setTradeResult(null); setPrecheck('');
  };

  const speakText = async (text: string) => {
    setSpeaking(true);
    try {
      let voice = 'daniel';
      try {
        const pr = await fetch('/api/specter/params', { credentials: 'include' });
        if (pr.ok) { const pd = await pr.json() as { voice?: string }; voice = pd.voice ?? 'daniel'; }
      } catch { /* default */ }
      const res = await fetch('/api/specter/speak', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ text, voice }),
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

  // ── No account state ───────────────────────────────────────────────────────
  if (portfolio && !portfolio.hasAccount) {
    return (
      <div className="p-4 md:p-6 max-w-xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.2)' }}>
          <Wallet size={26} style={{ color: '#00FF88' }} />
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-black text-white mb-2">Start Paper Trading</h2>
          <p className="text-sm" style={{ color: '#4a6080' }}>
            Set your starting cash and practice trading with no real money at risk. Specter coaches every trade.
          </p>
        </div>
        <div className="w-full rounded-xl p-6 space-y-4" style={{ background: '#0d1219', border: '1px solid #1a2332' }}>
          <label className="block">
            <span className="text-xs font-bold mb-2 block" style={{ color: '#4a6080' }}>STARTING CASH</span>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-white">$</span>
              <input
                type="number" value={startCash} onChange={e => setStartCash(e.target.value)}
                className="w-full pl-8 pr-4 py-3 rounded-lg text-lg font-bold outline-none text-white"
                style={{ background: '#080C10', border: '1px solid #1a2332' }}
                min="1000" max="10000000" step="1000"
              />
            </div>
            <p className="text-xs mt-1" style={{ color: '#4a6080' }}>Min $1,000 · Max $10,000,000</p>
          </label>
          <button onClick={createAccount} disabled={creating}
            className="w-full py-3 rounded-lg font-bold text-sm transition-all"
            style={{ background: 'rgba(0,255,136,0.15)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.3)' }}>
            {creating ? <RefreshCw size={16} className="animate-spin mx-auto" /> : 'Create Paper Account'}
          </button>
        </div>
        {error && <p className="text-sm" style={{ color: '#FF3B3B' }}>{error}</p>}
      </div>
    );
  }

  const acct = portfolio?.account;

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
            <h1 className="text-xl font-bold tracking-tight text-white">Paper Trading</h1>
            <p className="text-xs mt-0.5" style={{ color: '#4a6080' }}>Practice trading with Specter coaching — no real money</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadPortfolio} disabled={loading}
            className="p-2 rounded-lg transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1a2332', color: '#4a6080' }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={resetAccount}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{ background: 'rgba(255,59,59,0.08)', color: '#FF3B3B', border: '1px solid rgba(255,59,59,0.2)' }}>
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      {loading && !acct && (
        <div className="flex justify-center py-20">
          <RefreshCw size={28} className="animate-spin" style={{ color: '#00FF88' }} />
        </div>
      )}

      {acct && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total Value" value={'$' + fmt(acct.totalValue)} />
            <StatCard label="Cash Available" value={'$' + fmt(acct.cash)} />
            <StatCard
              label="Total Return"
              value={(acct.totalReturn >= 0 ? '+$' : '-$') + fmt(Math.abs(acct.totalReturn))}
              sub={pct(acct.totalReturnPct)}
              color={green(acct.totalReturn)}
            />
            <StatCard label="Starting Cash" value={'$' + fmt(acct.startingCash)} sub="Your base" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* Trade Panel */}
            <div className="rounded-xl p-5 space-y-4" style={{ background: '#0d1219', border: '1px solid #1a2332' }}>
              <h3 className="text-sm font-bold text-white">Place a Trade</h3>

              {/* Buy / Sell toggle */}
              <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1a2332' }}>
                {(['buy', 'sell'] as const).map(m => (
                  <button key={m} onClick={() => { setTradeMode(m); setPrecheck(''); setTradeResult(null); }}
                    className="flex-1 py-2 text-sm font-bold transition-all capitalize"
                    style={{
                      background: tradeMode === m ? (m === 'buy' ? 'rgba(0,255,136,0.15)' : 'rgba(255,59,59,0.15)') : 'transparent',
                      color: tradeMode === m ? (m === 'buy' ? '#00FF88' : '#FF3B3B') : '#4a6080',
                    }}>
                    {m === 'buy' ? <TrendingUp size={13} className="inline mr-1" /> : <TrendingDown size={13} className="inline mr-1" />}
                    {m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>

              {/* Symbol input */}
              <input
                value={tradeSymbol}
                onChange={e => { setTradeSymbol(e.target.value.toUpperCase()); setPrecheck(''); setTradeResult(null); }}
                placeholder="Ticker — NVDA, AAPL..."
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none text-white"
                style={{ background: '#080C10', border: '1px solid #1a2332' }}
              />

              {/* Shares input */}
              <div className="flex items-center gap-2">
                <button onClick={() => setTradeShares(s => String(Math.max(1, Number(s) - 1)))}
                  className="p-2 rounded-lg" style={{ background: '#080C10', border: '1px solid #1a2332', color: '#4a6080' }}>
                  <Minus size={13} />
                </button>
                <input
                  type="number" value={tradeShares}
                  onChange={e => setTradeShares(e.target.value)}
                  placeholder="Shares"
                  className="flex-1 px-3 py-2.5 rounded-lg text-sm text-center outline-none text-white"
                  style={{ background: '#080C10', border: '1px solid #1a2332' }}
                  min="1"
                />
                <button onClick={() => setTradeShares(s => String(Number(s) + 1))}
                  className="p-2 rounded-lg" style={{ background: '#080C10', border: '1px solid #1a2332', color: '#4a6080' }}>
                  <Plus size={13} />
                </button>
              </div>

              {/* Precheck button */}
              {tradeMode === 'buy' && (
                <button onClick={runPrecheck} disabled={precheckLoading || !tradeSymbol || !tradeShares}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)', opacity: (!tradeSymbol || !tradeShares) ? 0.5 : 1 }}>
                  {precheckLoading ? <RefreshCw size={13} className="animate-spin mx-auto" /> : '🎙 Get Specter\'s Verdict First'}
                </button>
              )}

              {/* Execute button */}
              <button onClick={executeTrade} disabled={tradeLoading || !tradeSymbol || !tradeShares}
                className="w-full py-3 rounded-lg text-sm font-bold transition-all"
                style={{
                  background: tradeMode === 'buy' ? 'rgba(0,255,136,0.15)' : 'rgba(255,59,59,0.15)',
                  color: tradeMode === 'buy' ? '#00FF88' : '#FF3B3B',
                  border: '1px solid ' + (tradeMode === 'buy' ? 'rgba(0,255,136,0.3)' : 'rgba(255,59,59,0.3)'),
                  opacity: (!tradeSymbol || !tradeShares) ? 0.5 : 1,
                }}>
                {tradeLoading
                  ? <RefreshCw size={14} className="animate-spin mx-auto" />
                  : (tradeMode === 'buy' ? <><TrendingUp size={14} className="inline mr-1.5" />Buy {tradeShares || '0'} {tradeSymbol || 'shares'}</> : <><TrendingDown size={14} className="inline mr-1.5" />Sell {tradeShares || '0'} {tradeSymbol || 'shares'}</>)
                }
              </button>

              {error && <p className="text-xs text-center" style={{ color: '#FF3B3B' }}>{error}</p>}

              {/* Specter precheck verdict */}
              {precheck && (
                <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: '#F59E0B' }}>SPECTER PRE-TRADE</span>
                    <button onClick={speaking ? stopSpeaking : () => void speakText(precheck)}
                      className="p-1 rounded" style={{ color: '#F59E0B' }}>
                      {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-white">{precheck}</p>
                </div>
              )}

              {/* Post-trade result */}
              {tradeResult && (
                <div className="rounded-lg p-3 space-y-2"
                  style={{ background: tradeResult.pnl !== undefined && tradeResult.pnl !== null ? (tradeResult.pnl >= 0 ? 'rgba(0,255,136,0.08)' : 'rgba(255,59,59,0.08)') : 'rgba(0,255,136,0.08)', border: '1px solid ' + (tradeResult.pnl !== undefined && tradeResult.pnl !== null ? (tradeResult.pnl >= 0 ? 'rgba(0,255,136,0.2)' : 'rgba(255,59,59,0.2)') : 'rgba(0,255,136,0.2)') }}>
                  {tradeResult.pnl !== undefined && tradeResult.pnl !== null ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: green(tradeResult.pnl) }}>
                          {tradeResult.pnl >= 0 ? 'WIN' : 'LOSS'} · {(tradeResult.pnl >= 0 ? '+$' : '-$') + fmt(Math.abs(tradeResult.pnl))} ({pct(tradeResult.pnlPct ?? 0)})
                        </span>
                        <button onClick={speaking ? stopSpeaking : () => void speakText(tradeResult.coaching ?? '')}
                          className="p-1 rounded" style={{ color: '#4a6080' }}>
                          {speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                        </button>
                      </div>
                      {tradeResult.coaching && <p className="text-xs leading-relaxed text-white">{tradeResult.coaching}</p>}
                    </>
                  ) : (
                    <p className="text-xs text-white">Bought at ${tradeResult.price?.toFixed(2)} · Total ${tradeResult.total?.toFixed(2)}</p>
                  )}
                </div>
              )}
            </div>

            {/* Positions + History */}
            <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ border: '1px solid #1a2332' }}>
              {/* Tabs */}
              <div className="flex" style={{ borderBottom: '1px solid #1a2332', background: '#080C10' }}>
                {(['positions', 'history'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className="px-5 py-3 text-xs font-bold capitalize transition-all"
                    style={{
                      color: tab === t ? '#00FF88' : '#4a6080',
                      borderBottom: tab === t ? '2px solid #00FF88' : '2px solid transparent',
                    }}>
                    {t === 'positions' ? 'Open Positions' : 'Trade History'}
                  </button>
                ))}
              </div>

              {/* Positions */}
              {tab === 'positions' && (
                <div style={{ background: '#0d1219' }}>
                  {portfolio?.positions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                      <DollarSign size={32} style={{ color: '#1a2332' }} />
                      <p className="text-sm" style={{ color: '#4a6080' }}>No open positions — place a trade to get started</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: '1px solid #1a2332' }}>
                          {['Symbol', 'Shares', 'Avg Cost', 'Price', 'Value', 'P&L'].map(h => (
                            <th key={h} className="px-4 py-2.5 text-left text-xs font-bold" style={{ color: '#4a6080' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolio?.positions.map(p => (
                          <tr key={p.id} style={{ borderBottom: '1px solid #1a2332' }}>
                            <td className="px-4 py-3 font-bold text-white">{p.symbol}</td>
                            <td className="px-4 py-3 text-white">{p.shares}</td>
                            <td className="px-4 py-3" style={{ color: '#4a6080' }}>${fmt(p.avgCost)}</td>
                            <td className="px-4 py-3 text-white">${fmt(p.currentPrice)}</td>
                            <td className="px-4 py-3 text-white">${fmt(p.value)}</td>
                            <td className="px-4 py-3 font-bold" style={{ color: green(p.pnl) }}>
                              {p.pnl >= 0 ? '+' : ''}{fmt(p.pnl)} ({pct(p.pnlPct)})
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* History */}
              {tab === 'history' && (
                <div style={{ background: '#0d1219' }}>
                  {portfolio?.trades.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-2">
                      <ShieldAlert size={32} style={{ color: '#1a2332' }} />
                      <p className="text-sm" style={{ color: '#4a6080' }}>No trades yet</p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: '#1a2332' }}>
                      {portfolio?.trades.map(t => (
                        <div key={t.id} className="px-4 py-3 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="text-xs font-bold px-2 py-0.5 rounded shrink-0"
                              style={{
                                background: t.action === 'buy' ? 'rgba(0,255,136,0.12)' : 'rgba(255,59,59,0.12)',
                                color: t.action === 'buy' ? '#00FF88' : '#FF3B3B',
                              }}>
                              {t.action.toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <span className="font-bold text-white">{t.symbol}</span>
                              <span className="text-xs ml-2" style={{ color: '#4a6080' }}>{t.shares} sh @ ${fmt(t.price)}</span>
                              {t.coaching && <p className="text-xs mt-0.5 truncate" style={{ color: '#4a6080' }}>{t.coaching}</p>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold text-white">${fmt(t.total)}</div>
                            {t.pnl !== null && t.pnl !== undefined && (
                              <div className="text-xs font-bold" style={{ color: green(t.pnl) }}>
                                {t.pnl >= 0 ? '+' : ''}{fmt(t.pnl)}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
