import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Bookmark, Plus, Trash2, Bell, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import type { WatchlistItem } from '@shared/schema';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { insertWatchlistItemSchema } from '@shared/schema';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';

const formSchema = insertWatchlistItemSchema.extend({
  symbol: z.string().min(1, 'Symbol required').max(6).toUpperCase(),
  companyName: z.string().min(1, 'Company name required'),
});

function AddSymbolDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { symbol: '', companyName: '', notes: '', alertPrice: undefined },
  });

  const mutation = useMutation({
    mutationFn: (data: z.infer<typeof formSchema>) =>
      apiRequest('POST', '/api/watchlist', data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] });
      setOpen(false);
      form.reset();
      toast({ title: 'Added to watchlist', description: form.getValues('symbol') });
      onSuccess();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground" data-testid="button-add-watchlist">
          <Plus className="h-4 w-4" />
          Add Symbol
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Add to Watchlist</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <FormField control={form.control} name="symbol" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Ticker Symbol</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. NVDA" className="uppercase bg-muted/50" data-testid="input-watchlist-symbol" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="companyName" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Company Name</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="e.g. NVIDIA Corp" className="bg-muted/50" data-testid="input-watchlist-company" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="alertPrice" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Alert Price (optional)</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    type="number"
                    placeholder="e.g. 150.00"
                    className="bg-muted/50"
                    onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    value={field.value ?? ''}
                    data-testid="input-watchlist-alert"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Notes (optional)</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Why are you watching this?" className="bg-muted/50" value={field.value ?? ''} />
                </FormControl>
              </FormItem>
            )} />
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={mutation.isPending} data-testid="button-submit-watchlist">
              {mutation.isPending ? 'Adding...' : 'Add to Watchlist'}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default function WatchlistPage() {
  const { data: items, isLoading } = useQuery<WatchlistItem[]>({
    queryKey: ['/api/watchlist'],
    queryFn: () => apiRequest('GET', '/api/watchlist').then(r => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/watchlist/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/watchlist'] }),
  });

  const { toast } = useToast();
  const [search, setSearch] = useState('');

  const filtered = items?.filter(i =>
    i.symbol.toLowerCase().includes(search.toLowerCase()) ||
    i.companyName.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <Bookmark className="h-4 w-4 text-primary" />
            </div>
            <h1 className="text-lg font-bold">My Watchlist</h1>
          </div>
          <p className="text-sm text-muted-foreground">Track your favorite stocks and set price alerts</p>
        </div>
        <AddSymbolDialog onSuccess={() => toast({ title: 'Watchlist updated' })} />
      </div>

      {/* Search */}
      {(items?.length ?? 0) > 0 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter watchlist..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/50 border-border/60"
          />
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-lg border border-border/60 bg-card">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-3 w-40 flex-1" />
              <Skeleton className="h-7 w-16" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground border border-dashed border-border rounded-xl">
          <Bookmark className="h-12 w-12 mb-4 opacity-20" />
          <p className="text-sm font-medium mb-1">{items?.length === 0 ? 'Your watchlist is empty' : 'No matches'}</p>
          <p className="text-xs opacity-70 mb-4">
            {items?.length === 0 ? 'Add stocks to track their Specter Score and get alerts' : 'Try a different search term'}
          </p>
          {items?.length === 0 && (
            <AddSymbolDialog onSuccess={() => {}} />
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-4 p-4 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors"
              data-testid={`card-watchlist-${item.id}`}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{item.symbol.slice(0, 2)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm">{item.symbol}</span>
                  {item.alertPrice && (
                    <span className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 px-1.5 py-0.5 rounded">
                      <Bell className="h-2.5 w-2.5" />
                      Alert ${item.alertPrice}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{item.companyName}</p>
                {item.notes && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 italic truncate">{item.notes}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-rose-400 flex-shrink-0"
                onClick={() => deleteMutation.mutate(item.id)}
                disabled={deleteMutation.isPending}
                data-testid={`button-delete-${item.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
