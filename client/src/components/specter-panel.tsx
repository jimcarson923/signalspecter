import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Send, ChevronDown, ChevronUp, Loader2, Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

interface StockPick {
  ticker: string;
  price: number;
  score: number;
  bullish: boolean;
}

interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  time: string;
}

interface SectorSentiment {
  name: string;
  score: number;
  pressure: 'bullish' | 'bearish' | 'neutral';
}

interface MarketIntel {
  briefing: string;
  headlines: NewsHeadline[];
  sectors: SectorSentiment[];
}

interface DeltaBriefing {
  summary: string;
  newEntries: string[];
  dropped: string[];
  unchanged: string[];
}

interface Message {
  from: 'specter' | 'user';
  text: string;
  picks?: StockPick[];
  headlines?: NewsHeadline[];
  sectors?: SectorSentiment[];
  delta?: DeltaBriefing;
  timestamp: Date;
}

export function SpecterPanel() {
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listening, setListening] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [activeTab, setActiveTab] = useState<'chat' | 'news' | 'sectors'>('chat');
  const [marketIntel, setMarketIntel] = useState<MarketIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const speak = useCallback((text: string) => {
    if (muted || typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 0.85;
    utt.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Google UK English Male') ||
      v.name.includes('Daniel') ||
      v.name.includes('Alex') ||
      v.name.includes('en-GB')
    );
    if (preferred) utt.voice = preferred;
    window.speechSynthesis.speak(utt);
  }, [muted]);

  const fetchMarketIntel = useCallback(async () => {
    setIntelLoading(true);
    try {
      const res = await fetch('/api/specter/market-intel', { credentials: 'include' });
      const data: MarketIntel = await res.json();
      setMarketIntel(data);
      return data;
    } catch {
      return null;
    } finally {
      setIntelLoading(false);
    }
  }, []);

  // Voice greeting + auto market intel on first load
  useEffect(() => {
    if (!user || greeted) return;
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user.name?.split(' ')[0] ?? 'there';

    setGreeted(true);

    fetchMarketIntel().then(intel => {
      const greetMsg = intel?.briefing
        ? `${greeting}, ${firstName}. ${intel.briefing}`
        : `${greeting}, ${firstName}. I'm Specter, your AI trading intelligence. Ask me what stocks to look at today.`;

      setTimeout(() => {
        setMessages([{ from: 'specter', text: greetMsg, timestamp: new Date() }]);
        speak(greetMsg);
      }, 800);
    });
  }, [user, greeted, speak, fetchMarketIntel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

      const isRecommend = lower.includes('look at') || lower.includes('today') ||
        lower.includes('recommend') || lower.includes('find') ||
        lower.includes('show me') || lower.includes('what should') ||
        lower.includes('opportunities') || lower.includes('buy') ||
        lower.includes('pick');

      const isNews = lower.includes('news') || lower.includes('headline') ||
        lower.includes('happening') || lower.includes('market');

      const isDelta = lower.includes('changed') || lower.includes('yesterday') ||
        lower.includes('different') || lower.includes('new since') || lower.includes('what moved');

      if (isDelta) {
        const res = await fetch('/api/specter/briefing', { credentials: 'include' });
        const data: DeltaBriefing = await res.json();
        const msg: Message = { from: 'specter', text: data.summary, delta: data, timestamp: new Date() };
        setMessages(prev => [...prev, msg]);
        speak(data.summary);

      } else if (isNews) {
        const intel = marketIntel ?? await fetchMarketIntel();
        if (intel) {
          const msg: Message = {
            from: 'specter',
            text: intel.briefing,
            headlines: intel.headlines,
            sectors: intel.sectors,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, msg]);
          speak(intel.briefing);
        }

      } else if (isRecommend) {
        const res = await fetch('/api/specter/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        const data = await res.json();
        setMessages(prev => [...prev, { from: 'specter', text: data.explanation, picks: data.picks, timestamp: new Date() }]);
        speak(data.explanation);

      } else {
        const res = await fetch('/api/specter/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        setMessages(prev => [...prev, { from: 'specter', text: data.reply, timestamp: new Date() }]);
        speak(data.reply);
      }
    } catch {
      const err = "I'm having trouble connecting right now. Try again in a moment.";
      setMessages(prev => [...prev, { from: 'specter', text: err, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Voice input requires Chrome.'); return; }
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e: any) => sendMessage(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const quickQuestions = [
    "What should I look at today?",
    "What's happening in the market?",
    "What changed since yesterday?",
    "Find me high score picks",
  ];

  const pressureIcon = (p: string) =>
    p === 'bullish' ? <TrendingUp className="h-3 w-3 text-[#00FF88]" /> :
    p === 'bearish' ? <TrendingDown className="h-3 w-3 text-red-400" /> :
    <Minus className="h-3 w-3 text-zinc-400" />;

  const pressureColor = (p: string) =>
    p === 'bullish' ? 'text-[#00FF88]' : p === 'bearish' ? 'text-red-400' : 'text-zinc-400';

  return (
    <div className={`flex flex-col bg-[#0D1117] border-l border-[#00FF88]/20 transition-all duration-300 ${collapsed ? 'w-12' : 'w-72'} flex-shrink-0 h-full relative`}>

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
              <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-[#00FF88]"
                onClick={() => { fetchMarketIntel(); }} title="Refresh market intel">
                <RefreshCw className={`h-3 w-3 ${intelLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-[#00FF88]"
                onClick={() => setMuted(!muted)} title={muted ? 'Unmute' : 'Mute'}>
                {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-[#00FF88]"
            onClick={() => setCollapsed(!collapsed)}>
            {collapsed
              ? <ChevronDown className="h-3 w-3 -rotate-90" />
              : <ChevronUp className="h-3 w-3 rotate-90" />}
          </Button>
        </div>
      </div>

      {/* Collapsed */}
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
          {/* Tab bar */}
          <div className="flex border-b border-zinc-800 flex-shrink-0">
            {(['chat', 'news', 'sectors'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`flex-1 text-[10px] py-1.5 font-medium tracking-wider uppercase transition-colors ${
                  activeTab === tab
                    ? 'text-[#00FF88] border-b border-[#00FF88]'
                    : 'text-zinc-600 hover:text-zinc-400'
                }`}>
                {tab === 'chat' ? 'Chat' : tab === 'news' ? 'News' : 'Sectors'}
              </button>
            ))}
          </div>

          {/* Chat tab */}
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
                  <div className={`max-w-[95%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                    msg.from === 'user'
                      ? 'bg-[#3B82F6]/20 text-blue-200 border border-[#3B82F6]/30'
                      : 'bg-[#00FF88]/8 text-zinc-200 border border-[#00FF88]/20'
                  }`}>
                    {msg.from === 'specter' && <p className="text-[9px] text-[#00FF88] font-bold mb-1 tracking-wider">SPECTER</p>}
                    <p>{msg.text}</p>
                  </div>

                  {/* Stock picks */}
                  {msg.picks && msg.picks.length > 0 && (
                    <div className="w-full space-y-1 mt-1">
                      {msg.picks.slice(0, 8).map((pick, j) => (
                        <div key={j} className="flex items-center justify-between bg-[#11161C] border border-zinc-800 rounded px-2 py-1.5 hover:border-[#00FF88]/30 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{pick.ticker}</span>
                            <Badge className={`text-[9px] px-1 py-0 h-4 border ${pick.bullish ? 'bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30' : 'bg-red-500/15 text-red-400 border-red-500/30'}`}>
                              {pick.bullish ? '▲' : '▼'}
                            </Badge>
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

                  {/* Delta briefing */}
                  {msg.delta && (
                    <div className="w-full bg-[#11161C] border border-zinc-800 rounded p-2 space-y-2 mt-1">
                      {msg.delta.newEntries.length > 0 && (
                        <div>
                          <p className="text-[9px] text-[#00FF88] font-bold mb-1">NEW TODAY</p>
                          <div className="flex flex-wrap gap-1">
                            {msg.delta.newEntries.map(t => (
                              <span key={t} className="text-[10px] bg-[#00FF88]/10 text-[#00FF88] border border-[#00FF88]/20 px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {msg.delta.dropped.length > 0 && (
                        <div>
                          <p className="text-[9px] text-red-400 font-bold mb-1">DROPPED OFF</p>
                          <div className="flex flex-wrap gap-1">
                            {msg.delta.dropped.map(t => (
                              <span key={t} className="text-[10px] bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded">{t}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* News in chat */}
                  {msg.headlines && msg.headlines.length > 0 && (
                    <div className="w-full space-y-1 mt-1">
                      {msg.headlines.slice(0, 4).map((h, j) => (
                        <a key={j} href={h.url} target="_blank" rel="noopener noreferrer"
                          className="block bg-[#11161C] border border-zinc-800 rounded px-2 py-1.5 hover:border-[#00FF88]/30 transition-colors">
                          <p className="text-[10px] text-zinc-200 leading-tight line-clamp-2">{h.title}</p>
                          <p className="text-[9px] text-zinc-600 mt-0.5">{h.source}</p>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Loader2 className="h-3 w-3 animate-spin text-[#00FF88]" />
                  <span className="text-xs">Specter is analyzing...</span>
                </div>
              )}

              {/* Quick questions (only when few messages) */}
              {messages.length <= 1 && (
                <div className="space-y-1 pt-1">
                  <p className="text-[9px] text-zinc-600 uppercase tracking-wider">Quick ask</p>
                  {quickQuestions.map((q, i) => (
                    <button key={i} onClick={() => sendMessage(q)}
                      className="w-full text-left text-[10px] text-zinc-400 hover:text-[#00FF88] bg-[#11161C] hover:bg-[#00FF88]/8 border border-zinc-800 hover:border-[#00FF88]/30 rounded px-2 py-1.5 transition-all">
                      {q}
                    </button>
                  ))}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* News tab */}
          {activeTab === 'news' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              {intelLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#00FF88]" />
                </div>
              )}
              {!intelLoading && marketIntel && marketIntel.headlines.length === 0 && (
                <div className="text-center py-8">
                  <Newspaper className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                  <p className="text-xs text-zinc-500">No headlines yet today.</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Check back after market open.</p>
                </div>
              )}
              {!intelLoading && marketIntel?.headlines.map((h, i) => (
                <a key={i} href={h.url} target="_blank" rel="noopener noreferrer"
                  className="block bg-[#11161C] border border-zinc-800 rounded px-3 py-2 hover:border-[#00FF88]/30 transition-colors">
                  <p className="text-[11px] text-zinc-200 leading-snug">{h.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] text-zinc-500">{h.source}</span>
                    {h.time && (
                      <span className="text-[9px] text-zinc-600">
                        {new Date(h.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </a>
              ))}
              {!intelLoading && !marketIntel && (
                <button onClick={fetchMarketIntel} className="w-full text-xs text-zinc-400 hover:text-[#00FF88] py-4 text-center">
                  Tap to load headlines
                </button>
              )}
            </div>
          )}

          {/* Sectors tab */}
          {activeTab === 'sectors' && (
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-2">Sector Pressure</p>
              {intelLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-[#00FF88]" />
                </div>
              )}
              {!intelLoading && marketIntel?.sectors.map((s, i) => (
                <div key={i} className="bg-[#11161C] border border-zinc-800 rounded px-3 py-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      {pressureIcon(s.pressure)}
                      <span className="text-xs text-white font-medium">{s.name}</span>
                    </div>
                    <span className={`text-[10px] font-bold ${pressureColor(s.pressure)} capitalize`}>
                      {s.pressure}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        s.pressure === 'bullish' ? 'bg-[#00FF88]' :
                        s.pressure === 'bearish' ? 'bg-red-500' : 'bg-zinc-500'
                      }`}
                      style={{ width: `${s.score}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-0.5">
                    <span className="text-[9px] text-zinc-600">Bearish</span>
                    <span className="text-[9px] text-zinc-500 font-mono">{s.score}/100</span>
                    <span className="text-[9px] text-zinc-600">Bullish</span>
                  </div>
                </div>
              ))}
              {!intelLoading && !marketIntel && (
                <button onClick={fetchMarketIntel} className="w-full text-xs text-zinc-400 hover:text-[#00FF88] py-4 text-center">
                  Tap to load sector data
                </button>
              )}
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-1.5 p-2 border-t border-[#00FF88]/20 flex-shrink-0">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !loading && sendMessage(input)}
              placeholder="Ask Specter..."
              className="h-7 text-xs bg-[#11161C] border-zinc-700 focus:border-[#00FF88]/50 text-zinc-200 placeholder:text-zinc-600"
              disabled={loading}
            />
            <Button variant="ghost" size="icon"
              className={`h-7 w-7 flex-shrink-0 ${listening ? 'text-[#00FF88] animate-pulse' : 'text-zinc-500 hover:text-[#00FF88]'}`}
              onClick={startListening} disabled={loading} title="Voice input">
              {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            </Button>
            <Button variant="ghost" size="icon"
              className="h-7 w-7 flex-shrink-0 text-zinc-500 hover:text-[#00FF88]"
              onClick={() => sendMessage(input)} disabled={loading || !input.trim()}>
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
