import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Zap, CheckCircle2 } from 'lucide-react';

interface SignupPageProps {
  onSwitch: () => void;
}

export default function SignupPage({ onSwitch }: SignupPageProps) {
  const { register, registerError, isRegisterPending } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    try {
      await register({ name, email, password });
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    }
  }

  const passwordStrong = password.length >= 8;

  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-2xl font-bold tracking-tight">
              <span className="text-emerald-400">SIGNAL</span>
              <span className="text-white">SPECTER</span>
            </span>
          </div>
          <p className="text-sm text-zinc-400">AI Market Intelligence Platform</p>
        </div>

        {/* Card */}
        <div className="bg-[#11161C] border border-white/8 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-white mb-1">Create your account</h2>
          <p className="text-sm text-zinc-400 mb-6">Start your free SignalSpecter account</p>

          {/* Free plan perks */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 mb-6 space-y-1.5">
            {['Full dashboard access', 'AI Market Briefing', 'Bullish & Bearish scanners'].map(perk => (
              <div key={perk} className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                <span className="text-xs text-zinc-300">{perk}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-zinc-300 text-sm">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="James Carson"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="bg-[#0B0F14] border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-zinc-300 text-sm">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="bg-[#0B0F14] border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-zinc-300 text-sm">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="bg-[#0B0F14] border-white/10 text-white placeholder:text-zinc-600 focus:border-emerald-500/50 focus:ring-emerald-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <p className={`text-xs ${passwordStrong ? 'text-emerald-400' : 'text-red-400'}`}>
                  {passwordStrong ? '✓ Strong password' : 'Too short — use at least 8 characters'}
                </p>
              )}
            </div>

            {(error || registerError) && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error || registerError}
              </div>
            )}

            <Button
              type="submit"
              disabled={isRegisterPending}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-semibold h-10"
            >
              {isRegisterPending ? 'Creating account...' : 'Create free account'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-zinc-400">
              Already have an account?{' '}
              <button
                onClick={onSwitch}
                className="text-emerald-400 hover:text-emerald-300 font-medium"
              >
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
