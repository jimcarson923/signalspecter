import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { TrendingUp, Search, Filter } from 'lucide-react';
import { useState } from 'react';

interface StockData {
  symbol: string; companyName: string; price: number; change: number;
  changePercent: number; volume: number; ghostScore: number;
  bullishPressure: number; bearishPressure: number; institutionalConf: number;
  forecastScore: number; sector: string; trend: string;
}

function ScoreChip({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="w-9 h-9 rounded flex items-center justify-center text-xs font-bold tabular"
        style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}>
        {value}
      </div>
      <span className="text-[9px] uppercase tracking-wide" style={{ color: '#4a6080' }}>{label}</span>
    </div>
  );
}

export default function BullishScannerPage() {
  const [search, setSearch] = useState('');

  const { data: stocks, isLoading } = useQuery<StockData[]>({
    queryKey: ['/api/scanner/bullish'],
    queryFn: () => apiRequest('GET', '/api/scanner/bullish').then(r => r.json()),
    refetchInterval: 60000,
  });

  const filtered = stocks?.filter(s =>
    s.symbol.toLowerCase().includes(search.toLowerCase()) ||
    s.companyName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="p-5 space-y-4" style={{ background: '#0B0F14', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded flex items-center justify-center"
            style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)' }}>
            <TrendingUp size={16} style={{ color: '#00FF88' }} />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Bullish Scanner</h1>
            <p className="text-xs" style={{ color: '#4a6080' }}>High conviction bullish setups — Specter AI powered</p>
          </div>
        </div>
        <span className="badge-bullish text-xs px-3 py-1" data-testid="text-signal-count">
          {filtered.length} signals
        </span>
      </div>

      {/* Filter bar */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4a6080' }} />
          <input
            placeholder="Filter by symbol or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded text-sm outline-none"
            style={{ background: '#11161C', border: '1px solid #1a2332', color: '#c8d8e8' }}
            data-testid="input-scanner-search"
          />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded text-xs"
          style={{ background: '#11161C', border: '1px solid #1a2332', color: '#4a6080' }}>
          <Filter size={12} />
          Specter Score ≥ 55
        </div>
      </div>

      {/* Table */}
      <div className="rounded overflow-hidden" style={{ border: '1px solid #1a2332' }}>
        <table className="w-full text-xs">
          <thead>
            <tr style={{ background: '#0d1219', borderBottom: '1px solid #1a2332' }}>
              {['#', 'SYMBOL', 'COMPANY', 'SECTOR', 'SPECTER', 'BULLISH', 'INST.', 'FORECAST', 'PRICE', 'CHANGE'].map(h => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: '#4a6080' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #1a2332' }}>
                    {Array.from({ length: 10 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="skeleton h-3 w-14" /></td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                <tr><td colSpan={10} className="py-16 text-center" style={{ color: '#4a6080' }}>No bullish signals match your filter</td></tr>
              )
              : filtered.map((s, i) => (
                  <tr key={s.symbol} className="data-table-row" data-testid={`row-stock-${s.symbol}`}
                    style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td className="px-3 py-2.5" style={{ color: '#4a6080' }}>{i + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold" style={{ color: '#00FF88' }}>{s.symbol}</span>
                        {i < 3 && <span className="badge-bullish text-[9px] px-1.5 py-0.5">Top</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2.5" style={{ color: '#8899aa' }}>{s.companyName}</td>
                    <td className="px-3 py-2.5" style={{ color: '#4a6080' }}>{s.sector}</td>
                    <td className="px-3 py-2.5"><ScoreChip value={s.ghostScore} label="Score" color={s.ghostScore >= 70 ? '#00FF88' : '#F59E0B'} /></td>
                    <td className="px-3 py-2.5"><ScoreChip value={s.bullishPressure} label="Bull" color="#00FF88" /></td>
                    <td className="px-3 py-2.5"><ScoreChip value={s.institutionalConf} label="Inst" color="#3B82F6" /></td>
                    <td className="px-3 py-2.5"><ScoreChip value={s.forecastScore} label="Fcst" color="#A78BFA" /></td>
                    <td className="px-3 py-2.5 tabular font-bold text-white">${s.price.toFixed(2)}</td>
                    <td className="px-3 py-2.5 tabular font-semibold" style={{ color: s.changePercent >= 0 ? '#00FF88' : '#FF4444' }}>
                      {s.changePercent >= 0 ? '▲' : '▼'} {Math.abs(s.changePercent).toFixed(2)}%
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>

      <p className="text-xs text-center" style={{ color: '#4a6080' }}>
        Specter Score is an AI-generated signal, not financial advice. Always do your own research.
      </p>
    </div>
  );
}
