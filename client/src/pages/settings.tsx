import { Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Settings className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold">Settings</h1>
          <p className="text-xs text-muted-foreground">Account and app preferences — coming soon</p>
        </div>
      </div>
      <div className="rounded-xl border border-border/50 bg-card/30 p-8 text-center">
        <Settings className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">Settings are being built. Check back soon.</p>
      </div>
    </div>
  );
}
