"use client";
import React, { useState } from 'react';
import { useEscape } from '@/lib/useEscape';
import { Plus, Pencil, Trash2, X, Wallet, Loader2, AlertCircle } from 'lucide-react';
import { checkedFetch, confirmAction } from '@/lib/notify';

interface ManualAccount {
  id: string; name: string; emoji: string; type: 'asset' | 'liability'; balance: number; notes?: string | null;
}
interface ManualAccountsManagerProps {
  accounts: ManualAccount[];
  onRefresh: () => void;
}

export default function ManualAccountsManager({ accounts, onRefresh }: ManualAccountsManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ManualAccount | null>(null);
  const [formData, setFormData] = useState({ name: '', emoji: '💰', type: 'asset', balance: '', notes: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalAssets = accounts.filter(a => a.type === 'asset').reduce((sum, a) => sum + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === 'liability').reduce((sum, a) => sum + a.balance, 0);

  const openModal = (account?: ManualAccount) => {
    setError(null);
    if (account) {
      setEditingAccount(account);
      setFormData({
        name: account.name, emoji: account.emoji, type: account.type,
        balance: String(account.balance), notes: account.notes || ''
      });
    } else {
      setEditingAccount(null);
      setFormData({ name: '', emoji: '💰', type: 'asset', balance: '', notes: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingAccount(null); setError(null); };
  useEscape(isModalOpen, closeModal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const balanceNum = Number(formData.balance);
      if (formData.type === 'asset' && balanceNum < 0) {
        setError('Asset balance cannot be negative.');
        setIsSubmitting(false);
        return;
      }
      const payload = { ...formData, balance: balanceNum };
      const method = editingAccount ? 'PUT' : 'POST';
      const url = editingAccount ? `/api/manual-accounts?id=${editingAccount.id}` : '/api/manual-accounts';
      
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save account');
      }
      closeModal();
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Error saving account');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!(await confirmAction({ title: 'Delete this account?', message: 'This cannot be undone.', confirmLabel: 'Delete', destructive: true }))) return;
    const ok = await checkedFetch(`/api/manual-accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' }, "Couldn't delete that account.");
    if (ok) onRefresh();
  };

  return (
    <div className="bg-surface rounded-[22px] p-6 border border-white/[0.08]">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white text-xl font-bold flex items-center gap-2"><Wallet className="w-6 h-6 text-teal-400"/> Manual Accounts</h2>
        <button onClick={() => openModal()} className="bg-teal-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition">
          <Plus className="w-4 h-4"/> Add
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1 bg-white/[0.05] p-4 rounded-2xl border border-white/[0.08]">
          <p className="text-slate-400 text-xs mb-1">Total Assets</p>
          <p className="text-emerald-400 font-bold text-lg">${totalAssets.toLocaleString()}</p>
        </div>
        <div className="flex-1 bg-white/[0.05] p-4 rounded-2xl border border-white/[0.08]">
          <p className="text-slate-400 text-xs mb-1">Total Liabilities</p>
          <p className="text-rose-400 font-bold text-lg">${totalLiabilities.toLocaleString()}</p>
        </div>
      </div>

      {accounts.length === 0 ? (
        <p className="text-slate-400 text-center py-8">No manual accounts yet. Add real estate, crypto, 401k, car, etc.</p>
      ) : (
        <div className="space-y-3">
          {accounts.map(account => (
            <div key={account.id} className="bg-white/[0.05] p-4 rounded-[22px] border border-white/[0.08] flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="text-2xl">{account.emoji}</div>
                <div>
                  <h3 className="text-white font-bold text-md">{account.name}</h3>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${account.type === 'asset' ? 'bg-emerald-400/20 text-emerald-400' : 'bg-rose-400/20 text-rose-400'}`}>
                    {account.type}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-white font-bold text-lg">${account.balance.toLocaleString()}</span>
                <button onClick={() => openModal(account)} aria-label={`Edit ${account.name}`} className="text-slate-400 hover:text-white p-1"><Pencil className="w-4 h-4"/></button>
                <button onClick={() => handleDelete(account.id)} aria-label={`Delete ${account.name}`} className="text-rose-400 hover:text-rose-300 p-1"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="manual-account-modal-title" className="bg-slate-900 border border-white/[0.08] rounded-[22px] p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 id="manual-account-modal-title" className="text-white font-bold text-lg">{editingAccount ? 'Edit Account' : 'Add Manual Account'}</h3>
              <button onClick={closeModal} aria-label="Close" className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            {error && (
              <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Account Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400" placeholder="e.g. 401k, Real Estate" />
              </div>
              <div className="flex gap-2">
                <div className="w-20">
                  <label className="text-slate-400 text-xs mb-1 block">Emoji</label>
                  <input type="text" value={formData.emoji} onChange={e => setFormData({...formData, emoji: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400 text-center" />
                </div>
                <div className="flex-1">
                  <label className="text-slate-400 text-xs mb-1 block">Type</label>
                  <select value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as 'asset' | 'liability'})} className="w-full bg-white/[0.05] border border-white/[0.08] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400">
                    <option value="asset">Asset (Adds to Net Worth)</option>
                    <option value="liability">Liability (Subtracts from Net Worth)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-slate-400 text-xs mb-1 block">Balance ($)</label>
                <input required type="number" step="any" min={formData.type === 'asset' ? "0" : undefined} value={formData.balance} onChange={e => setFormData({...formData, balance: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-teal-400" placeholder="0.00" />
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full bg-teal-400 text-slate-950 py-3 rounded-xl font-bold text-sm hover:bg-teal-300 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isSubmitting ? 'Saving...' : 'Save Account'}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
