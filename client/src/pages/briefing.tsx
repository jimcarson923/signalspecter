import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Zap,
  RefreshCw,
  Clock,
  BarChart2,
  Eye,
  Shield,
} from 'lucide-react';

interface BriefingData {
  date: string;
  market_sentiment: 'Bullish' | 'Bearish' | 'Neutral';
  sentiment_score: number;
  headline: string;
  summary: string;
  key_themes: { title: string; detail: string; signal: 'bullish' | 'bearish' | 'neutral' }[];
  top_opportunities: { symbol: string; reason: string; ghost_score: number }[];
  top_risks: { symbol: string; reason: string; risk_level: 'High' | 'Medium' | 'Low' }[];
  sectors: { name: string; signal: 'bullish' | 'bearish' | 'neutral'; score: number }[];
  watch_list: string[];
  ai_confidence: number;
  generated_at: string;
}

function SentimentBadge({ sentiment }: { sentiment: string }) {
  if (sentiment === 'Bullish')
    return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Bullish</Badge>;
  if (sentiment === 'Bearish')
    return <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30">Bearish</Badge>;
  return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Neutral</Badge>;
}

function SignalDot({ signal }: { signal: 'bullish' | 'bearish' | 'neutral' }) {
  const colors = {
    bullish: 'bg-emerald-400',
    bearish: 'bg-rose-400',
    neutral: 'bg-amber-400',
  };
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[signal]} mt-1.5 flex-shrink-0`} />;
}

function ThemeCard({ theme }: { theme: BriefingData['key_themes'][0] }) {
  const borderColors = {
    bullish: 'border-l-emerald-500',
    bearish: 'border-l-rose-500',
    neutral: 'border-l-amber-500',
  };
  return (
    <div className={`border-l-2 pl-3 py-1 ${borderColors[theme.signal]}`}>
      <div className="flex items-start gap-2">
        <SignalDot signal={theme.signal} />
        <div>
          <p className="text-sm font-medium text-foreground">{theme.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{theme.detail}</p>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 65 ? '#34d399' : score >= 45 ? '#fbbf24' : '#f87171';
  return (
    <svg width={size} height={size} className="rotate-[-90deg]" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(222 18% 18%)" strokeWidth={4} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

function BriefingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32 w-full rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Skeleton className="h-64 rounded-xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  );
}

export default function BriefingPage() {
  const { data: briefing, isLoading, isError, refetch, isFetching } = useQuery<BriefingData>({
    queryKey: ['/api/briefing/daily'],
    queryFn: () => apiRequest('GET', '/api/briefing/daily').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">AI Daily Briefing</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Specter AI AI market intelligence, updated each morning
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5 text-xs"
          data-testid="button-refresh-briefing"
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading && <BriefingSkeleton />}

      {isError && (
        <Card className="border-rose-500/30 bg-rose-500/5">
          <CardContent className="flex items-center gap-3 py-6">
            <AlertTriangle className="w-5 h-5 text-rose-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-rose-400">Failed to load briefing</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Specter AI AI is temporarily unavailable. Please try again.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => refetch()} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {briefing && (
        <>
          {/* Hero card — headline + sentiment */}
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-transparent overflow-hidden">
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <SentimentBadge sentiment={briefing.market_sentiment} />
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {briefing.generated_at}
                    </span>
                  </div>
                  <h2 className="text-base font-bold leading-snug text-foreground mb-2" data-testid="text-briefing-headline">
                    {briefing.headline}
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">{briefing.summary}</p>
                </div>
                {/* Confidence meter */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="relative">
                    <ScoreRing score={briefing.ai_confidence} size={56} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-bold tabular-nums">{briefing.ai_confidence}</span>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    AI
                    <br />
                    Confidence
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key themes + sectors */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Key themes */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="w-4 h-4 text-primary" />
                  Key Market Themes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.key_themes.map((theme, i) => (
                  <ThemeCard key={i} theme={theme} />
                ))}
              </CardContent>
            </Card>

            {/* Sector signals */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  Sector Signals
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {briefing.sectors.map((sector, i) => {
                  const scoreColor =
                    sector.score >= 65
                      ? 'text-emerald-400'
                      : sector.score >= 45
                      ? 'text-amber-400'
                      : 'text-rose-400';
                  const barColor =
                    sector.score >= 65
                      ? 'bg-emerald-500'
                      : sector.score >= 45
                      ? 'bg-amber-500'
                      : 'bg-rose-500';
                  return (
                    <div key={i} data-testid={`sector-signal-${i}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{sector.name}</span>
                        <span className={`text-xs font-bold tabular-nums ${scoreColor}`}>{sector.score}</span>
                      </div>
                      <div className="h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${barColor}`}
                          style={{ width: `${sector.score}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Opportunities + Risks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top Opportunities */}
            <Card className="border-emerald-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Top Opportunities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.top_opportunities.map((opp, i) => (
                  <div key={i} className="flex items-start gap-3" data-testid={`opportunity-${i}`}>
                    <div className="relative flex-shrink-0">
                      <ScoreRing score={opp.ghost_score} size={40} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-bold tabular-nums">{opp.ghost_score}</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm font-bold text-foreground">{opp.symbol}</span>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{opp.reason}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Top Risks */}
            <Card className="border-rose-500/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-rose-400" />
                  Risk Watch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {briefing.top_risks.map((risk, i) => {
                  const riskColor =
                    risk.risk_level === 'High'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                      : risk.risk_level === 'Medium'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-slate-500/20 text-slate-400 border-slate-500/30';
                  return (
                    <div key={i} className="flex items-start gap-3" data-testid={`risk-${i}`}>
                      <div className="flex-shrink-0 mt-0.5">
                        <Badge className={`text-[10px] px-1.5 py-0 ${riskColor}`}>{risk.risk_level}</Badge>
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm font-bold text-foreground">{risk.symbol}</span>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{risk.reason}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Watch list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                Specter AI Watch List Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {briefing.watch_list.map((sym, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="font-mono font-bold text-xs border-primary/30 text-primary hover:bg-primary/10 cursor-default"
                    data-testid={`watchlist-symbol-${i}`}
                  >
                    {sym}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Separator className="opacity-30" />
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed max-w-2xl mx-auto">
            SignalSpecter AI Briefings are generated for informational and educational purposes only. This is not financial advice.
            All data is simulated. Past performance does not guarantee future results.
          </p>
        </>
      )}
    </div>
  );
}
