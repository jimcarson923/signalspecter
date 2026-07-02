import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Check,
  Zap,
  Crown,
  Rocket,
  Building2,
  Ghost,
  TrendingUp,
  Brain,
  BarChart2,
  Shield,
  Users,
  Infinity,
  Star,
} from 'lucide-react';

interface Tier {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  icon: React.ReactNode;
  accent: string;
  accentBg: string;
  accentBorder: string;
  badge?: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

const tiers: Tier[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Everything you need to start trading smarter',
    priceMonthly: 29,
    priceAnnual: 19,
    icon: <Ghost className="w-5 h-5" />,
    accent: 'text-slate-300',
    accentBg: 'bg-slate-500/10',
    accentBorder: 'border-slate-500/20',
    features: [
      'Specter Score for any stock',
      'AI plain-English explanations',
      'Bullish & Bearish scanner',
      'Personal watchlist (up to 25 stocks)',
      'Daily AI market briefing',
      'Basic price & volume signals',
      'Mobile-friendly dashboard',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'professional',
    name: 'Professional',
    tagline: 'Institutional-grade intelligence for serious traders',
    priceMonthly: 79,
    priceAnnual: 49,
    icon: <TrendingUp className="w-5 h-5" />,
    accent: 'text-primary',
    accentBg: 'bg-primary/10',
    accentBorder: 'border-primary/30',
    badge: 'Most Popular',
    popular: true,
    features: [
      'Everything in Starter',
      'Institutional flow intelligence',
      'Strategy Lab (backtesting)',
      'Portfolio intelligence dashboard',
      'News sentiment AI analysis',
      'Unlimited watchlists',
      'Earnings & catalyst calendar',
      'Priority email support',
    ],
    cta: 'Start Free Trial',
  },
  {
    id: 'elite',
    name: 'Elite',
    tagline: 'Maximum power for high-frequency decision makers',
    priceMonthly: 299,
    priceAnnual: 149,
    icon: <Crown className="w-5 h-5" />,
    accent: 'text-amber-400',
    accentBg: 'bg-amber-500/10',
    accentBorder: 'border-amber-500/30',
    badge: 'Best Value',
    features: [
      'Everything in Professional',
      'Unlimited scanner access',
      'Historical backtesting (10yr+)',
      'Advanced AI forecasting engine',
      'Full REST API access',
      'Real-time alert webhooks',
      'Custom scan builder',
      'Dedicated Slack support channel',
    ],
    cta: 'Go Elite',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Built for teams, funds, and institutional clients',
    priceMonthly: null,
    priceAnnual: null,
    icon: <Building2 className="w-5 h-5" />,
    accent: 'text-purple-400',
    accentBg: 'bg-purple-500/10',
    accentBorder: 'border-purple-500/30',
    features: [
      'Everything in Elite',
      'Multi-user team collaboration',
      'White-label branding option',
      'Custom AI model fine-tuning',
      'Dedicated account manager',
      'SLA uptime guarantees',
      'Onboarding & training sessions',
      'Custom data integrations',
    ],
    cta: 'Contact Sales',
  },
];

const featureComparison = [
  { feature: 'Specter Score', starter: true, pro: true, elite: true, enterprise: true },
  { feature: 'AI Explanations', starter: true, pro: true, elite: true, enterprise: true },
  { feature: 'Bullish/Bearish Scanner', starter: true, pro: true, elite: true, enterprise: true },
  { feature: 'Daily AI Briefing', starter: true, pro: true, elite: true, enterprise: true },
  { feature: 'Institutional Flow', starter: false, pro: true, elite: true, enterprise: true },
  { feature: 'Strategy Lab', starter: false, pro: true, elite: true, enterprise: true },
  { feature: 'Portfolio Intelligence', starter: false, pro: true, elite: true, enterprise: true },
  { feature: 'Historical Backtesting', starter: false, pro: false, elite: true, enterprise: true },
  { feature: 'API Access', starter: false, pro: false, elite: true, enterprise: true },
  { feature: 'White-label', starter: false, pro: false, elite: false, enterprise: true },
  { feature: 'Team Collaboration', starter: false, pro: false, elite: false, enterprise: true },
];

function CheckCell({ value }: { value: boolean }) {
  return value ? (
    <div className="flex justify-center">
      <Check className="w-4 h-4 text-emerald-400" />
    </div>
  ) : (
    <div className="flex justify-center">
      <span className="text-muted-foreground/30 text-lg leading-none">–</span>
    </div>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="p-4 md:p-6 space-y-10 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="text-center space-y-3 pt-2">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Rocket className="w-4 h-4 text-primary" />
          </div>
        </div>
        <h1 className="text-xl font-bold tracking-tight">Simple, Transparent Pricing</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
          Every plan includes a 14-day free trial. No credit card required to start.
        </p>

        {/* Billing toggle */}
        <div className="inline-flex items-center gap-3 bg-card border border-border rounded-full px-4 py-2 mt-2">
          <button
            onClick={() => setAnnual(false)}
            className={`text-xs font-medium transition-colors ${!annual ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            data-testid="button-billing-monthly"
          >
            Monthly
          </button>
          <button
            onClick={() => setAnnual(true)}
            className={`text-xs font-medium transition-colors ${annual ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            data-testid="button-billing-annual"
          >
            Annual
          </button>
          {annual && (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] py-0 px-1.5">
              Save up to 40%
            </Badge>
          )}
        </div>
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={`relative flex flex-col transition-all ${
              tier.popular
                ? 'border-primary/50 shadow-lg shadow-primary/10 ring-1 ring-primary/20'
                : `${tier.accentBorder}`
            }`}
            data-testid={`card-tier-${tier.id}`}
          >
            {tier.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                <Badge
                  className={`text-[10px] px-2.5 py-0.5 ${
                    tier.popular
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {tier.badge === 'Most Popular' && <Star className="w-2.5 h-2.5 mr-1" />}
                  {tier.badge}
                </Badge>
              </div>
            )}

            <CardHeader className="pb-4 pt-6">
              <div className={`w-9 h-9 rounded-lg ${tier.accentBg} border ${tier.accentBorder} flex items-center justify-center mb-3 ${tier.accent}`}>
                {tier.icon}
              </div>
              <h2 className="text-base font-bold">{tier.name}</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">{tier.tagline}</p>

              {/* Price */}
              <div className="pt-2">
                {tier.priceMonthly !== null ? (
                  <div className="flex items-end gap-1">
                    <span className="text-2xl font-bold tabular-nums text-foreground">
                      ${annual ? tier.priceAnnual : tier.priceMonthly}
                    </span>
                    <span className="text-xs text-muted-foreground pb-1">/mo</span>
                  </div>
                ) : (
                  <div className="text-xl font-bold text-foreground">Custom</div>
                )}
                {tier.priceMonthly !== null && annual && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Billed annually · ${(tier.priceAnnual! * 12).toLocaleString()}/yr
                  </p>
                )}
                {tier.priceMonthly !== null && !annual && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Billed monthly</p>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex flex-col flex-1 gap-4 pt-0">
              <Button
                className={`w-full text-xs h-8 ${
                  tier.popular
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                    : 'variant-outline'
                }`}
                variant={tier.popular ? 'default' : 'outline'}
                data-testid={`button-cta-${tier.id}`}
              >
                {tier.cta}
              </Button>

              <Separator className="opacity-30" />

              <ul className="space-y-2 flex-1">
                {tier.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${tier.accent}`} />
                    <span className="text-xs text-muted-foreground leading-relaxed">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Specter AI AI callout */}
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-primary/5">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
              <Brain className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold mb-1">Powered by Specter AI AI</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Every plan is backed by our proprietary Specter AI AI engine — the same institutional-grade intelligence
                used by professional traders, delivered in plain English so anyone can act on it.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature comparison table */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Full Feature Comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-xs" data-testid="table-feature-comparison">
            <thead>
              <tr className="border-b border-border bg-card/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground w-1/3">Feature</th>
                <th className="py-3 px-3 font-medium text-slate-300 text-center">Starter</th>
                <th className="py-3 px-3 font-medium text-primary text-center">Pro</th>
                <th className="py-3 px-3 font-medium text-amber-400 text-center">Elite</th>
                <th className="py-3 px-3 font-medium text-purple-400 text-center">Enterprise</th>
              </tr>
            </thead>
            <tbody>
              {featureComparison.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b border-border/50 last:border-0 ${i % 2 === 0 ? '' : 'bg-card/30'}`}
                  data-testid={`row-feature-${i}`}
                >
                  <td className="py-2.5 px-4 text-muted-foreground">{row.feature}</td>
                  <td className="py-2.5 px-3"><CheckCell value={row.starter} /></td>
                  <td className="py-2.5 px-3"><CheckCell value={row.pro} /></td>
                  <td className="py-2.5 px-3"><CheckCell value={row.elite} /></td>
                  <td className="py-2.5 px-3"><CheckCell value={row.enterprise} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ / trust row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4">
        {[
          { icon: <Shield className="w-4 h-4" />, title: '14-Day Free Trial', desc: 'Try any plan free. No credit card required.' },
          { icon: <Infinity className="w-4 h-4" />, title: 'Cancel Anytime', desc: 'No contracts. Cancel in one click, no questions asked.' },
          { icon: <Users className="w-4 h-4" />, title: 'Dedicated Support', desc: 'Real humans available via email, Slack, and phone.' },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3 p-4 rounded-xl border border-border/50 bg-card/30">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
              {item.icon}
            </div>
            <div>
              <p className="text-xs font-semibold">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Separator className="opacity-30" />
      <p className="text-[10px] text-muted-foreground text-center leading-relaxed max-w-2xl mx-auto pb-2">
        SignalSpecter is an educational and informational platform. Pricing shown is illustrative. Nothing on this platform constitutes financial advice.
        Always consult a licensed financial advisor before making investment decisions.
      </p>
    </div>
  );
}
