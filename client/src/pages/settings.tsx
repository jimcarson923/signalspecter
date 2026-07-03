import { useState, useEffect } from 'react';
import { Save, Sliders, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';

const SECTORS = ['All', 'Tech', 'Energy', 'Finance', 'Healthcare', 'EV/Auto'];

export default function SettingsPage() {
  const { toast } = useToast();
  const [saved, setSaved] = useState(false);
  const [params, setParams] = useState({
    minPrice: 0,
    maxPrice: 100,
    minScore: 50,
    sector: 'All',
    minVolume: 0,
  });

  // Load existing params on mount
  useEffect(() => {
    fetch('/api/specter/params', { credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) setParams(data);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    try {
      const res = await fetch('/api/specter/params', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(params),
      });
      if (res.ok) {
        setSaved(true);
        toast({ title: 'Specter parameters saved', description: 'Specter will use these filters when recommending stocks.' });
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      toast({ title: 'Save failed', description: 'Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sliders className="h-6 w-6 text-[#00FF88]" />
          Specter Parameters
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Tell Specter exactly what you're hunting for. These filters apply every time you ask "What should I look at today?"
        </p>
      </div>

      {/* Price Range */}
      <Card className="bg-[#11161C] border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white">Price Range</CardTitle>
          <CardDescription className="text-xs text-zinc-500">Only show stocks within this price window</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-zinc-400">Min Price ($)</Label>
              <Input
                type="number"
                min={0}
                value={params.minPrice}
                onChange={e => setParams(p => ({ ...p, minPrice: Number(e.target.value) }))}
                className="bg-[#0B0F14] border-zinc-700 text-white text-sm h-9"
              />
            </div>
            <div className="text-zinc-600 mt-5">—</div>
            <div className="flex-1 space-y-1">
              <Label className="text-xs text-zinc-400">Max Price ($)</Label>
              <Input
                type="number"
                min={0}
                value={params.maxPrice}
                onChange={e => setParams(p => ({ ...p, maxPrice: Number(e.target.value) }))}
                className="bg-[#0B0F14] border-zinc-700 text-white text-sm h-9"
              />
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Under $5', min: 0, max: 5 },
              { label: '$5–$15', min: 5, max: 15 },
              { label: '$15–$50', min: 15, max: 50 },
              { label: '$50–$100', min: 50, max: 100 },
              { label: '$100–$500', min: 100, max: 500 },
              { label: 'Any price', min: 0, max: 999999 },
            ].map(preset => (
              <button
                key={preset.label}
                onClick={() => setParams(p => ({ ...p, minPrice: preset.min, maxPrice: preset.max }))}
                className={`text-xs px-3 py-1 rounded-full border transition-all ${
                  params.minPrice === preset.min && params.maxPrice === preset.max
                    ? 'border-[#00FF88] bg-[#00FF88]/10 text-[#00FF88]'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sector */}
      <Card className="bg-[#11161C] border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white">Sector Focus</CardTitle>
          <CardDescription className="text-xs text-zinc-500">Limit Specter to a specific industry</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={params.sector} onValueChange={v => setParams(p => ({ ...p, sector: v }))}>
            <SelectTrigger className="bg-[#0B0F14] border-zinc-700 text-white text-sm h-9">
              <SelectValue placeholder="Select sector" />
            </SelectTrigger>
            <SelectContent className="bg-[#11161C] border-zinc-700">
              {SECTORS.map(s => (
                <SelectItem key={s} value={s} className="text-zinc-200 focus:bg-[#00FF88]/10 focus:text-[#00FF88]">
                  {s === 'All' ? 'All Sectors' : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Minimum Specter Score */}
      <Card className="bg-[#11161C] border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white">Minimum Specter Score</CardTitle>
          <CardDescription className="text-xs text-zinc-500">
            Only show stocks with a Specter Score at or above this threshold. Higher = stricter filter.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">Conservative (50)</span>
            <span className="text-lg font-bold text-[#00FF88] font-mono">{params.minScore}</span>
            <span className="text-xs text-zinc-500">Aggressive (90+)</span>
          </div>
          <Slider
            min={0}
            max={95}
            step={5}
            value={[params.minScore]}
            onValueChange={([v]) => setParams(p => ({ ...p, minScore: v }))}
            className="[&_[role=slider]]:bg-[#00FF88] [&_[role=slider]]:border-[#00FF88]"
          />
          <div className="flex justify-between text-[10px] text-zinc-600">
            <span>0 — Show everything</span>
            <span>95 — Only the best</span>
          </div>
        </CardContent>
      </Card>

      {/* Minimum Volume */}
      <Card className="bg-[#11161C] border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-white">Minimum Daily Volume</CardTitle>
          <CardDescription className="text-xs text-zinc-500">Filter out illiquid stocks with low trading volume</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={String(params.minVolume)}
            onValueChange={v => setParams(p => ({ ...p, minVolume: Number(v) }))}
          >
            <SelectTrigger className="bg-[#0B0F14] border-zinc-700 text-white text-sm h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#11161C] border-zinc-700">
              <SelectItem value="0" className="text-zinc-200 focus:bg-[#00FF88]/10">No minimum</SelectItem>
              <SelectItem value="100000" className="text-zinc-200 focus:bg-[#00FF88]/10">100K+ shares/day</SelectItem>
              <SelectItem value="500000" className="text-zinc-200 focus:bg-[#00FF88]/10">500K+ shares/day</SelectItem>
              <SelectItem value="1000000" className="text-zinc-200 focus:bg-[#00FF88]/10">1M+ shares/day</SelectItem>
              <SelectItem value="5000000" className="text-zinc-200 focus:bg-[#00FF88]/10">5M+ shares/day</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button
        onClick={handleSave}
        className="w-full h-11 bg-[#00FF88] hover:bg-[#00FF88]/90 text-black font-bold text-sm transition-all"
      >
        {saved ? (
          <><CheckCircle2 className="h-4 w-4 mr-2" /> Parameters Saved</>
        ) : (
          <><Save className="h-4 w-4 mr-2" /> Save My Specter Parameters</>
        )}
      </Button>
    </div>
  );
}
