"use client";
import React, { useState } from 'react';
import { useEscape } from '@/lib/useEscape';
import { formatCalendarDate, daysUntilCalendarDate, calendarISODate } from "@/lib/dates";
import { Plus, Pencil, Trash2, X, Target, Loader2, AlertCircle } from 'lucide-react';

interface Goal {
  id: string; name: string; emoji: string; targetAmount: number;
  currentAmount: number; targetDate?: string | null; category?: string | null; completed: boolean;
}
interface GoalsTrackerProps {
  goals: Goal[];
  onRefresh: () => void;
}

export default function GoalsTracker({ goals, onRefresh }: GoalsTrackerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [formData, setFormData] = useState({ name: '', emoji: '🎯', targetAmount: '', currentAmount: '', targetDate: '', category: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = (goal?: Goal) => {
    setError(null);
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        name: goal.name, emoji: goal.emoji, targetAmount: String(goal.targetAmount),
        currentAmount: String(goal.currentAmount), targetDate: calendarISODate(goal.targetDate), category: goal.category || ''
      });
    } else {
      setEditingGoal(null);
      setFormData({ name: '', emoji: '🎯', targetAmount: '', currentAmount: '0', targetDate: '', category: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => { setIsModalOpen(false); setEditingGoal(null); setError(null); };
  useEscape(isModalOpen, closeModal);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const target = Number(formData.targetAmount) || 0;
      const current = Number(formData.currentAmount) || 0;
      const payload: any = { ...formData, targetAmount: target, currentAmount: current, completed: current >= target && target > 0 };
      if (editingGoal) {
        payload.id = editingGoal.id;
      }
      const method = editingGoal ? 'PUT' : 'POST';
      const url = editingGoal ? `/api/goals?id=${editingGoal.id}` : '/api/goals';
      
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save goal');
      }
      closeModal();
      onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Error saving goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/goals?id=${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete goal');
      setConfirmDeleteId(null);
      onRefresh();
    } catch (err: any) {
      console.error(err?.message || 'Error deleting goal');
    }
  };

  return (
    <div className="bg-surface border border-white/[0.08] rounded-[22px] p-4 sm:p-6 shadow-card">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-white text-xl font-bold flex items-center gap-2"><Target className="w-6 h-6 text-teal-400"/> Financial Goals</h2>
        <button onClick={() => openModal()} className="bg-teal-400 text-slate-950 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition">
          <Plus className="w-4 h-4"/> Add Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <p className="text-slate-400 text-center py-8">No goals yet — add your first financial goal!</p>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const target = goal.targetAmount || 0;
            const current = goal.currentAmount || 0;
            const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
            const barColor = goal.completed ? 'bg-emerald-400' : (percent >= 75 ? 'bg-amber-400' : 'bg-teal-400');
            return (
              <div key={goal.id} className="bg-white/[0.05] p-4 rounded-2xl border border-white/[0.08] flex flex-col gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-bold text-lg flex items-center gap-2">
                      <span>{goal.emoji}</span> {goal.name} {goal.completed && <span className="bg-emerald-400/20 text-emerald-400 text-xs px-2 py-1 rounded-xl">Completed 🎉</span>}
                    </h3>
                    <p className="text-slate-400 text-sm">${current.toLocaleString()} / ${target.toLocaleString()}</p>
                    {goal.targetDate && <p className="text-slate-500 text-xs mt-1">Target: {formatCalendarDate(goal.targetDate)}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openModal(goal)} aria-label={`Edit ${goal.name}`} className="p-2 text-slate-400 hover:text-white transition active:scale-95"><Pencil className="w-4 h-4"/></button>
                    <button onClick={() => setConfirmDeleteId(goal.id)} aria-label={`Delete ${goal.name}`} className="p-2 text-slate-400 hover:text-rose-400 transition active:scale-95"><Trash2 className="w-4 h-4"/></button>
                  </div>
                </div>

                {confirmDeleteId === goal.id && (
                  <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 my-2">
                    <span className="text-rose-400 text-xs font-semibold">Are you sure?</span>
                    <div className="flex gap-2">
                      <button onClick={() => handleDelete(goal.id)} className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 px-3 py-1.5 rounded-lg text-xs font-bold transition">Yes, Delete</button>
                      <button onClick={() => setConfirmDeleteId(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition">Cancel</button>
                    </div>
                  </div>
                )}

                <div className="w-full bg-white/10 rounded-full h-3 mt-2 overflow-hidden">
                  <div className={`h-3 rounded-full ${barColor} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{percent}%</span>
                  {target > current && <span>Target progress</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" className="bg-slate-900 border border-white/[0.08] rounded-[22px] w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 id="goal-modal-title" className="text-white font-bold text-xl">{editingGoal ? 'Edit Goal' : 'Add Goal'}</h3>
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
                <label className="block text-slate-400 text-xs mb-1">Name</label>
                <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2 text-white outline-none focus:border-teal-400" />
              </div>
              <div className="flex gap-4">
                <div className="w-1/4">
                  <label className="block text-slate-400 text-xs mb-1">Emoji</label>
                  <input required type="text" value={formData.emoji} onChange={e => setFormData({...formData, emoji: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2 text-white outline-none focus:border-teal-400 text-center" />
                </div>
                <div className="w-3/4">
                  <label className="block text-slate-400 text-xs mb-1">Category (Optional)</label>
                  <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2 text-white outline-none focus:border-teal-400" />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-1/2">
                  <label className="block text-slate-400 text-xs mb-1">Current Amount ($)</label>
                  <input required type="number" step="0.01" value={formData.currentAmount} onChange={e => setFormData({...formData, currentAmount: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2 text-white outline-none focus:border-teal-400" />
                </div>
                <div className="w-1/2">
                  <label className="block text-slate-400 text-xs mb-1">Target Amount ($)</label>
                  <input required type="number" step="0.01" value={formData.targetAmount} onChange={e => setFormData({...formData, targetAmount: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2 text-white outline-none focus:border-teal-400" />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 text-xs mb-1">Target Date (Optional)</label>
                <input type="date" value={formData.targetDate} onChange={e => setFormData({...formData, targetDate: e.target.value})} className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2 text-white outline-none focus:border-teal-400" />
              </div>
              <button disabled={isSubmitting} type="submit" className="w-full bg-teal-400 text-slate-950 py-3 rounded-xl font-bold mt-4 hover:bg-teal-300 transition active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>{isSubmitting ? 'Saving Goal...' : (editingGoal ? 'Update Goal' : 'Save Goal')}</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
