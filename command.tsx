@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  /* SignalSpecter — Dark fintech palette
     Exact match to design reference:
     Background: #0B0F14  Surface: #11161C
     Primary: #00FF88 (neon green)  Accent: #3B82F6 (blue)
  */
  :root {
    --background: 214 31% 6%;
    --foreground: 210 20% 88%;
    --card: 214 25% 9%;
    --card-foreground: 210 20% 88%;
    --popover: 214 25% 8%;
    --popover-foreground: 210 20% 88%;
    --primary: 153 100% 50%;
    --primary-foreground: 214 31% 6%;
    --secondary: 214 20% 14%;
    --secondary-foreground: 210 15% 70%;
    --muted: 214 20% 12%;
    --muted-foreground: 210 10% 48%;
    --accent: 217 91% 60%;
    --accent-foreground: 214 31% 6%;
    --destructive: 0 72% 55%;
    --destructive-foreground: 0 0% 98%;
    --border: 214 18% 14%;
    --input: 214 18% 14%;
    --ring: 153 100% 50%;
    --radius: 0.375rem;
    --sidebar-background: 214 33% 5%;
    --sidebar-foreground: 210 15% 65%;
    --sidebar-primary: 153 100% 50%;
    --sidebar-primary-foreground: 214 31% 6%;
    --sidebar-accent: 214 22% 11%;
    --sidebar-accent-foreground: 210 20% 88%;
    --sidebar-border: 214 18% 11%;
    --sidebar-ring: 153 100% 50%;
  }

  .light {
    --background: 214 31% 6%;
    --foreground: 210 20% 88%;
    --card: 214 25% 9%;
    --card-foreground: 210 20% 88%;
    --popover: 214 25% 8%;
    --popover-foreground: 210 20% 88%;
    --primary: 153 100% 50%;
    --primary-foreground: 214 31% 6%;
    --secondary: 214 20% 14%;
    --secondary-foreground: 210 15% 70%;
    --muted: 214 20% 12%;
    --muted-foreground: 210 10% 48%;
    --accent: 217 91% 60%;
    --accent-foreground: 214 31% 6%;
    --destructive: 0 72% 55%;
    --destructive-foreground: 0 0% 98%;
    --border: 214 18% 14%;
    --input: 214 18% 14%;
    --ring: 153 100% 50%;
    --sidebar-background: 214 33% 5%;
    --sidebar-foreground: 210 15% 65%;
    --sidebar-primary: 153 100% 50%;
    --sidebar-primary-foreground: 214 31% 6%;
    --sidebar-accent: 214 22% 11%;
    --sidebar-accent-foreground: 210 20% 88%;
    --sidebar-border: 214 18% 11%;
    --sidebar-ring: 153 100% 50%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: 'rlig' 1, 'calt' 1;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: #0B0F14;
  }
  h1, h2, h3, h4, h5, h6 {
    text-wrap: balance;
    line-height: 1.15;
  }
}

/* Tabular nums for all data values */
.tabular {
  font-variant-numeric: tabular-nums lining-nums;
  font-feature-settings: 'tnum';
}

/* Specter Score ring */
.specter-score-ring {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

/* Trend badges */
.badge-bullish {
  background: rgba(0, 255, 136, 0.1);
  color: #00FF88;
  border: 1px solid rgba(0, 255, 136, 0.3);
  border-radius: 0.25rem;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-bearish {
  background: rgba(255, 68, 68, 0.1);
  color: #FF4444;
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: 0.25rem;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}
.badge-neutral {
  background: rgba(100, 116, 139, 0.15);
  color: #94a3b8;
  border: 1px solid rgba(100, 116, 139, 0.3);
  border-radius: 0.25rem;
  padding: 0.1rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
}

/* Neon green text glow */
.neon-green {
  color: #00FF88;
  text-shadow: 0 0 10px rgba(0, 255, 136, 0.5);
}

/* Shimmer skeleton */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, #0d1219 25%, #111820 50%, #0d1219 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
  border-radius: 0.375rem;
}

/* Specter score colors */
.score-high { color: #00FF88; text-shadow: 0 0 8px rgba(0,255,136,0.4); }
.score-mid  { color: #F59E0B; }
.score-low  { color: #FF4444; }

/* Bullish / bearish text colors */
.text-bullish { color: #00FF88; }
.text-bearish { color: #FF4444; }
.text-neutral { color: #94a3b8; }

/* Sidebar dark overrides */
[data-sidebar="sidebar"] {
  background: #080C10 !important;
  border-right: 1px solid #1a2332 !important;
}

/* KPI card top border accent */
.kpi-card {
  background: #11161C;
  border: 1px solid #1a2332;
  border-top: 2px solid #00FF88;
  border-radius: 0.375rem;
  padding: 0.875rem 1rem;
}

/* Data table rows */
.data-table-row {
  border-bottom: 1px solid #1a2332;
  transition: background 0.15s;
}
.data-table-row:hover {
  background: rgba(0, 255, 136, 0.04);
}

/* Market status pulse */
@keyframes pulse-green {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.market-open-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #00FF88;
  box-shadow: 0 0 6px rgba(0,255,136,0.8);
  animation: pulse-green 2s ease-in-out infinite;
}

/* Scrollbar */
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #1a2332; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #243044; }

/* Chart area */
.chart-container {
  background: #0d1219;
  border: 1px solid #1a2332;
  border-radius: 0.375rem;
}

/* Sector heatmap tiles */
.sector-tile-bullish {
  background: rgba(0, 255, 136, 0.15);
  border: 1px solid rgba(0, 255, 136, 0.25);
  color: #00FF88;
}
.sector-tile-bearish {
  background: rgba(255, 68, 68, 0.12);
  border: 1px solid rgba(255, 68, 68, 0.25);
  color: #FF4444;
}
.sector-tile-neutral {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: #3B82F6;
}
