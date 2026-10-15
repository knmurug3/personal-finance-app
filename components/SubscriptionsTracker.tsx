"use client";

import { useState } from "react";
import { checkedFetch } from "@/lib/notify";
import { monthlyEquivalent } from "@/lib/money";
import { formatCalendarDate, daysUntilCalendarDate, calendarISODate } from "@/lib/dates";
import {
  Repeat,
  Tv,
  Music,
  Wifi,
  Zap,
  Dumbbell,
  Cloud,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface Subscription {
  id: string;
  name: string;
  merchantName?: string | null;
  amount: number;
  frequency: string;
  nextDueDate: string;
  category: string;
  status: string;
}

interface SubscriptionsTrackerProps {
  subscriptions: Subscription[];
  totalMonthlyCost: number;
  onRefresh: () => void;
}

export function SubscriptionsTracker({
  subscriptions,
  totalMonthlyCost,
  onRefresh,
}: SubscriptionsTrackerProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newCategory, setNewCategory] = useState("Entertainment");
  const [newFrequency, setNewFrequency] = useState("monthly");
  const [newDueDate, setNewDueDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState<string | null>(null);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(val);

  const getSubIcon = (name: string, category: string) => {
    const n = name.toLowerCase();
    if (n.includes("netflix") || n.includes("hulu") || n.includes("tv"))
      return <Tv className="w-5 h-5 text-rose-400" />;
    if (n.includes("spotify") || n.includes("apple music"))
      return <Music className="w-5 h-5 text-emerald-400" />;
    if (n.includes("xfinity") || n.includes("internet") || n.includes("wifi"))
      return <Wifi className="w-5 h-5 text-blue-400" />;
    if (n.includes("coned") || n.includes("electric") || n.includes("utility"))
      return <Zap className="w-5 h-5 text-amber-400" />;
    if (n.includes("gym") || n.includes("equinox") || n.includes("fitness"))
      return <Dumbbell className="w-5 h-5 text-purple-400" />;
    if (n.includes("icloud") || n.includes("cloud") || n.includes("storage"))
      return <Cloud className="w-5 h-5 text-cyan-400" />;
    return <Repeat className="w-5 h-5 text-indigo-400" />;
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "cancelled" : "active";
    try {
      const ok = await checkedFetch(
        "/api/subscriptions",
        { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: newStatus }) },
        "Couldn't update that subscription."
      );
      if (ok) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSub = async (id: string) => {
    try {
      const ok = await checkedFetch(`/api/subscriptions?id=${id}`, { method: "DELETE" }, "Couldn't remove that subscription.");
      setConfirmDeleteSubId(null);
      if (ok) onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newAmount) return;
    setIsSubmitting(true);
    try {
      const ok = await checkedFetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          amount: parseFloat(newAmount),
          category: newCategory,
          frequency: newFrequency,
          nextDueDate: newDueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      }, "Couldn't add that subscription.");
      if (!ok) return;
      setShowAddModal(false);
      setNewName("");
      setNewAmount("");
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Subscription overview */}
      <div className="bg-surface border border-indigo-500/20 rounded-[22px] p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Repeat className="w-4 h-4" />
              <span>Monthly Total</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white">
              {formatCurrency(totalMonthlyCost)} <span className="text-base font-normal text-slate-400">/ month</span>
            </h2>
            <p className="text-label-2 text-[13px] mt-0.5">
              Tracking {subscriptions.filter((s) => s.status === "active").length} active recurring bills
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-[#fff] font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-900/40 transition text-xs self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Subscription</span>
          </button>
        </div>
      </div>

      {/* Subscriptions Grid List */}
      <div className="bg-surface border border-white/[0.08] rounded-[22px] p-6 shadow-xl">
        <h3 className="text-[17px] font-semibold tracking-tight text-white mb-4">Active Recurring Charges</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subscriptions.map((sub) => {
            const isActive = sub.status === "active";
            const daysLeft = daysUntilCalendarDate(sub.nextDueDate);

            return (
              <div
                key={sub.id}
                className={`border rounded-2xl p-4 transition-all flex items-center justify-between ${
                  isActive
                    ? "bg-white/[0.05] border-white/[0.08] hover:border-white/[0.16]"
                    : "bg-white/[0.05] border-white/[0.06] opacity-60"
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="p-3 bg-slate-900 rounded-2xl border border-white/[0.08] shrink-0">
                    {getSubIcon(sub.name, sub.category)}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-100 text-sm truncate">{sub.name}</h4>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="capitalize">{sub.frequency}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-indigo-300">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        {daysLeft > 0 ? `Due in ${daysLeft} day${daysLeft === 1 ? "" : "s"}` : daysLeft === 0 ? "Due today" : "Overdue"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <span className="font-bold text-slate-100 text-sm block">
                      {formatCurrency(sub.amount)}
                    </span>
                    <span className="text-[10px] text-slate-500 capitalize">
                      {sub.frequency !== "monthly" ? `≈ ${formatCurrency(monthlyEquivalent(sub.amount, sub.frequency))}/mo · ` : ""}
                      {sub.category}
                    </span>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(sub.id, sub.status)}
                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition ${
                      isActive
                        ? "bg-slate-800 hover:bg-slate-700 text-slate-300"
                        : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    }`}
                  >
                    {isActive ? "Active" : "Paused"}
                  </button>

                  {confirmDeleteSubId === sub.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleDeleteSub(sub.id)} className="text-xs bg-rose-500/20 text-rose-400 px-2 py-1 rounded">Yes</button>
                      <button onClick={() => setConfirmDeleteSubId(null)} className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded">No</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteSubId(sub.id)}
                      className="text-slate-600 hover:text-rose-400 transition"
                      title="Remove subscription"
                      aria-label={`Remove ${sub.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Subscription Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-white/[0.08] rounded-2xl p-6 max-w-md w-full shadow-card">
            <h3 className="text-[17px] font-semibold tracking-tight text-white mb-4">Track New Subscription</h3>
            <form onSubmit={handleAddSubscription} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 block mb-1">Service Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Disney+, Gym Membership"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1">Amount ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="14.99"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-slate-200"
                  />
                </div>
                <div>
                  <label className="text-slate-400 block mb-1">Frequency</label>
                  <select
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-slate-200"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1">Next Payment Date</label>
                <input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-slate-200"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-[#fff] font-medium py-2 rounded-xl transition"
                >
                  Save Subscription
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
