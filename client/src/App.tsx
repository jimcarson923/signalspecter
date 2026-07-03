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
import { Sun, Moon, Bell, LogOut } from 'lucide-react';
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
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setDark(!dark)}
      className="h-8 w-8 text-muted-foreground hover:text-foreground"
    >
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
    if (mode === 'signup') {
      return <SignupPage onSwitch={() => setMode('login')} />;
    }
    return <LoginPage onSwitch={() => setMode('signup')} />;
  }

  return <>{children}</>;
}

function AppShell() {
  const { user, logout } = useAuth();
  const sidebarStyle = {
    '--sidebar-width': '15rem',
    '--sidebar-width-icon': '3.5rem',
  };
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U';

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <header className="flex items-center justify-between px-4 h-12 border-b border-border/60 bg-card/50 backdrop-blur-sm flex-shrink-0">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground" />
              <div className="hidden sm:flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-muted-foreground tabular">Market Open</span>
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-red-400"
                onClick={() => logout()}
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <div className="flex flex-1 min-h-0 overflow-hidden">
            <main className="flex-1 overflow-y-auto overscroll-contain">
              <Router hook={useHashLocation}>
                <AppRouter />
              </Router>
            </main>
            {/* Specter AI Panel — always visible on the right */}
            <SpecterPanel />
          </div>
        </div>
      </div>
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
