import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Send, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';

interface StockPick {
  ticker: string;
  price: number;
  score: number;
  bullish: boolean;
  change?: number;
  changePercent?: number;
}

interface Message {
  from: 'specter' | 'user';
  text: string;
  picks?: StockPick[];
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const speak = useCallback((text: string) => {
    if (muted || typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.95;
    utt.pitch = 0.85;
    utt.volume = 1;
    // Pick a deeper voice if available
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

  // Voice greeting on first load
  useEffect(() => {
    if (!user || greeted) return;
    const hour = new Date().getHours();
    const greeting =
      hour < 12 ? 'Good morning' :
      hour < 17 ? 'Good afternoon' : 'Good evening';
    const firstName = user.name?.split(' ')[0] ?? 'there';
    const greetMsg = `${greeting}, ${firstName}. I'm Specter, your AI trading intelligence. Ask me what stocks to look at today, or tell me what you're hunting for.`;

    setTimeout(() => {
      setMessages([{ from: 'specter', text: greetMsg, timestamp: new Date() }]);
      speak(greetMsg);
      setGreeted(true);
    }, 800);
  }, [user, greeted, speak]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load voices async
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { from: 'user', text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Detect intent
      const lower = text.toLowerCase();
      const isRecommend =
        lower.includes('look at') || lower.includes('today') ||
        lower.includes('recommend') || lower.includes('find') ||
        lower.includes('show me') || lower.includes('what should') ||
        lower.includes('opportunities') || lower.includes('buy');

      if (isRecommend) {
        const res = await fetch('/api/specter/recommend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include'
        });
        const data = await res.json();
        const specterMsg: Message = {
          from: 'specter',
          text: data.explanation,
          picks: data.picks,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, specterMsg]);
        speak(data.explanation);
      } else {
        // General question — send to OpenAI via a lightweight endpoint
        const res = await fetch('/api/specter/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ message: text })
        });
        const data = await res.json();
        const specterMsg: Message = {
          from: 'specter',
          text: data.reply,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, specterMsg]);
        speak(data.reply);
      }
    } catch {
      const errMsg = "I'm having trouble connecting right now. Try again in a moment.";
      setMessages(prev => [...prev, { from: 'specter', text: errMsg, timestamp: new Date() }]);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in your browser. Try Chrome.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      sendMessage(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const quickQuestions = [
    "What should I look at today?",
    "Find me stocks under $15",
    "What's bullish right now?",
    "Any high score picks?"
  ];

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
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-zinc-500 hover:text-[#00FF88]"
              onClick={() => setMuted(!muted)}
              title={muted ? 'Unmute Specter' : 'Mute Specter'}
            >
              {muted ? <VolumeX className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-500 hover:text-[#00FF88]"
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? 'Expand Specter' : 'Collapse Specter'}
          >
            {collapsed
              ? <ChevronDown className="h-3 w-3 -rotate-90" />
              : <ChevronUp className="h-3 w-3 rotate-90" />
            }
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

      {/* Expanded state */}
      {!collapsed && (
        <>
          {/* Messages */}
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
                  {msg.from === 'specter' && (
                    <p className="text-[9px] text-[#00FF88] font-bold mb-1 tracking-wider">SPECTER</p>
                  )}
                  <p>{msg.text}</p>
                </div>

                {/* Stock picks */}
                {msg.picks && msg.picks.length > 0 && (
                  <div className="w-full space-y-1 mt-1">
                    {msg.picks.slice(0, 8).map((pick, j) => (
                      <div key={j} className="flex items-center justify-between bg-[#11161C] border border-zinc-800 rounded px-2 py-1.5 hover:border-[#00FF88]/30 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{pick.ticker}</span>
                          <Badge className={`text-[9px] px-1 py-0 h-4 ${pick.bullish ? 'bg-[#00FF88]/15 text-[#00FF88] border-[#00FF88]/30' : 'bg-red-500/15 text-red-400 border-red-500/30'} border`}>
                            {pick.bullish ? '▲' : '▼'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-300">${pick.price.toFixed(2)}</span>
                          <div className="flex items-center gap-1">
                            <div className="w-8 h-1 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className="h-full bg-[#00FF88] rounded-full"
                                style={{ width: `${pick.score}%` }}
                              />
                            </div>
                            <span className="text-[9px] text-[#00FF88] font-mono">{pick.score}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-zinc-500">
                <Loader2 className="h-3 w-3 animate-spin text-[#00FF88]" />
                <span className="text-xs">Specter is scanning...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick questions */}
          {messages.length <= 1 && (
            <div className="px-3 pb-2 space-y-1">
              <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">Quick ask</p>
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="w-full text-left text-[10px] text-zinc-400 hover:text-[#00FF88] bg-[#11161C] hover:bg-[#00FF88]/8 border border-zinc-800 hover:border-[#00FF88]/30 rounded px-2 py-1.5 transition-all"
                >
                  {q}
                </button>
              ))}
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
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 flex-shrink-0 ${listening ? 'text-[#00FF88] animate-pulse' : 'text-zinc-500 hover:text-[#00FF88]'}`}
              onClick={startListening}
              disabled={loading}
              title="Voice input"
            >
              {listening ? <MicOff className="h-3 w-3" /> : <Mic className="h-3 w-3" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 flex-shrink-0 text-zinc-500 hover:text-[#00FF88]"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
