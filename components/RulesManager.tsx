"use client";
import React, { useState } from 'react';
import { Zap, Trash2, Plus, Loader2, AlertCircle } from 'lucide-react';
import { checkedFetch, confirmAction } from '@/lib/notify';

interface CategoryRule { id: string; merchantPattern: string; category: string; }
interface RulesManagerProps { rules: CategoryRule[]; onRefresh: () => void; extraCategories?: string[]; }

const CATEGORIES = [
  "Income", "Grocery", "Food & Dining", "Housing", "Transport", 
  "Shopping", "Entertainment", "Utilities", "Health & Fitness", 
  "Personal Care", "Investments", "Transfers", "General"
];

export default function RulesManager({ rules, onRefresh, extraCategories = [] }: RulesManagerProps) {
  // Standard categories plus any custom budget categories
  const categories = [...CATEGORIES, ...extraCategories.filter((c) => !CATEGORIES.includes(c))];
  const [pattern, setPattern] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchantPattern: pattern.trim(), category })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add rule');
      }
      setPattern('');
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Error adding rule');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAction({ title: 'Delete this rule?', message: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true }))) return;
    const ok = await checkedFetch(`/api/rules?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, "Couldn't delete that rule.");
    if (ok) onRefresh();
  };

  return (
    <div className="bg-surface rounded-[22px] p-6 border border-white/[0.08]">
      <div className="mb-6">
        <h2 className="text-white text-xl font-bold flex items-center gap-2"><Zap className="w-6 h-6 text-amber-400"/> Auto-Categorization Rules</h2>
        <p className="text-slate-400 text-sm mt-1">When a transaction matches a pattern, it's automatically categorized.</p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3 mb-6 bg-white/[0.05] p-3 rounded-2xl border border-white/[0.08]">
        <input 
          type="text" 
          placeholder="If merchant contains..."
          aria-label="Merchant contains"
          value={pattern} 
          onChange={e => setPattern(e.target.value)} 
          className="flex-1 bg-slate-900 border border-white/[0.08] rounded-xl px-4 py-2 text-white outline-none focus:border-teal-400 text-sm"
          required
        />
        <select
          aria-label="Category"
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="bg-slate-900 border border-white/[0.08] rounded-xl px-4 py-2 text-white outline-none focus:border-teal-400 text-sm min-w-[150px]"
        >
          {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="bg-teal-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 active:scale-95 transition disabled:opacity-50 min-w-[80px]"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4"/>}
          <span>{isSubmitting ? 'Adding...' : 'Add'}</span>
        </button>
      </form>

      {rules.length === 0 ? (
        <p className="text-slate-400 text-center py-8">No rules yet. Add a rule to auto-categorize merchants.</p>
      ) : (
        <div className="space-y-2">
          {rules.map(rule => (
            <div key={rule.id} className="bg-white/[0.05] p-3 rounded-2xl border border-white/[0.08] flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-white font-medium text-sm">{rule.merchantPattern}</span>
                <span className="text-slate-500 text-xs">→</span>
                <span className="bg-teal-400/10 text-teal-400 px-2 py-1 rounded-lg text-xs">{rule.category}</span>
              </div>
              <button onClick={() => handleDelete(rule.id)} aria-label={`Delete rule for ${rule.merchantPattern}`} className="p-2 text-slate-400 hover:text-rose-400 transition active:scale-95">
                <Trash2 className="w-4 h-4"/>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
