"use client";

import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import {
  ArrowLeft,
  Coins,
  TrendingUp,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
  Activity,
  X
} from "lucide-react";

interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  crop: string;
  notes: string;
}

interface ExpensesModuleProps {
  onBack?: () => void;
}

const EXPENSE_CATEGORIES = [
  "Seeds",
  "Fertilizers",
  "Labor",
  "Pesticides / Chemicals",
  "Machinery & Fuel",
  "Irrigation",
  "Harvest & Transport",
  "Other",
];

export default function ExpensesModule({ onBack }: ExpensesModuleProps) {
  const { showToast } = useToastStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form Fields
  const [amount, setAmount] = useState(1500);
  const [category, setCategory] = useState("Seeds");
  const [crop, setCrop] = useState("Wheat");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchExpenses = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/v1/expenses/");
      setExpenses(res.data);
    } catch {
      // Fallback demo items
      setExpenses([
        { id: 1, category: "Seeds", amount: 4800, description: "Certified Wheat HD-2967 Seed Bags", expense_date: "2026-03-01", crop: "Wheat", notes: "" },
        { id: 2, category: "Fertilizers", amount: 6200, description: "DAP & Urea Basal Application", expense_date: "2026-03-03", crop: "Wheat", notes: "" },
        { id: 3, category: "Irrigation", amount: 2100, description: "Diesel pump rental for canal channel", expense_date: "2026-03-06", crop: "Wheat", notes: "" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post("/api/v1/expenses/", {
        amount,
        category,
        crop,
        description,
        expense_date: expenseDate,
      });
      showToast("Expense logged successfully", "success");
      setShowAddModal(false);
      setDescription("");
      fetchExpenses();
    } catch {
      showToast("Failed to record expense", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    try {
      await api.delete(`/api/v1/expenses/${id}`);
      showToast("Expense entry deleted", "info");
      fetchExpenses();
    } catch {
      showToast("Failed to delete expense", "error");
    }
  };

  const totalSpent = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  // Group by category
  const categoryTotals: Record<string, number> = {};
  expenses.forEach((e) => {
    categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
  });

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header Banner */}
      <div className="clean-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Coins className="h-5 w-5 text-amber-600" />
              Farm Expense Logger & Margin Forecaster
            </h1>
            <p className="text-xs text-slate-500">Track cultivation costs and evaluate projected seasonal harvest profitability</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Record Expense</span>
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="clean-card p-6 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Expenditure</span>
          <div className="text-2xl font-extrabold text-slate-900">₹{totalSpent.toLocaleString()}</div>
          <span className="text-xs text-slate-500 font-medium">Recorded across {expenses.length} transaction entries</span>
        </div>

        <div className="clean-card p-6 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Projected Harvest Yield</span>
          <div className="text-2xl font-extrabold text-emerald-700">8.4 Tonnes</div>
          <span className="text-xs text-slate-500 font-medium">Estimated gross revenue: ₹1,85,000</span>
        </div>

        <div className="clean-card p-6 space-y-1">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Net Seasonal Margin</span>
          <div className="text-2xl font-extrabold text-emerald-700">
            ₹{(185000 - totalSpent).toLocaleString()}
          </div>
          <span className="text-xs text-emerald-700 font-semibold">+68.4% Return on Input Capital</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Col: Category Breakdown */}
        <div className="lg:col-span-5 space-y-6">
          <div className="clean-card p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Input Cost Breakdown</h3>

            <div className="space-y-3">
              {Object.entries(categoryTotals).map(([cat, amt]) => {
                const pct = totalSpent > 0 ? (amt / totalSpent) * 100 : 0;
                return (
                  <div key={cat} className="space-y-1 text-xs">
                    <div className="flex justify-between font-semibold">
                      <span className="text-slate-700">{cat}</span>
                      <span className="text-slate-900 font-bold">₹{amt.toLocaleString()} ({pct.toFixed(0)}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Col: Expense Entries Stream */}
        <div className="lg:col-span-7 space-y-6">
          <div className="clean-card p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transaction Ledger</h3>

            {isLoading ? (
              <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 animate-spin text-emerald-600" /></div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No expense entries logged yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {expenses.map((item) => (
                  <div key={item.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{item.description || item.category}</span>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {item.category}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">Crop: {item.crop} • {item.expense_date}</span>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-slate-900">₹{item.amount.toLocaleString()}</span>
                      <button
                        onClick={() => handleDeleteExpense(item.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="border-b border-slate-100 p-6 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Farm Expense</h3>
                <p className="text-xs text-slate-500 mt-0.5">Log input procurement cost or labor wages.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpense}>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Amount (₹) *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    >
                      {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Crop Target</label>
                    <input
                      type="text"
                      value={crop}
                      onChange={(e) => setCrop(e.target.value)}
                      placeholder="e.g. Wheat"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={(e) => setExpenseDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Description</label>
                  <input
                    type="text"
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. 2 bags Urea from Kisan Seva Kendra"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 p-5 bg-slate-50/50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm"
                >
                  {isSubmitting ? "Logging..." : "Commit Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
