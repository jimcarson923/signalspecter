import { Switch, Route, Router } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { useState, useEffect } from 'react';
import { Sun, Moon, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

// Pages
import DashboardPage from '@/pages/dashboard';
import BullishScannerPage from '@/pages/bullish-scanner';
import BearishScannerPage from '@/pages/bearish-scanner';
import WatchlistPage from '@/pages/watchlist';
import BriefingPage from '@/pages/briefing';
import PricingPage from '@/pages/pricing';
import NotFound from '@/pages/not-found';

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/bullish" component={BullishScannerPage} />
      <Route path="/bearish" component={BearishScannerPage} />
      <Route path="/watchlist" component={WatchlistPage} />
      <Route path="/briefing" component={BriefingPage} />
      <Route path="/pricing" component={PricingPage} />
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
      data-testid="button-theme-toggle"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

export default function App() {
  const sidebarStyle = {
    '--sidebar-width': '15rem',
    '--sidebar-width-icon': '3.5rem',
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={sidebarStyle as React.CSSProperties}>
          <div className="flex h-screen w-full overflow-hidden bg-background">
            <AppSidebar />
            <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
              {/* Top header bar */}
              <header className="flex items-center justify-between px-4 h-12 border-b border-border/60 bg-card/50 backdrop-blur-sm flex-shrink-0">
                <div className="flex items-center gap-3">
                  <SidebarTrigger className="h-7 w-7 text-muted-foreground hover:text-foreground" data-testid="button-sidebar-toggle" />
                  <div className="hidden sm:flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs text-muted-foreground tabular">Market Open</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground relative" data-testid="button-notifications">
                    <Bell className="h-4 w-4" />
                    <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 p-0 text-[9px] bg-primary text-primary-foreground flex items-center justify-center">3</Badge>
                  </Button>
                  <ThemeToggle />
                  <div className="flex items-center gap-2 pl-2 border-l border-border">
                    <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">JC</span>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs font-medium leading-none">James Carson</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Pro Plan</p>
                    </div>
                  </div>
                </div>
              </header>
              {/* Main content */}
              <main className="flex-1 overflow-y-auto overscroll-contain">
                <Router hook={useHashLocation}>
                  <AppRouter />
                </Router>
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
