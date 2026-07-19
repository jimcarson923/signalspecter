// v1784484324 double-voice fix: conditional SpecterPanel mount
import { Switch, Route, Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { SpecterPanel } from '@/components/specter-panel';
import { useState, useEffect } from 'react';
import { Sun, Moon, Bell, LogOut, LayoutDashboard, TrendingUp, TrendingDown, Search, Bot } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

// Pages
import DashboardPage from '@/pages/dashboard';
import BullishScannerPage from '@/pages/bullish-scanner';
import BearishScannerPage from '@/pages/bearish-scanner';
import WatchlistPage from '@/pages/watchlist';
import BriefingPage from '@/pages/briefing';
import PricingPage from '@/pages/pricing';
import AlertsPage from '@/pages/alerts';
import ReportsPage from '@/pages/reports';
import SettingsPage from '@/pages/settings';
import PriceRangeScannerPage from '@/pages/price-range-scanner';
import NotFound from '@/pages/not-found';
import LoginPage from '@/pages/login';
import SignupPage from '@/pages/signup';

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/bullish" component={BullishScannerPage} />
      <Route path="/bearish" component={BearishScannerPage} />
      <Route path="/watchlist" component={WatchlistPage} />
      <Route path="/briefing" component={BriefingPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/alerts" component={AlertsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/price-range" component={PriceRangeScannerPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle('light', !dark);
  }, [dark]);
  return (
    <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading SignalSpecter...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (mode === 'signup') return <SignupPage onSwitch={() => setMode('login')} />;
    return <LoginPage onSwitch={() => setMode('signup')} />;
  }

  return <>{children}</>;
}

// Mobile bottom nav — thumb-friendly, 5 key destinations
function MobileBottomNav({ specterOpen, setSpecterOpen }: { specterOpen: boolean; setSpecterOpen: (v: boolean) => void }) {
  const [, navigate] = useHashLocation();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: TrendingUp, label: 'Bullish', path: '/bullish' },
    { icon: Search, label: 'Scanner', path: '/price-range' },
    { icon: TrendingDown, label: 'Bearish', path: '/bearish' },
    { icon: Bot, label: 'Specter', path: null },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#0B0F14] border-t border-[#00FF88]/20 flex items-center md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isSpecter = item.label === 'Specter';
        return (
          <button
            key={item.label}
            onClick={() => {
              if (isSpecter) {
                setSpecterOpen(!specterOpen);
              } else if (item.path) {
                navigate(item.path);
                setSpecterOpen(false);
              }
            }}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-h-[56px] ${
              isSpecter && specterOpen
                ? 'text-[#00FF88]'
                : 'text-zinc-500 hover:text-zinc-300 active:text-[#00FF88]'
            }`}
          >
            {isSpecter ? (
              <div className="relative">
                <div className={`w-8 h-8 rounded-full border flex items-center justify-center transition-all ${
                  specterOpen ? 'bg-[#00FF88]/20 border-[#00FF88]' : 'bg-zinc-800 border-zinc-700'
                }`}>
                  <span className={`text-[11px] font-bold ${specterOpen ? 'text-[#00FF88]' : 'text-zinc-400'}`}>S</span>
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" />
              </div>
            ) : (
              <Icon className="h-5 w-5" />
            )}
            <span className="text-[9px] font-medium tracking-wide">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// Mobile Specter drawer — slides up from bottom on mobile
function MobileSpecterDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      {/* Drawer */}
      <div className={`fixed left-0 right-0 bottom-0 z-50 md:hidden transition-transform duration-300 ease-out ${
        open ? 'translate-y-0' : 'translate-y-full'
      }`} style={{ height: '80vh', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="h-full rounded-t-2xl overflow-hidden border-t border-[#00FF88]/30 shadow-2xl">
          {/* Drag handle */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 bg-zinc-700 rounded-full z-10" />
          {specterOpen && <SpecterPanel />}
        </div>
      </div>
    </>
  );
}

function AppShell() {
  const { user, logout } = useAuth();
  const [specterOpen, setSpecterOpen] = useState(false);
  const sidebarStyle = {
    '--sidebar-width': '15rem',
    '--sidebar-width-icon': '3.5rem',
  };
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U';

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden bg-background">

        {/* Sidebar — hidden on mobile, visible on desktop */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between px-4 h-12 border-b border-border/60 bg-card/50 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-3">
              {/* Desktop: sidebar trigger */}
              <div className="hidden md:block">
                <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground" />
              </div>
              {/* Mobile: app name */}
              <div className="md:hidden flex items-center gap-2">
                <span className="text-sm font-bold text-[#00FF88] tracking-wider">SIGNAL</span>
                <span className="text-sm font-bold text-white tracking-wider">SPECTER</span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-muted-foreground">Market Open</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground relative">
                <Bell className="h-4 w-4" />
                <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 text-[9px] bg-primary text-primary-foreground flex items-center justify-center">3</Badge>
              </Button>
              <ThemeToggle />
              <div className="flex items-center gap-2 pl-2 border-l border-border">
                <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{initials}</span>
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-medium leading-none">{user?.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{user?.plan} Plan</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-400" onClick={() => logout()} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>

          {/* Main content area */}
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <main className="flex-1 overflow-y-auto overscroll-contain pb-16 md:pb-0">
              <Router hook={useHashLocation}>
                <AppRouter />
              </Router>
            </main>

            {/* Desktop Specter panel — always visible on right side */}
            <div className="hidden md:block">
              <SpecterPanel />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav specterOpen={specterOpen} setSpecterOpen={setSpecterOpen} />

      {/* Mobile Specter drawer */}
      <MobileSpecterDrawer open={specterOpen} onClose={() => setSpecterOpen(false)} />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthGate>
          <AppShell />
        </AuthGate>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
