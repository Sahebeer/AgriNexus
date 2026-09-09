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
  "Miscellaneous": "bg-slate-500",
};

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
  const [crop, setCrop] = useState("Wheat");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Field size context
  const [profileSize, setProfileSize] = useState(2.0);

  const fetchExpenses = async () => {
    setIsLoadingList(true);
    try {
      const res = await api.get("/api/v1/expenses/");
      setExpenses(res.data);
    } catch {
      showToast("Failed to retrieve expense logs", "error");
    } finally {
      setIsLoadingList(false);
    }
  };

  const fetchOptimization = async () => {
    setIsLoadingOptimization(true);
    try {
      const res = await api.post("/api/v1/expenses/optimize", {
        farm_size_hectares: profileSize,
        crop: crop || "Wheat",
      });
      setReport(res.data);
    } catch {
      // Ignore silently
    } finally {
      setIsLoadingOptimization(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  useEffect(() => {
    if (expenses.length > 0) {
      fetchOptimization();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses.length]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      showToast("Enter a valid expense amount", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/api/v1/expenses/", {
        category,
        amount: parseFloat(amount),
        description,
        expense_date: expenseDate,
        crop,
      });
      showToast("Expense entry logged", "success");
      setIsModalOpen(false);
      setAmount("");
      setDescription("");
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

  const totalSpend = expenses.reduce((s, e) => s + e.amount, 0);

  const categoryBreakdown = expenses.reduce((acc, exp) => {
    acc[exp.category] = (acc[exp.category] ?? 0) + exp.amount;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-slate-500 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-amber-50 text-amber-600 p-2 rounded-xl border border-amber-100">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <span className="font-display font-bold text-slate-900 text-base">Expense Optimizer</span>
                <p className="text-xs text-slate-500">Precision Cost Analysis & Forecaster</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Expense
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full space-y-6">
        
        {/* Top KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          <div className="clean-card p-6 flex items-center justify-between bg-white shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Spend</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">₹{totalSpend.toLocaleString("en-IN")}</h2>
              <span className="text-[11px] text-slate-500 mt-1 block">{expenses.length} logged records</span>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <Coins className="h-5 w-5 text-slate-700" />
            </div>
          </div>

          <div className="clean-card p-6 flex items-center justify-between bg-white shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Identified Savings</span>
              <h2 className="text-2xl font-bold text-emerald-700 mt-1">
                {isLoadingOptimization ? (
                  <span className="text-sm font-normal text-slate-400">Calculating...</span>
                ) : (
                  `₹${(report?.savings_opportunity ?? 0).toLocaleString("en-IN")}`
                )}
              </h2>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {report?.overall_health ? `Health: ${report.overall_health}` : "Awaiting logs"}
              </span>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-2xl">
              <Sparkles className="h-5 w-5 text-emerald-600" />
            </div>
          </div>

          <div className="clean-card p-6 flex items-center justify-between bg-white shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estimated Net Margin</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">
                {isLoadingOptimization ? (
                  <span className="text-sm font-normal text-slate-400">Calculating...</span>
                ) : (
                  `₹${(report?.profitability_forecast?.net_margin ?? 0).toLocaleString("en-IN")}`
                )}
              </h2>
              <span className="text-[11px] text-slate-500 mt-1 block">
                {report?.profitability_forecast?.crop ? `Crop: ${report.profitability_forecast.crop}` : "Enter expenses first"}
              </span>
            </div>
            <div className="p-3 bg-sky-50 border border-sky-100 rounded-2xl">
              <TrendingUp className="h-5 w-5 text-sky-600" />
            </div>
          </div>

        </div>

        {/* Mid Row: Category breakdown + Profitability details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Category breakdown visual charts */}
          <div className="clean-card p-6 lg:col-span-1 bg-white shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-3 mb-4">Expense Categories</h3>
              
              {expenses.length === 0 ? (
                <div className="text-center py-10 text-xs text-slate-400">Add expenses to view breakdown.</div>
              ) : (
                <div className="space-y-3.5">
                  {Object.entries(categoryBreakdown).map(([cat, amt]) => {
                    const pct = totalSpend > 0 ? (amt / totalSpend) * 100 : 0;
                    const col = CATEGORY_COLORS[cat] ?? "bg-slate-500";
                    return (
                      <div key={cat} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">{cat}</span>
                          <span className="text-slate-900 font-semibold">₹{amt.toLocaleString("en-IN")} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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
          <div className="clean-card p-6 lg:col-span-2 space-y-4 bg-white shadow-sm">
            <h3 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-3">Profitability Forecast</h3>
            
            {report?.profitability_forecast ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Estimated Yield</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {report.profitability_forecast.estimated_yield_tonnes} tonnes
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">{profileSize} Ha acreage</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Market Rate</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    ₹{report.profitability_forecast.market_price_per_qtl}/qtl
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Estimated mandi price</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Gross Revenue</span>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    ₹{report.profitability_forecast.estimated_revenue.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Yield × Market Price</span>
                </div>

                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <span className="text-[10px] text-emerald-800 uppercase tracking-wider font-bold">Projected Net Margin</span>
                  <div className="text-base font-bold text-emerald-800 mt-0.5">
                    ₹{report.profitability_forecast.net_margin.toLocaleString("en-IN")}
                  </div>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">Estimated farm profits</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-xs text-slate-400 flex flex-col items-center justify-center">
                <Target className="h-6 w-6 text-slate-300 mb-2" />
                <span>Add your crop expenses to view revenue projection and margin estimates.</span>
              </div>
            )}
          </div>

        </div>

        {/* AI Recommendations panel */}
        <div className="clean-card p-6 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-5">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cost Reduction Suggestions</h3>
          </div>

          {isLoadingOptimization ? (
            <div className="flex items-center justify-center py-8 gap-2 text-xs text-slate-400">
              <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
              <span>Analyzing spending patterns...</span>
            </div>
          ) : !report?.suggestions || report.suggestions.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No cost anomalies detected. Your operational expenditure is aligned with best practices!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report.suggestions.map((sug, i) => (
                <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {sug.category}
                    </span>
                    <span className="text-xs font-bold text-emerald-700">
                      Save {sug.saving_estimate}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">{sug.issue}</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{sug.solution}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses List / Log table */}
        <div className="clean-card p-6 bg-white shadow-sm">
          <h3 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-3 mb-4">Expense Records</h3>
          
          {isLoadingList ? (
            <div className="flex justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-400">
              No expenses recorded yet. Use "Add Expense" to log your first input cost.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Crop</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expenses.map(e => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-slate-500 font-medium">
                        {new Date(e.expense_date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold border border-slate-200">
                          {e.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-900 font-semibold">{e.description || "—"}</td>
                      <td className="py-3 px-3 text-slate-600">{e.crop || "—"}</td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        ₹{e.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                          title="Delete expense"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="clean-card bg-white rounded-2xl w-full max-w-md overflow-hidden relative shadow-2xl">
            
            {/* Header */}
            <div className="border-b border-slate-100 p-5 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Farm Expense</h3>
                <p className="text-xs text-slate-500">Log inputs, labor, or machinery costs.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateExpense}>
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Category</label>
                    <select
                      value={category}
                      onChange={e => setCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Amount (₹)</label>
                    <input
                      type="number"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                      placeholder="e.g. 4500"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Crop</label>
                    <select
                      value={crop}
                      onChange={e => setCrop(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Date</label>
                    <input
                      type="date"
                      value={expenseDate}
                      onChange={e => setExpenseDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Description / Notes</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="e.g. 2 bags Urea, 1 liter bio-fungicide"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 p-4 flex gap-3 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isSubmitting ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Saving...</> : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
