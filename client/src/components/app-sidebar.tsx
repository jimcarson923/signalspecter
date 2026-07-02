import { Link, useLocation } from 'wouter';
import {
  LayoutDashboard, TrendingUp, TrendingDown, BookMarked,
  Brain, DollarSign, Bell, Settings, FileText, ChevronRight
} from 'lucide-react';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard',       href: '/' },
  { icon: TrendingUp,      label: 'Bullish Scanner', href: '/scanner/bullish' },
  { icon: TrendingDown,    label: 'Bearish Scanner', href: '/scanner/bearish' },
  { icon: BookMarked,      label: 'Watchlist',       href: '/watchlist' },
  { icon: Brain,           label: 'AI Briefing',     href: '/briefing' },
  { icon: Bell,            label: 'Alerts',          href: '/alerts' },
  { icon: FileText,        label: 'Reports',         href: '/reports' },
  { icon: DollarSign,      label: 'Pricing',         href: '/pricing' },
  { icon: Settings,        label: 'Settings',        href: '/settings' },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <aside
      style={{ background: '#080C10', borderRight: '1px solid #1a2332', width: '220px', minHeight: '100vh' }}
      className="flex flex-col flex-shrink-0"
      data-sidebar="sidebar"
    >
      {/* Brand */}
      <div className="px-4 py-5 border-b" style={{ borderColor: '#1a2332' }}>
        <div className="flex items-center gap-2 mb-1">
          {/* Specter icon */}
          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.3)' }}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
              <path d="M12 2C8 2 5 5.5 5 9c0 2.5 1 4.5 2.5 5.8L7 20h10l-.5-5.2C18 13.5 19 11.5 19 9c0-3.5-3-7-7-7z"
                fill="rgba(0,255,136,0.15)" stroke="#00FF88" strokeWidth="1.2"/>
              <ellipse cx="9.5" cy="9" rx="1.2" ry="1.5" fill="#00FF88"/>
              <ellipse cx="14.5" cy="9" rx="1.2" ry="1.5" fill="#00FF88"/>
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">
              <span className="text-white">SIGNAL</span>
              <span style={{ color: '#00FF88' }}>SPECTER</span>
            </div>
            <div className="text-xs" style={{ color: '#4a6080', lineHeight: 1.2 }}>AI Market Intelligence</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 overflow-y-auto">
        {navItems.map(({ icon: Icon, label, href }) => {
          const active = location === href || (href !== '/' && location.startsWith(href));
          return (
            <Link key={href} href={href}>
              <div
                data-testid={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
                className="flex items-center gap-3 px-4 py-2.5 mx-2 rounded cursor-pointer transition-all duration-150 group"
                style={{
                  background: active ? 'rgba(0,255,136,0.08)' : 'transparent',
                  borderLeft: active ? '2px solid #00FF88' : '2px solid transparent',
                  marginLeft: active ? '6px' : '8px',
                }}
              >
                <Icon
                  size={16}
                  style={{ color: active ? '#00FF88' : '#4a6080', flexShrink: 0 }}
                  className="group-hover:text-green-400 transition-colors"
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: active ? '#00FF88' : '#6b8299' }}
                >
                  {label}
                </span>
                {active && <ChevronRight size={12} style={{ color: '#00FF88', marginLeft: 'auto' }} />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t" style={{ borderColor: '#1a2332' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{ background: 'rgba(0,255,136,0.15)', color: '#00FF88', border: '1px solid rgba(0,255,136,0.3)' }}>
            J
          </div>
          <div>
            <div className="text-xs font-medium text-white">Pro Plan</div>
            <div className="text-xs" style={{ color: '#4a6080' }}>Specter AI Active</div>
          </div>
          <div className="ml-auto">
            <div className="market-open-dot" />
          </div>
        </div>
      </div>
    </aside>
  );
}
