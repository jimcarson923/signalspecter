import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { SlidersHorizontal, Search, TrendingUp, DollarSign } from 'lucide-react';

interface StockData {
  symbol: string;
  companyName: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  ghostScore: number;
  bullishPressure: number;
  bearishPressure: number;
  institutionalConf: number;
  forecastScore: number;
  sector: string;
  trend: string;
}

interface ScanResult {
  min: number;
  max: number;
  count: number;
  results: StockData[];
}

function ScoreChip({ value, color }: { value: number; color: string }) {
  return (
    <div
      className="w-9 h-9 rounded flex items-center justify-center text-xs font-bold tabular"
      style={{ background: `${color}18`, color, border: `1px solid ${color}30` }}
    >
      {Math.round(value)}
    </div>
  );
}

const QUICK_RANGES = [
  { label: 'Under $5',    min: 0.01, max: 5 },
  { label: '$5 – $10',   min: 5,    max: 10 },
  { label: '$10 – $15',  min: 10,   max: 15 },
  { label: '$15 – $25',  min: 15,   max: 25 },
  { label: '$25 – $50',  min: 25,   max: 50 },
  { label: '$50 – $100', min: 50,   max: 100 },
  { label: '$100 – $200',min: 100,  max: 200 },
  { label: 'Over $200',  min: 200,  max: 99999 },
];

export default function PriceRangeScannerPage() {
  const [minInput, setMinInput] = useState('10');
  const [maxInput, setMaxInput] = useState('15');
  const [activeMin, setActiveMin] = useState<number | null>(null);
  const [activeMax, setActiveMax] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, isFetching } = useQuery<ScanResult>({
    queryKey: ['/api/scanner/price-range', activeMin, activeMax],
    queryFn: () =>
      apiRequest('GET', `/api/scanner/price-range?min=${activeMin}&max=${activeMax}`).then(r => r.json()),
    enabled: submitted && activeMin !== null && activeMax !== null,
    staleTime: 60000,
  });

  function runScan(min?: number, max?: number) {
    const mn = min ?? parseFloat(minInput);
    const mx = max ?? parseFloat(maxInput);
    if (isNaN(mn) || isNaN(mx) || mn < 0 || mx <= mn) return;
    setActiveMin(mn);
    setActiveMax(mx);
    setSubmitted(true);
  }

  function applyQuick(range: typeof QUICK_RANGES[0]) {
    setMinInput(String(range.min));
    setMaxInput(String(range.max));
    runScan(range.min, range.max);
  }

  const results = data?.results ?? [];

  return (
    <div className="p-5 space-y-5" style={{ background: '#0B0F14', minHeight: '100%' }}>

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded flex items-center justify-center"
          style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)' }}>
          <DollarSign size={16} style={{ color: '#00FF88' }} />
        </div>
        <div>
          <h1 className="text-base font-bold text-white">Price Range Scanner</h1>
          <p className="text-xs" style={{ color: '#4a6080' }}>
            Find top opportunities within any price range — ranked by Specter Score
          </p>
        </div>
      </div>

      {/* Search controls */}
      <div className="rounded p-4 space-y-4" style={{ background: '#11161C', border: '1px solid #1a2332' }}>

        {/* Manual min/max inputs */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: '#4a6080' }}>MIN PRICE ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={minInput}
              onChange={e => setMinInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runScan()}
              className="w-28 px-3 py-2 rounded text-sm outline-none tabular"
              style={{ background: '#0d1219', border: '1px solid #1a2332', color: '#c8d8e8' }}
              data-testid="input-price-min"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold" style={{ color: '#4a6080' }}>MAX PRICE ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={maxInput}
              onChange={e => setMaxInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && runScan()}
              className="w-28 px-3 py-2 rounded text-sm outline-none tabular"
              style={{ background: '#0d1219', border: '1px solid #1a2332', color: '#c8d8e8' }}
              data-testid="input-price-max"
            />
          </div>
          <button
            onClick={() => runScan()}
            disabled={isLoading || isFetching}
            className="flex items-center gap-2 px-5 py-2 rounded text-sm font-bold transition-opacity"
            style={{
              background: 'rgba(0,255,136,0.12)',
              color: '#00FF88',
              border: '1px solid rgba(0,255,136,0.3)',
              opacity: isLoading || isFetching ? 0.6 : 1,
            }}
            data-testid="button-run-scan"
          >
            <Search size={13} />
            {isLoading || isFetching ? 'Scanning...' : 'Scan'}
          </button>
        </div>

        {/* Quick range buttons */}
        <div className="flex flex-wrap gap-2">
          {QUICK_RANGES.map(r => {
            const isActive = activeMin === r.min && activeMax === r.max;
            return (
              <button
                key={r.label}
                onClick={() => applyQuick(r)}
                className="px-3 py-1 rounded text-xs font-medium transition-all"
                style={{
                  background: isActive ? 'rgba(0,255,136,0.15)' : '#0d1219',
                  color: isActive ? '#00FF88' : '#6b8299',
                  border: isActive ? '1px solid rgba(0,255,136,0.4)' : '1px solid #1a2332',
                }}
                data-testid={`button-quick-range-${r.label.replace(/\s/g, '-')}`}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results */}
      {!submitted && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <SlidersHorizontal size={36} style={{ color: '#1a2332' }} />
          <p className="text-sm" style={{ color: '#4a6080' }}>
            Enter a price range above or pick a quick range to start scanning
          </p>
        </div>
      )}

      {submitted && (isLoading || isFetching) && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin"
            style={{ borderColor: 'rgba(0,255,136,0.3)', borderTopColor: '#00FF88' }} />
          <p className="text-sm" style={{ color: '#4a6080' }}>
            Scanning ${activeMin} – ${activeMax} range...
          </p>
        </div>
      )}

      {submitted && !isLoading && !isFetching && (
        <div className="space-y-3">
          {/* Result summary bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} style={{ color: '#00FF88' }} />
              <span className="text-sm font-bold text-white">
                ${activeMin} – ${activeMax === 99999 ? '200+' : activeMax} Range
              </span>
            </div>
            <span className="text-xs px-3 py-1 rounded font-semibold"
              style={{ background: 'rgba(0,255,136,0.08)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}
              data-testid="text-result-count">
              {results.length} stocks found
            </span>
          </div>

          {results.length === 0 ? (
            <div className="py-16 text-center rounded" style={{ background: '#11161C', border: '1px solid #1a2332' }}>
              <p className="text-sm" style={{ color: '#4a6080' }}>
                No stocks found in the ${activeMin} – ${activeMax} range right now.
              </p>
            </div>
          ) : (
            <div className="rounded overflow-hidden" style={{ border: '1px solid #1a2332' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: '#0d1219', borderBottom: '1px solid #1a2332' }}>
                    {['#', 'SYMBOL', 'COMPANY', 'SECTOR', 'SPECTER', 'BULLISH', 'INST.', 'PRICE', 'CHANGE', 'TREND'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold" style={{ color: '#4a6080' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((s, i) => (
                    <tr
                      key={s.symbol}
                      style={{
                        borderBottom: '1px solid #1a2332',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                      }}
                      data-testid={`row-result-${s.symbol}`}
                    >
                      <td className="px-3 py-2.5" style={{ color: '#4a6080' }}>{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold" style={{ color: '#00FF88' }}>{s.symbol}</span>
                          {i < 3 && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                              style={{ background: 'rgba(0,255,136,0.1)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.2)' }}>
                              TOP
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5" style={{ color: '#8899aa' }}>{s.companyName}</td>
                      <td className="px-3 py-2.5" style={{ color: '#4a6080' }}>{s.sector}</td>
                      <td className="px-3 py-2.5">
                        <ScoreChip value={s.ghostScore} color={s.ghostScore >= 70 ? '#00FF88' : s.ghostScore >= 50 ? '#F59E0B' : '#FF4444'} />
                      </td>
                      <td className="px-3 py-2.5">
                        <ScoreChip value={s.bullishPressure} color="#00FF88" />
                      </td>
                      <td className="px-3 py-2.5">
                        <ScoreChip value={s.institutionalConf} color="#3B82F6" />
                      </td>
                      <td className="px-3 py-2.5 tabular font-bold text-white">${s.price.toFixed(2)}</td>
                      <td className="px-3 py-2.5 tabular font-semibold"
                        style={{ color: s.changePercent >= 0 ? '#00FF88' : '#FF4444' }}>
                        {s.changePercent >= 0 ? '▲' : '▼'} {Math.abs(s.changePercent).toFixed(2)}%
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold capitalize"
                          style={{
                            background: s.trend === 'bullish' ? 'rgba(0,255,136,0.1)' : s.trend === 'bearish' ? 'rgba(255,68,68,0.1)' : 'rgba(245,158,11,0.1)',
                            color: s.trend === 'bullish' ? '#00FF88' : s.trend === 'bearish' ? '#FF4444' : '#F59E0B',
                          }}>
                          {s.trend}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-center pb-2" style={{ color: '#4a6080' }}>
        Specter Score is an AI-generated signal, not financial advice. Always do your own research.
      </p>
    </div>
  );
}
