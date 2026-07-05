import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Plus, Trash2, CheckCircle2, TrendingUp, TrendingDown, Target, Loader2, BellRing, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface Alert {
  id: number;
  ticker: string;
  type: 'price_above' | 'price_below' | 'score_above';
  targetValue: number;
  message: string | null;
  triggered: boolean;
  triggeredAt: string | null;
  createdAt: string;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export default function AlertsPage() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [ticker, setTicker] = useState('');
  const [alertType, setAlertType] = useState<'price_above' | 'price_below' | 'score_above'>('price_above');
  const [targetValue, setTargetValue] = useState('');
  const [customMessage, setCustomMessage] = useState('');

  const loadAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts', { credentials: 'include' });
      const data = await res.json();
      setAlerts(Array.isArray(data) ? data : []);
    } catch { setAlerts([]); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);

  // Check if push is already enabled
  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => {
          setPushEnabled(!!sub);
        });
      });
    }
  }, []);

  const enablePush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      toast({ title: 'Push not supported', description: 'Try Chrome on Android or Safari on iOS 16.4+', variant: 'destructive' });
      return;
    }
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast({ title: 'Permission denied', description: 'Allow notifications in your browser settings to receive alerts.', variant: 'destructive' });
        setPushLoading(false);
        return;
      }
      // Get VAPID key
      const keyRes = await fetch('/api/push/vapid-public-key');
      const { key } = await keyRes.json();
      // Subscribe
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const subJson = sub.toJSON();
      // Save to server
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      });
      setPushEnabled(true);
      toast({ title: 'Push notifications enabled', description: "Specter will alert you the moment a price target is hit." });
    } catch (e) {
      toast({ title: 'Failed to enable push', description: 'Check browser permissions and try again.', variant: 'destructive' });
    } finally { setPushLoading(false); }
  };

  const disablePush = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushEnabled(false);
      toast({ title: 'Push notifications disabled' });
    } catch { toast({ title: 'Failed to disable', variant: 'destructive' }); }
  };

  const createAlert = async () => {
    if (!ticker || !targetValue) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ticker: ticker.toUpperCase(), type: alertType, targetValue: parseFloat(targetValue), message: customMessage || null }),
      });
      if (res.ok) {
        setTicker(''); setTargetValue(''); setCustomMessage('');
        loadAlerts();
        toast({ title: 'Alert created', description: `Specter will notify you when ${ticker.toUpperCase()} triggers.` });
      }
    } catch { toast({ title: 'Failed to create alert', variant: 'destructive' }); }
    finally { setSubmitting(false); }
  };

  const deleteAlert = async (id: number) => {
    await fetch(`/api/alerts/${id}`, { method: 'DELETE', credentials: 'include' });
    loadAlerts();
  };

  const alertTypeLabel = (type: string) => {
    if (type === 'price_above') return 'Price rises above';
    if (type === 'price_below') return 'Price drops below';
    return 'Specter Score above';
  };

  const alertTypeIcon = (type: string) => {
    if (type === 'price_above') return <TrendingUp className="h-3 w-3 text-[#00FF88]" />;
    if (type === 'price_below') return <TrendingDown className="h-3 w-3 text-red-400" />;
    return <Target className="h-3 w-3 text-[#3B82F6]" />;
  };

  const activeAlerts = alerts.filter(a => !a.triggered);
  const triggeredAlerts = alerts.filter(a => a.triggered);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BellRing className="h-6 w-6 text-[#00FF88]" />
          Price Alerts
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Specter watches your targets 24/7 and pushes a notification the moment they're hit.
        </p>
      </div>

      {/* Push notifications toggle */}
      <Card className="bg-[#11161C] border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-[#00FF88]" />
            Phone Notifications
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500">
            Get alerted on your phone even when the app is closed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pushEnabled ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" />
                <span className="text-sm text-[#00FF88] font-medium">Push notifications active</span>
              </div>
              <Button variant="outline" size="sm" onClick={disablePush} className="h-8 text-xs border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/50">
                <BellOff className="h-3 w-3 mr-1" /> Disable
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Notifications are off</span>
              <Button size="sm" onClick={enablePush} disabled={pushLoading}
                className="h-8 text-xs bg-[#00FF88] hover:bg-[#00FF88]/90 text-black font-bold">
                {pushLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Bell className="h-3 w-3 mr-1" />}
                Enable Alerts
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create alert */}
      <Card className="bg-[#11161C] border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white flex items-center gap-2">
            <Plus className="h-4 w-4 text-[#00FF88]" /> Create Alert
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-zinc-400">Ticker</Label>
              <Input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} placeholder="e.g. NVDA"
                maxLength={5} className="bg-[#0B0F14] border-zinc-700 text-white h-9 text-sm uppercase" />
            </div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-zinc-400">Alert When</Label>
              <Select value={alertType} onValueChange={(v: any) => setAlertType(v)}>
                <SelectTrigger className="bg-[#0B0F14] border-zinc-700 text-white h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#11161C] border-zinc-700">
                  <SelectItem value="price_above" className="text-zinc-200 text-xs focus:bg-[#00FF88]/10">Price rises above</SelectItem>
                  <SelectItem value="price_below" className="text-zinc-200 text-xs focus:bg-[#00FF88]/10">Price drops below</SelectItem>
                  <SelectItem value="score_above" className="text-zinc-200 text-xs focus:bg-[#00FF88]/10">Specter Score above</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-zinc-400">
              {alertType === 'score_above' ? 'Score Target (0–100)' : 'Price Target ($)'}
            </Label>
            <Input value={targetValue} onChange={e => setTargetValue(e.target.value)} type="number"
              placeholder={alertType === 'score_above' ? 'e.g. 85' : 'e.g. 140.00'} step={alertType === 'score_above' ? '1' : '0.01'}
              className="bg-[#0B0F14] border-zinc-700 text-white h-9 text-sm" />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-zinc-400">Custom message (optional)</Label>
            <Input value={customMessage} onChange={e => setCustomMessage(e.target.value)}
              placeholder="e.g. Buy signal — execute limit order" className="bg-[#0B0F14] border-zinc-700 text-white h-9 text-sm" />
          </div>

          {/* Preview */}
          {ticker && targetValue && (
            <div className="bg-[#0B0F14] border border-[#00FF88]/20 rounded p-2 text-xs text-zinc-400">
              <span className="text-[#00FF88] font-medium">Preview: </span>
              Alert me when <span className="text-white font-bold">{ticker}</span> {alertTypeLabel(alertType).toLowerCase()}{' '}
              <span className="text-white font-bold">{alertType === 'score_above' ? targetValue : `$${targetValue}`}</span>
            </div>
          )}

          <Button onClick={createAlert} disabled={!ticker || !targetValue || submitting}
            className="w-full h-9 bg-[#00FF88] hover:bg-[#00FF88]/90 text-black font-bold text-sm">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
            Set Alert
          </Button>
        </CardContent>
      </Card>

      {/* Active alerts */}
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center gap-2">
          <Bell className="h-4 w-4 text-[#00FF88]" />
          Active Alerts
          {activeAlerts.length > 0 && <Badge className="bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30 border text-[10px]">{activeAlerts.length}</Badge>}
        </h2>
        {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[#00FF88]" /></div>}
        {!loading && activeAlerts.length === 0 && (
          <div className="text-center py-8 bg-[#11161C] border border-zinc-800 rounded-lg">
            <Bell className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
            <p className="text-sm text-zinc-500">No active alerts.</p>
            <p className="text-xs text-zinc-600 mt-1">Create an alert above to get notified instantly.</p>
          </div>
        )}
        <div className="space-y-2">
          {activeAlerts.map(alert => (
            <div key={alert.id} className="flex items-center justify-between bg-[#11161C] border border-zinc-800 rounded-lg px-4 py-3 hover:border-[#00FF88]/20 transition-colors">
              <div className="flex items-center gap-3">
                {alertTypeIcon(alert.type)}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{alert.ticker}</span>
                    <span className="text-xs text-zinc-400">{alertTypeLabel(alert.type)}</span>
                    <span className="text-sm font-bold text-[#00FF88]">
                      {alert.type === 'score_above' ? alert.targetValue : `$${alert.targetValue}`}
                    </span>
                  </div>
                  {alert.message && <p className="text-xs text-zinc-500 mt-0.5">{alert.message}</p>}
                </div>
              </div>
              <button onClick={() => deleteAlert(alert.id)} className="text-zinc-700 hover:text-red-400 transition-colors ml-2">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Triggered alerts */}
      {triggeredAlerts.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-zinc-500 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-zinc-500" />
            Triggered
          </h2>
          <div className="space-y-2">
            {triggeredAlerts.slice(0, 10).map(alert => (
              <div key={alert.id} className="flex items-center justify-between bg-[#0D1117] border border-zinc-800/50 rounded-lg px-4 py-3 opacity-60">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-3 w-3 text-zinc-600" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-zinc-400">{alert.ticker}</span>
                      <span className="text-xs text-zinc-600">{alertTypeLabel(alert.type)}</span>
                      <span className="text-sm font-medium text-zinc-500">
                        {alert.type === 'score_above' ? alert.targetValue : `$${alert.targetValue}`}
                      </span>
                    </div>
                    {alert.triggeredAt && (
                      <p className="text-[10px] text-zinc-700 mt-0.5">
                        Triggered {new Date(alert.triggeredAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={() => deleteAlert(alert.id)} className="text-zinc-800 hover:text-zinc-600 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
