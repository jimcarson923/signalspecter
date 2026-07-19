import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Send, ChevronDown, ChevronUp, Loader2, Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, PlusCircle, History, Brain, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';

// ── Global audio lock — prevents double-speak when two SpecterPanel instances mount ──
let _specterSpeaking = false;
let _specterGreeted = false;


// ── Types ──────────────────────────────────────────────────────────────────
interface StockPick { ticker: string; price: number; score: number; bullish: boolean; }
interface NewsHeadline { title: string; source: string; url: string; time: string; }
interface SectorSentiment { name: string; score: number; pressure: 'bullish' | 'bearish' | 'neutral'; }
interface MarketIntel { briefing: string; headlines: NewsHeadline[]; sectors: SectorSentiment[]; }
interface DeltaBriefing { summary: string; newEntries: string[]; dropped: string[]; unchanged: string[]; }
interface Trade { id: number; ticker: string; action: string; price: number; shares: number; sector: string | null; tradedAt: string; }
interface StyleProfile { profile: string; summary: string; traits: string[]; avgBuyPrice: number; favoriteSectors: string[]; favoriteTickers: string[]; totalTrades: number; pnl: number; }
interface Message {
  from: 'specter' | 'user';
  text: string;
  picks?: StockPick[];
  headlines?: NewsHeadline[];
  sectors?: SectorSentiment[];
  delta?: DeltaBriefing;
  timestamp: Date;
}

const SECTORS = ['Tech', 'Energy', 'Finance', 'Healthcare', 'EV/Auto', 'Other'];

export function SpecterPanel() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listening, setListening] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'news' | 'sectors' | 'trades' | 'style'>('chat');
  const [marketIntel, setMarketIntel] = useState<MarketIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [styleProfile, setStyleProfile] = useState<StyleProfile | null>(null);
  const [styleLoading, setStyleLoading] = useState(false);
  // Trade form
  const [tradeTicker, setTradeTicker] = useState('');
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell'>('buy');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeShares, setTradeShares] = useState('1');
  const [tradeSector, setTradeSector] = useState('');
  const [tradeSubmitting, setTradeSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);

  const speak = useCallback(async (text: string) => {
    if (_specterSpeaking) return;
    _specterSpeaking = true;
    if (muted) return;

    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    try {
      // Use ElevenLabs TTS — load voice preference from saved params
      const savedParams = (() => {
        try { return JSON.parse(localStorage.getItem('specterParams') || '{}'); } catch { return {}; }
      })();
      const voicePref = savedParams.voice || 'adam';

      const res = await fetch('/api/specter/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text, voice: voicePref }),
      });

      if (!res.ok) throw new Error('TTS failed');

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { URL.revokeObjectURL(url); _specterSpeaking = false; };
      audio.onerror = () => { _specterSpeaking = false; };
      await audio.play();
    } catch (_) {
      _specterSpeaking = false;
      // Fallback to browser TTS if OpenAI fails
      if (typeof window === 'undefined') return;
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      utt.rate = 0.88; utt.pitch = 0.78; utt.volume = 1;
      const voices = window.speechSynthesis.getVoices();
      const preferred = voices.find(v =>
        v.name.includes('Arthur') || v.name.includes('Daniel') || v.name.includes('Google UK English Male')
      );
      if (preferred) utt.voice = preferred;
      window.speechSynthesis.speak(utt);
    }
  }, [muted]);

  const fetchMarketIntel = useCallback(async () => {
    setIntelLoading(true);
    try {
      const res = await fetch('/api/specter/market-intel', { credentials: 'include' });
      const data: MarketIntel = await res.json();
      setMarketIntel(data);
      return data;
    } catch { return null; } finally { setIntelLoading(false); }
  }, []);

  const fetchTrades = useCallback(async () => {
    setTradesLoading(true);
    try {
      const res = await fetch('/api/specter/trades', { credentials: 'include' });
      const data: Trade[] = await res.json();
      setTrades(Array.isArray(data) ? data : []);
    } catch { setTrades([]); } finally { setTradesLoading(false); }
  }, []);

  const fetchStyle = useCallback(async () => {
    setStyleLoading(true);
    try {
      const res = await fetch('/api/specter/style', { credentials: 'include' });
      const data: StyleProfile = await res.json();
      setStyleProfile(data);
      return data;
    } catch { return null; } finally { setStyleLoading(false); }
  }, []);

  // Greeting + market intel on load
  useEffect(() => {
    if (!user || greeted || _specterGreeted) return;
    _specterGreeted = true;
    setGreeted(true);
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user.name?.split(' ')[0] ?? 'there';
    fetchMarketIntel().then(intel => {
      const msg = intel?.briefing
        ? `${greeting}, ${firstName}. ${intel.briefing}`
        : `${greeting}, ${firstName}. I'm Specter — your AI trading intelligence. Ask me what to look at today.`;
      setTimeout(() => { setMessages([{ from: 'specter', text: msg, timestamp: new Date() }]); speak(msg); }, 800);
    });
  }, [user, greeted, speak, fetchMarketIntel]);

  // Load trades and style when those tabs are opened
  useEffect(() => { if (activeTab === 'trades') fetchTrades(); }, [activeTab, fetchTrades]);
  useEffect(() => { if (activeTab === 'style') fetchStyle(); }, [activeTab, fetchStyle]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { from: 'user', text, timestamp: new Date() }]);
    setInput('');
    setLoading(true);
    setActiveTab('chat');
    try {
      const lower = text.toLowerCase();
      const isRecommend = lower.includes('look at') || lower.includes('today') || lower.includes('recommend') || lower.includes('find') || lower.includes('show me') || lower.includes('what should') || lower.includes('buy') || lower.includes('pick');
      const isNews = lower.includes('news') || lower.includes('headline') || lower.includes('happening') || lower.includes('market');
      const isDelta = lower.includes('changed') || lower.includes('yesterday') || lower.includes('different') || lower.includes('moved');
      const isPnl = lower.includes('p&l') || lower.includes('pnl') || lower.includes('profit') || lower.includes('loss') || lower.includes('made') || lower.includes('return');
      const isStyle = lower.includes('style') || lower.includes('profile') || lower.includes('trader') || lower.includes('how do i trade');

      if (isPnl) {
        const res = await fetch('/api/specter/pnl', { credentials: 'include' });
        const data = await res.json();
        if (data.error) {
          const msg = "Log some trades first and I'll calculate your P&L.";
          setMessages(prev => [...prev, { from: 'specter', text: msg, timestamp: new Date() }]);
          speak(msg);
        } else {
          const sign = data.pnl >= 0 ? '+' : '';
          const msg = `Your realized P&L is ${sign}$${data.pnl.toFixed(2)} across ${data.totalTrades} logged trades. ${data.buys} buys, ${data.sells} sells.`;
          setMessages(prev => [...prev, { from: 'specter', text: msg, timestamp: new Date() }]);
          speak(msg);
        }
      } else if (isStyle) {
        const style = await fetchStyle();
        if (style) {
          const msg = `Your investor profile: ${style.profile}. ${style.summary}`;
          setMessages(prev => [...prev, { from: 'specter', text: msg, timestamp: new Date() }]);
          speak(msg);
          setActiveTab('style');
        }
      } else if (isDelta) {
        const res = await fetch('/api/specter/briefing', { credentials: 'include' });
        const data: DeltaBriefing = await res.json();
        setMessages(prev => [...prev, { from: 'specter', text: data.summary, delta: data, timestamp: new Date() }]);
        speak(data.summary);
      } else if (isNews) {
        const intel = marketIntel ?? await fetchMarketIntel();
        if (intel) {
          setMessages(prev => [...prev, { from: 'specter', text: intel.briefing, headlines: intel.headlines, sectors: intel.sectors, timestamp: new Date() }]);
          speak(intel.briefing);
        }
      } else if (isRecommend) {
        const res = await fetch('/api/specter/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include' });
        const data = await res.json();
        setMessages(prev => [...prev, { from: 'specter', text: data.explanation, picks: data.picks, timestamp: new Date() }]);
        speak(data.explanation);
      } else {
        const res = await fetch('/api/specter/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ message: text }) });
        const data = await res.json();
        setMessages(prev => [...prev, { from: 'specter', text: data.reply, timestamp: new Date() }]);
        speak(data.reply);
      }
    } catch {
      setMessages(prev => [...prev, { from: 'specter', text: "I'm having trouble connecting right now. Try again in a moment.", timestamp: new Date() }]);
    } finally { setLoading(false); }
  };

  const submitTrade = async () => {
    if (!tradeTicker || !tradePrice) return;
    setTradeSubmitting(true);
    try {
      await fetch('/api/specter/trades', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ ticker: tradeTicker.toUpperCase(), action: tradeAction, price: parseFloat(tradePrice), shares: parseFloat(tradeShares) || 1, sector: tradeSector || null })
      });
      setTradeTicker(''); setTradePrice(''); setTradeShares('1'); setTradeSector('');
      fetchTrades();
      fetchStyle();
    } catch { } finally { setTradeSubmitting(false); }
  };

  const deleteTrade = async (id: number) => {
    await fetch(`/api/specter/trades/${id}`, { method: 'DELETE', credentials: 'include' });
    fetchTrades(); fetchStyle();
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input requires Chrome.'); return; }
    const rec = new SR();
    rec.lang = 'en-US'; rec.interimResults = false;
    rec.onresult = (e: any) => sendMessage(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start(); setListening(true);
  };

  const quickQuestions = [
    "What should I look at today?",
    "What's happening in the market?",
    "What changed since yesterday?",
    "What's my P&L?",
    "What type of trader am I?",
  ];

  const pressureIcon = (p: string) => p === 'bullish' ? <TrendingUp className="h-3 w-3 text-[#00FF88]" /> : p === 'bearish' ? <TrendingDown className="h-3 w-3 text-red-400" /> : <Minus className="h-3 w-3 text-zinc-400" />;
  const pressureColor = (p: string) => p === 'bullish' ? 'text-[#00FF88]' : p === 'bearish' ? 'text-red-400' : 'text-zinc-400';

  const tabs = [
    { id: 'chat', label: 'Chat' },
    { id: 'news', label: 'News' },
    { id: 'sectors', label: 'Sectors' },
    { id: 'trades', label: 'Trades' },
    { id: 'style', label: 'Style' },
  ] as const;

  return (
    <div className={`flex flex-col bg-[#0D1117] border-l border-[#00FF88]/20 transition-all duration-300 ${collapsed ? 'w-12' : 'w-72'} flex-shrink-0 h-full`}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#00FF88]/20 bg-[#0B0F14] flex-shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="relative">
              <div className="w-7 h-7 rounded-full bg-[#00FF88]/10 border border-[#00FF88]/40 flex items-center justify-center">
                <span className="text-[10px] font-bold text-[#00FF88]">S</span>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00FF88] animate-pulse" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#00FF88] tracking-wider">SPECTER</p>
              <p className="text-[9px] text-zinc-500">AI Trading Intelligence</p>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1 ml-auto">
          {!collapsed && (
            <>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-[#00FF88]" onClick={fetchMarketIntel} title="Refresh">
                <RefreshCw className={`h-3 w-3 ${intelLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-[#00FF88]" onClick={() => setMuted(!muted)}>
                {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-[#00FF88]" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronDown className="h-3 w-3 -rotate-90" /> : <ChevronUp className="h-3 w-3 rotate-90" />}
          </Button>
        </div>
      </div>

      {/* Collapsed state */}
      {collapsed && (
        <div className="flex-1 flex flex-col items-center pt-4 gap-3">
          <div className="w-6 h-6 rounded-full bg-[#00FF88]/10 border border-[#00FF88]/40 flex items-center justify-center">
            <span className="text-[9px] font-bold text-[#00FF88]">S</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-[#00FF88] animate-pulse" />
        </div>
      )}

      {/* Expanded */}
      {!collapsed && (
        <>
          {/* Tab bar — scrollable */}
          <div className="flex border-b border-zinc-800 flex-shrink-0 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex-shrink-0 text-[9px] px-2 py-1.5 font-medium tracking-wider uppercase transition-colors ${activeTab === tab.id ? 'text-[#00FF88] border-b border-[#00FF88]' : 'text-zinc-600 hover:text-zinc-400'}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* CHAT TAB */}
          {activeTab === 'chat' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="text-center mt-6">
                  <div className="w-10 h-10 rounded-full bg-[#00FF88]/10 border border-[#00FF88]/30 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-[#00FF88]">S</span>
                  </div>
                  <p className="text-xs text-zinc-500">Specter is initializing...</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex flex-col gap-1 ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[95%] rounded-lg px-3 py-2 text-xs leading-relaxed ${msg.from === 'user' ? 'bg-[#3B82F6]/20 text-blue-200 border border-[#3B82F6]/30' : 'bg-[#00FF88]/8 text-zinc-200 border border-[#00FF88]/20'}`}>
                    {msg.from === 'specter' && <p className="text-[9px] text-[#00FF88] font-bold mb-1 tracking-wider">SPECTER</p>}
                    <p>{msg.text}</p>
                  </div>
                  {msg.picks && msg.picks.length > 0 && (
                    <div className="w-full space-y-1 mt-1">
                      {msg.picks.slice(0, 8).map((pick, j) => (
                        <div key={j} className="flex items-center justify-between bg-[#11161C] border border-zinc-800 rounded px-2 py-1.5 hover:border-[#00FF88]/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{pick.ticker}</span>
                            <Badge className={`text-[9px] px-1 py-0 h-4 border ${pick.bullish ? 'bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>{pick.bullish ? '▲' : '▼'}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-zinc-300">${pick.price.toFixed(2)}</span>
                            <div className="flex items-center gap-1">
                              <div className="w-8 h-1 rounded-full bg-zinc-800 overflow-hidden">
                                <div className="h-full bg-[#00FF88] rounded-full" style={{ width: `${pick.score}%` }} />
                              </div>
                              <span className="text-[9px] text-[#00FF88] font-mono">{pick.score}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {msg.delta && (
                    <div className="w-full bg-[#11161C] border border-zinc-800 rounded p-2 space-y-2 mt-1">
                      {msg.delta.newEntries.length > 0 && (
                        <div>
                          <p className="text-[9px] text-[#00FF88] font-bold mb-1">NEW TODAY</p>
                          <div className="flex flex-wrap gap-1">{msg.delta.newEntries.map(t => <span key={t} className="text-[10px] bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20 px-1.5 py-0.5 rounded">{t}</span>)}</div>
                        </div>
                      )}
                      {msg.delta.dropped.length > 0 && (
                        <div>
                          <p className="text-[9px] text-red-400 font-bold mb-1">DROPPED OFF</p>
                          <div className="flex flex-wrap gap-1">{msg.delta.dropped.map(t => <span key={t} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">{t}</span>)}</div>
                        </div>
                      )}
                    </div>
                  )}
                  {msg.headlines && msg.headlines.length > 0 && (
                    <div className="w-full space-y-1 mt-1">
                      {msg.headlines.slice(0, 4).map((h, j) => (
                        <a key={j} href={h.url} target="_blank" rel="noopener noreferrer" className="block bg-[#11161C] border border-zinc-800 rounded px-2 py-1.5 hover:border-[#00FF88]/30 transition-colors">
                          <p className="text-[10px] text-zinc-200 leading-tight line-clamp-2">{h.title}</p>
                          <p className="text-[9px] text-zinc-600 mt-0.5">{h.source}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && <div className="flex items-center gap-2 text-zinc-500"><Loader2 className="h-3 w-3 animate-spin text-[#00FF88]" /><span className="text-xs">Specter is analyzing...</span></div>}
              {messages.length <= 1 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Quick ask</p>
                  {quickQuestions.map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)} className="w-full text-left text-[10px] text-zinc-400 hover:text-[#00FF88] bg-[#11161C] hover:bg-[#00FF88]/8 border border-zinc-800 hover:border-[#00FF88]/30 rounded px-2 py-1.5 transition-all">{q}</button>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* NEWS TAB */}
          {activeTab === 'news' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {intelLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#00FF88]" /></div>}
              {!intelLoading && marketIntel?.headlines.length === 0 && (
                <div className="text-center py-8"><Newspaper className="h-8 w-8 text-zinc-700 mx-auto mb-2" /><p className="text-xs text-zinc-500">No headlines yet today.</p></div>
              )}
              {!intelLoading && marketIntel?.headlines.map((h, i) => (
                <a key={i} href={h.url} target="_blank" rel="noopener noreferrer" className="block bg-[#11161C] border border-zinc-800 rounded px-3 py-2 hover:border-[#00FF88]/30 transition-colors">
                  <p className="text-[11px] text-zinc-200 leading-snug">{h.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-zinc-500">{h.source}</span>
                    {h.time && <span className="text-[9px] text-zinc-600">{new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
                  </div>
                </a>
              ))}
              {!intelLoading && !marketIntel && <button onClick={fetchMarketIntel} className="w-full text-xs text-zinc-400 hover:text-[#00FF88] py-4 text-center">Tap to load headlines</button>}
            </div>
          )}

          {/* SECTORS TAB */}
          {activeTab === 'sectors' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-2">Sector Pressure</p>
              {intelLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#00FF88]" /></div>}
              {!intelLoading && marketIntel?.sectors.map((s, i) => (
                <div key={i} className="bg-[#11161C] border border-zinc-800 rounded px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">{pressureIcon(s.pressure)}<span className="text-xs text-white font-medium">{s.name}</span></div>
                    <span className={`text-[10px] font-bold ${pressureColor(s.pressure)} capitalize`}>{s.pressure}</span>
                  </div>
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${s.pressure === 'bullish' ? 'bg-[#00FF88]' : s.pressure === 'bearish' ? 'bg-red-500' : 'bg-zinc-500'}`} style={{ width: `${s.score}%` }} />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px] text-zinc-600">Bearish</span>
                    <span className="text-[9px] text-zinc-500 font-mono">{s.score}/100</span>
                    <span className="text-[9px] text-zinc-600">Bullish</span>
                  </div>
                </div>
              ))}
              {!intelLoading && !marketIntel && <button onClick={fetchMarketIntel} className="w-full text-xs text-zinc-400 hover:text-[#00FF88] py-4 text-center">Tap to load sector data</button>}
            </div>
          )}

          {/* TRADES TAB */}
          {activeTab === 'trades' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {/* Log trade form */}
              <div className="bg-[#11161C] border border-zinc-800 rounded p-2 space-y-2">
                <p className="text-[9px] text-[#00FF88] font-bold tracking-wider uppercase flex items-center gap-1"><PlusCircle className="h-3 w-3" /> Log a Trade</p>
                <div className="flex gap-1">
                  <Input value={tradeTicker} onChange={e => setTradeTicker(e.target.value.toUpperCase())} placeholder="Ticker" className="h-7 text-xs bg-[#0B0F14] border-zinc-700 text-white uppercase flex-1" maxLength={5} />
                  <select value={tradeAction} onChange={e => setTradeAction(e.target.value as 'buy' | 'sell')}
                    className="h-7 text-xs bg-[#0B0F14] border border-zinc-700 text-white rounded px-1">
                    <option value="buy">Buy</option>
                    <option value="sell">Sell</option>
                  </select>
                </div>
                <div className="flex gap-1">
                  <Input value={tradePrice} onChange={e => setTradePrice(e.target.value)} placeholder="Price $" type="number" step="0.01" className="h-7 text-xs bg-[#0B0F14] border-zinc-700 text-white flex-1" />
                  <Input value={tradeShares} onChange={e => setTradeShares(e.target.value)} placeholder="Shares" type="number" className="h-7 text-xs bg-[#0B0F14] border-zinc-700 text-white w-16" />
                </div>
                <select value={tradeSector} onChange={e => setTradeSector(e.target.value)}
                  className="w-full h-7 text-xs bg-[#0B0F14] border border-zinc-700 text-zinc-400 rounded px-1">
                  <option value="">Sector (optional)</option>
                  {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <Button onClick={submitTrade} disabled={!tradeTicker || !tradePrice || tradeSubmitting}
                  className="w-full h-7 text-xs bg-[#00FF88] hover:bg-[#00FF88]/90 text-black font-bold">
                  {tradeSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : `Log ${tradeAction === 'buy' ? 'Buy' : 'Sell'}`}
                </Button>
              </div>

              {/* Trade history */}
              <div>
                <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-2 flex items-center gap-1"><History className="h-3 w-3" /> Trade History</p>
                {tradesLoading && <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-[#00FF88]" /></div>}
                {!tradesLoading && trades.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">No trades logged yet.</p>}
                {!tradesLoading && trades.slice().reverse().map(t => (
                  <div key={t.id} className="flex items-center justify-between bg-[#11161C] border border-zinc-800 rounded px-2 py-1.5 mb-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[9px] px-1.5 h-4 border ${t.action === 'buy' ? 'bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>{t.action.toUpperCase()}</Badge>
                      <span className="text-xs font-bold text-white">{t.ticker}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">${t.price.toFixed(2)} × {t.shares}</span>
                      <button onClick={() => deleteTrade(t.id)} className="text-zinc-700 hover:text-red-400 transition-colors"><Trash2 className="h-3 w-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STYLE TAB */}
          {activeTab === 'style' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
              {styleLoading && <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[#00FF88]" /></div>}
              {!styleLoading && styleProfile && (
                <>
                  {/* Profile card */}
                  <div className="bg-[#11161C] border border-[#00FF88]/20 rounded p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Brain className="h-4 w-4 text-[#00FF88]" />
                      <p className="text-xs font-bold text-[#00FF88]">{styleProfile.profile}</p>
                    </div>
                    <p className="text-[11px] text-zinc-300 leading-relaxed">{styleProfile.summary}</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#11161C] border border-zinc-800 rounded p-2 text-center">
                      <p className="text-[9px] text-zinc-500 uppercase">Total Trades</p>
                      <p className="text-lg font-bold text-white">{styleProfile.totalTrades}</p>
                    </div>
                    <div className="bg-[#11161C] border border-zinc-800 rounded p-2 text-center">
                      <p className="text-[9px] text-zinc-500 uppercase">Realized P&L</p>
                      <p className={`text-lg font-bold ${styleProfile.pnl > 0 ? 'text-[#00FF88]' : styleProfile.pnl < 0 ? 'text-red-400' : 'text-zinc-500'}`}>
                        {styleProfile.pnl === 0 ? '—' : `${styleProfile.pnl > 0 ? '+' : ''}$${styleProfile.pnl.toFixed(2)}`}
                      </p>
                    </div>
                    <div className="bg-[#11161C] border border-zinc-800 rounded p-2 text-center">
                      <p className="text-[9px] text-zinc-500 uppercase">Avg Buy Price</p>
                      <p className="text-lg font-bold text-white">${styleProfile.avgBuyPrice.toFixed(2)}</p>
                    </div>
                    <div className="bg-[#11161C] border border-zinc-800 rounded p-2 text-center">
                      <p className="text-[9px] text-zinc-500 uppercase">Top Sector</p>
                      <p className="text-sm font-bold text-white">{styleProfile.favoriteSectors[0] ?? '—'}</p>
                    </div>
                  </div>

                  {/* Traits */}
                  {styleProfile.traits.length > 0 && (
                    <div>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Specter Insights</p>
                      <div className="space-y-1">
                        {styleProfile.traits.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] text-zinc-400">
                            <div className="w-1 h-1 rounded-full bg-[#00FF88] flex-shrink-0" />
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Favorite tickers */}
                  {styleProfile.favoriteTickers.length > 0 && (
                    <div>
                      <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Most Traded</p>
                      <div className="flex flex-wrap gap-1">
                        {styleProfile.favoriteTickers.map(t => (
                          <span key={t} className="text-[10px] bg-[#11161C] text-zinc-300 border border-zinc-700 px-1.5 py-0.5 rounded font-mono">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {styleProfile.totalTrades === 0 && (
                    <p className="text-xs text-zinc-500 text-center py-2">Log trades in the Trades tab and Specter will build your investor profile.</p>
                  )}
                </>
              )}
              {!styleLoading && !styleProfile && (
                <button onClick={fetchStyle} className="w-full text-xs text-zinc-400 hover:text-[#00FF88] py-4 text-center">Tap to load your profile</button>
              )}
            </div>
          )}

          {/* Input bar */}
          <div className="flex items-center gap-1.5 p-2 border-t border-[#00FF88]/20 flex-shrink-0">
            <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !loading && sendMessage(input)}
              placeholder="Ask Specter..." className="h-7 text-xs bg-[#11161C] border-zinc-700 focus:border-[#00FF88]/50 text-zinc-200 placeholder:text-zinc-600" disabled={loading} />
            <Button variant="ghost" size="icon" className={`h-7 w-7 flex-shrink-0 ${listening ? 'text-[#00FF88] animate-pulse' : 'text-zinc-500 hover:text-[#00FF88]'}`} onClick={startListening} disabled={loading}>
              {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-zinc-500 hover:text-[#00FF88]" onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
