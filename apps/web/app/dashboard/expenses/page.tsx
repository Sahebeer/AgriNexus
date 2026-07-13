"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import {
  ArrowLeft,
  Coins,
  TrendingUp,
  Sparkles,
  Plus,
  Trash2,
  RefreshCw,
  TrendingDown,
  Info,
  DollarSign,
  Briefcase,
  X,
  Target,
  ArrowRight,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Expense {
  id: number;
  category: string;
  amount: number;
  description: string;
  expense_date: string;
  crop: string;
  notes: string;
}

interface OptimizerSuggestion {
  category: string;
  issue: string;
  solution: string;
  saving_estimate: string;
}

interface ProfitabilityForecast {
  crop: string;
  estimated_yield_tonnes: number;
  market_price_per_qtl: number;
  estimated_revenue: number;
  net_margin: number;
}

interface OptimizationReport {
  overall_health: string;
  savings_opportunity: number;
  suggestions: OptimizerSuggestion[];
  profitability_forecast: ProfitabilityForecast;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  "Seeds",
  "Fertilizers",
  "Labor",
  "Irrigation",
  "Machinery",
  "Transport",
  "Miscellaneous",
];

const CROPS = [
  "Rice", "Wheat", "Cotton", "Tomato", "Potato", "Sugarcane", "Mustard", "Corn",
  "Soybean", "Chickpeas (Gram)", "Groundnut", "Onion", "Apple", "Mango",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Seeds": "bg-emerald-500",
  "Fertilizers": "bg-blue-500",
  "Labor": "bg-amber-500",
  "Irrigation": "bg-sky-500",
  "Machinery": "bg-purple-500",
  "Transport": "bg-indigo-500",
  "Miscellaneous": "bg-stone-500",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [report, setReport] = useState<OptimizationReport | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingOptimization, setIsLoadingOptimization] = useState(false);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [category, setCategory] = useState("Seeds");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [crop, setCrop] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile Context
  const [profileCrop, setProfileCrop] = useState("General Crop");
  const [profileSize, setProfileSize] = useState(1.5);

  useEffect(() => {
    if (user?.email) {
      try {
        const stored = localStorage.getItem(`agrinexus_farms_${user.email}`);
        if (stored) {
          const farms = JSON.parse(stored);
          if (farms?.[0]?.crop) {
            setProfileCrop(farms[0].crop);
            setCrop(farms[0].crop);
          }
          if (farms?.[0]?.size) {
            setProfileSize(farms[0].size);
          }
        }
      } catch { /* empty */ }
    }
  }, [user]);

  const fetchExpenses = async () => {
    setIsLoadingList(true);
    try {
      const res = await api.get("/api/v1/expenses/");
      setExpenses(res.data);
    } catch {
      showToast("Failed to fetch expenses", "error");
    } finally {
      setIsLoadingList(false);
    }
  };

  const optimizeExpenses = async () => {
    setIsLoadingOptimization(true);
    try {
      const res = await api.post("/api/v1/expenses/optimize", null, {
        params: {
          farm_size: profileSize,
          crop_context: profileCrop,
        },
      });
      setReport(res.data);
    } catch {
      showToast("AI Optimization analysis failed", "error");
    } finally {
      setIsLoadingOptimization(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-trigger optimization when expenses load
  useEffect(() => {
    if (expenses.length > 0) {
      optimizeExpenses();
    } else {
      setReport(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      showToast("Please enter a valid amount", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/api/v1/expenses/", {
        category,
        amount: parseFloat(amount),
        description,
        expense_date: expenseDate,
        crop: crop || undefined,
        notes,
      });
      showToast("Expense logged successfully", "success");
      setIsModalOpen(false);
      // Reset form
      setAmount("");
      setDescription("");
      setNotes("");
      // Refresh
      fetchExpenses();
    } catch {
      showToast("Failed to log expense", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm("Are you sure you want to delete this expense log?")) return;
    try {
      await api.delete(`/api/v1/expenses/${id}`);
      showToast("Expense record removed", "success");
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch {
      showToast("Failed to delete expense record", "error");
    }
  };

  // Calculations
  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);

  const categoryBreakdown = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] ?? 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-neutral-800 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-display font-bold text-white text-lg">AI Expense Optimizer</span>
                <p className="text-[10px] text-neutral-500 -mt-0.5 font-semibold uppercase tracking-wider">Precision Cost Analysis & Forecaster</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-600 text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(0,200,117,0.15)]"
          >
            <Plus className="h-4 w-4" />
            Add Expense
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full space-y-8">
        
        {/* Top KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="glass border border-neutral-800 rounded-3xl p-6 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Total Investment</span>
              <h2 className="text-2xl font-bold text-white mt-1">₹{totalSpend.toLocaleString("en-IN")}</h2>
              <span className="text-[10px] text-neutral-400 font-semibold mt-1 block">{expenses.length} logged items</span>
            </div>
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <Coins className="h-6 w-6 text-primary" />
            </div>
          </div>

          <div className="glass border border-neutral-800 rounded-3xl p-6 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Savings Identified</span>
              <h2 className="text-2xl font-bold text-primary mt-1">
                {isLoadingOptimization ? (
                  <span className="text-sm font-normal text-neutral-500">Calculating...</span>
                ) : (
                  `₹${(report?.savings_opportunity ?? 0).toLocaleString("en-IN")}`
                )}
              </h2>
              <span className="text-[10px] text-neutral-400 font-semibold mt-1 block">
                {report?.overall_health ? `Status: ${report.overall_health}` : "Awaiting expenses"}
              </span>
            </div>
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          </div>

          <div className="glass border border-neutral-800 rounded-3xl p-6 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Profitability Forecast</span>
              <h2 className={`text-2xl font-bold mt-1 ${report?.profitability_forecast?.net_margin && report.profitability_forecast.net_margin > 0 ? "text-emerald-400" : "text-primary"}`}>
                {isLoadingOptimization ? (
                  <span className="text-sm font-normal text-neutral-500">Calculating...</span>
                ) : (
                  `₹${(report?.profitability_forecast?.net_margin ?? 0).toLocaleString("en-IN")}`
                )}
              </h2>
              <span className="text-[10px] text-neutral-400 font-semibold mt-1 block">
                {report?.profitability_forecast?.crop ? `Based on ${report.profitability_forecast.crop}` : "Enter expenses first"}
              </span>
            </div>
            <div className="p-3 bg-neutral-900 border border-neutral-800 rounded-2xl">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
          </div>

        </div>

        {/* Mid Row: Category breakdown + Profitability details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Category breakdown visual charts */}
          <div className="glass border border-neutral-800 rounded-3xl p-6 lg:col-span-1 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-neutral-300 border-b border-neutral-900 pb-3 mb-4">Investment Distribution</h3>
              
              {expenses.length === 0 ? (
                <div className="text-center py-12 text-xs text-neutral-600">Add expenses to see breakdown.</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(categoryBreakdown).map(([cat, amt]) => {
                    const pct = totalSpend > 0 ? (amt / totalSpend) * 100 : 0;
                    const col = CATEGORY_COLORS[cat] ?? "bg-neutral-600";
                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-neutral-400">{cat}</span>
                          <span className="text-neutral-200">₹{amt.toLocaleString("en-IN")} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-2 bg-neutral-900 rounded-full overflow-hidden">
                          <div className={`h-full ${col} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Profitability forecast widget details */}
          <div className="glass border border-neutral-800 rounded-3xl p-6 lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-neutral-300 border-b border-neutral-900 pb-3">Forecast Breakdown</h3>
            
            {report?.profitability_forecast ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-2xl">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Estimated Yield</span>
                  <div className="text-base font-bold text-white mt-1">
                    {report.profitability_forecast.estimated_yield_tonnes} tonnes
                  </div>
                  <span className="text-[9px] text-neutral-600 block mt-0.5">{profileSize} Ha field</span>
                </div>

                <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-2xl">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Market Rate</span>
                  <div className="text-base font-bold text-white mt-1">
                    ₹{report.profitability_forecast.market_price_per_qtl}/qtl
                  </div>
                  <span className="text-[9px] text-neutral-600 block mt-0.5">Estimated MSP average</span>
                </div>

                <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-2xl">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Projected Revenue</span>
                  <div className="text-base font-bold text-white mt-1">
                    ₹{report.profitability_forecast.estimated_revenue.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[9px] text-neutral-600 block mt-0.5">Yield × Market Price</span>
                </div>

                <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl">
                  <span className="text-[10px] text-primary uppercase tracking-widest font-bold">Projected Margin</span>
                  <div className="text-base font-bold text-primary mt-1">
                    ₹{report.profitability_forecast.net_margin.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[9px] text-primary/60 block mt-0.5">Net farm earnings</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-neutral-600 flex flex-col items-center justify-center">
                <Target className="h-8 w-8 text-neutral-800 mb-2" />
                <span>Profitability forecasts require logged farm parameters.</span>
              </div>
            )}
          </div>

        </div>

        {/* AI Recommendations panel */}
        <div className="glass border border-primary/10 rounded-3xl p-6 bg-primary/[0.01]">
          <div className="flex items-center gap-2 border-b border-neutral-900 pb-3 mb-6">
            <Sparkles className="h-5 w-5 text-primary" />
            <h3 className="text-sm font-bold text-white">AI Cost-Saving Recommendations</h3>
          </div>

          {isLoadingOptimization ? (
            <div className="flex items-center justify-center py-10 gap-2 text-xs text-neutral-500">
              <RefreshCw className="h-4 w-4 animate-spin text-primary" />
              <span>Gemini is auditing spending patterns...</span>
            </div>
          ) : !report?.suggestions || report.suggestions.length === 0 ? (
            <div className="text-center py-10 text-xs text-neutral-600">
              No cost saving warnings generated. Your spending pattern looks optimal!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {report.suggestions.map((sug, i) => (
                <div key={i} className="glass border border-neutral-800 p-5 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {sug.category}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      Save {sug.saving_estimate}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white leading-snug">{sug.issue}</h4>
                    <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{sug.solution}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses List / Log table */}
        <div className="glass border border-neutral-800 rounded-3xl p-6">
          <h3 className="text-sm font-bold text-neutral-300 border-b border-neutral-900 pb-3 mb-4">Expense Records</h3>
          
          {isLoadingList ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-12 text-xs text-neutral-600">
              No expenses recorded yet. Use "Add Expense" to start.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-900 text-neutral-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Crop</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900/60">
                  {expenses.map(e => (
                    <tr key={e.id} className="hover:bg-neutral-900/20 text-neutral-300">
                      <td className="py-3.5 px-4 font-medium">
                        {new Date(e.expense_date + "T00:00:00").toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-neutral-900 text-[10px] font-semibold border border-neutral-850">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-neutral-400 max-w-xs truncate">{e.description || "—"}</td>
                      <td className="py-3.5 px-4 font-semibold">{e.crop || "—"}</td>
                      <td className="py-3.5 px-4 text-right font-bold text-primary">₹{e.amount.toLocaleString("en-IN")}</td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="text-neutral-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-neutral-900 transition-all"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </main>

      {/* Add Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="glass border border-neutral-800 rounded-3xl w-full max-w-md overflow-hidden relative animate-slide-up">
            
            {/* Header */}
            <div className="border-b border-neutral-800 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Record Expense</h3>
                <p className="text-xs text-neutral-500 mt-0.5 font-medium">Keep track of your farm operational costs.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddExpense}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-medium"
                    >
                      {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Amount (INR)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="e.g. 8500"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors font-semibold"
                      required
                      min="1"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Description / Supplier</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. Purchased 5 bags of Neem Urea"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Crop Context</label>
                    <select
                      value={crop}
                      onChange={e => setCrop(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-medium"
                    >
                      <option value="">None</option>
                      {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Notes (optional)</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Paid in cash"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="border-t border-neutral-800 p-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-200 font-semibold py-3 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-primary hover:bg-primary-600 disabled:opacity-50 text-neutral-950 font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,200,117,0.15)]"
                >
                  {isSubmitting ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving...</> : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
