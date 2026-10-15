"use client";
import React, { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, X, Loader2 } from 'lucide-react';
import { localISODate } from '@/lib/dates';
import { useEscape } from '@/lib/useEscape';

interface QuickAddProps {
  accounts: { id: string; name: string; mask?: string }[];
  onSuccess: () => void;
  /** "fab": floating button (iPhone); "toolbar": compact button inside the desktop toolbar */
  variant?: 'fab' | 'toolbar';
}

const CATEGORIES = [
  "Income", "Grocery", "Food & Dining", "Housing", "Transport", 
  "Shopping", "Entertainment", "Utilities", "Health & Fitness", 
  "Personal Care", "Investments", "Transfers", "General"
];

export default function QuickAddTransaction({ accounts, onSuccess, variant = 'fab' }: QuickAddProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    amount: '',
    name: '',
    category: "General",
    moneyIn: false,
    accountId: accounts.length > 0 ? accounts[0].id : '',
    date: localISODate()
  });

  const id = useId();

  useEscape(isOpen, () => setIsOpen(false));

  const handleOpen = () => {
    setFormData(prev => ({
      ...prev,
      accountId: prev.accountId || (accounts.length > 0 ? accounts[0].id : '')
    }));
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // Money in (income, refunds) is stored negative; expenses positive
          amount: (formData.moneyIn ? -1 : 1) * Math.abs(Number(formData.amount)),
          name: formData.name,
          category: formData.category,
          accountId: formData.accountId || (accounts[0]?.id || ''),
          date: formData.date,
          reviewed: false
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add transaction');
      }
      setIsOpen(false);
      setFormData(prev => ({ ...prev, amount: '', name: '' }));
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {variant === 'toolbar' ? (
        <button
          onClick={handleOpen}
          aria-label="Add transaction"
          title="Add transaction"
          className="w-8 h-8 rounded-full flex items-center justify-center glass-button text-label-2 hover:text-white"
        >
          <Plus className="w-[18px] h-[18px]" />
        </button>
      ) : (
        <button
          onClick={handleOpen}
          aria-label="Add transaction"
          className="md:hidden fixed bottom-[calc(env(safe-area-inset-bottom,0px)+88px)] right-4 w-14 h-14 rounded-full liquid-glass lens !bg-sys-blue/80 text-[#fff] flex items-center justify-center z-50 active:scale-90 transition-transform duration-200 ease-apple"
        >
          <Plus className="w-8 h-8" />
        </button>
      )}

      {isOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            className="bg-slate-900 border-t md:border border-white/[0.08] rounded-t-[22px] md:rounded-[22px] w-full max-w-md p-6 pb-10 md:pb-6 animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6">
              <h3 id={`${id}-title`} className="text-white font-bold text-xl">Quick Add Transaction</h3>
              <button onClick={() => setIsOpen(false)} aria-label="Close" className="text-slate-400 hover:text-white p-1"><X className="w-5 h-5"/></button>
            </div>
            
            {error && <div role="alert" className="mb-4 p-3 bg-rose-400/10 border border-rose-400/20 text-rose-400 rounded-xl text-sm">{error}</div>}
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex bg-white/[0.06] rounded-[10px] p-0.5 text-[13px] font-semibold" role="radiogroup" aria-label="Type">
                {[{ v: false, label: "Expense" }, { v: true, label: "Money in" }].map((o) => (
                  <button key={o.label} type="button" role="radio" aria-checked={formData.moneyIn === o.v}
                    onClick={() => setFormData({ ...formData, moneyIn: o.v })}
                    className={`flex-1 py-1.5 rounded-[8px] transition ${formData.moneyIn === o.v ? (o.v ? "bg-sys-green text-[#fff]" : "bg-surface-3 text-white") : "text-label-2"}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor={`${id}-amount`} className="block text-slate-400 text-xs mb-1">Amount ($)</label>
                <input id={`${id}-amount`} autoFocus required type="number" inputMode="decimal" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white text-lg outline-none focus:border-teal-400" placeholder="0.00" />
              </div>
              <div>
                <label htmlFor={`${id}-name`} className="block text-slate-400 text-xs mb-1">Merchant / Description</label>
                <input id={`${id}-name`} required type="text" maxLength={200} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white outline-none focus:border-teal-400" placeholder="e.g. Starbucks" />
              </div>
              <div className="flex gap-3">
                <div className="w-1/2">
                  <label htmlFor={`${id}-category`} className="block text-slate-400 text-xs mb-1">Category</label>
                  <select id={`${id}-category`} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value, moneyIn: e.target.value === "Income" ? true : formData.moneyIn})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-3 text-white outline-none focus:border-teal-400 text-sm">
                    {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                <div className="w-1/2">
                  <label htmlFor={`${id}-date`} className="block text-slate-400 text-xs mb-1">Date</label>
                  <input id={`${id}-date`} required type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-3 text-white outline-none focus:border-teal-400 text-sm" />
                </div>
              </div>
              <div>
                <label htmlFor={`${id}-account`} className="block text-slate-400 text-xs mb-1">Account</label>
                <select id={`${id}-account`} value={formData.accountId} onChange={e => setFormData({...formData, accountId: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-3 text-white outline-none focus:border-teal-400 text-sm">
                  {accounts.length === 0 ? (
                    <option value="">Default Bank Account</option>
                  ) : (
                    accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.name} {acc.mask ? `(...${acc.mask})` : ''}</option>
                    ))
                  )}
                </select>
              </div>
              {accounts.length === 0 && (
                <p className="text-amber-400 text-xs text-center mt-2 font-medium">Connect a bank account first to add transactions.</p>
              )}
              <button type="submit" disabled={isSubmitting || accounts.length === 0} className="w-full bg-sys-blue hover:bg-sys-blue/90 text-[#fff] py-3.5 rounded-xl font-bold mt-4 active:scale-95 transition disabled:opacity-50 flex items-center justify-center gap-2">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin text-slate-950" /> : null}
                <span>{isSubmitting ? 'Adding...' : 'Add Transaction'}</span>
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
