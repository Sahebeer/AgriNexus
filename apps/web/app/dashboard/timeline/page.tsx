"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import {
  ArrowLeft,
  Activity,
  Plus,
  Trash2,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  BookOpen,
  Sprout,
  Droplets,
  FlaskConical,
  Bug,
  ShieldAlert,
  Coins,
  Bot,
  FileText,
  FileSpreadsheet,
  CheckCircle2,
  HelpCircle,
  X,
} from "lucide-react";

interface ActivityLog {
  id: number;
  activity_type: string;
  source: string; // "auto" | "manual"
  title: string;
  description: string;
  crop: string;
  field_name: string;
  activity_date: string;
  metadata_json: string | null;
  created_at: string;
}

const ACTIVITY_TYPES = [
  "Disease Scan",
  "AI Chat",
  "Fertilizer Application",
  "Irrigation",
  "Pesticide / Spray",
  "Harvest",
  "Purchase",
  "Expense",
  "Field Observation",
  "Shopping List",
  "Calendar Created",
  "Note",
  "Other",
];

const CROPS = [
  "Rice", "Wheat", "Cotton", "Tomato", "Potato", "Sugarcane", "Mustard", "Corn",
  "Soybean", "Chickpeas (Gram)", "Groundnut", "Onion", "Apple", "Mango",
];

const TYPE_CONFIG: Record<string, { icon: React.FC<any>; bg: string; text: string; border: string }> = {
  "Disease Scan":           { icon: ShieldAlert,  bg: "bg-rose-50",    text: "text-rose-600",    border: "border-rose-200" },
  "AI Chat":                { icon: Bot,          bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Fertilizer Application": { icon: FlaskConical, bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  "Irrigation":             { icon: Droplets,     bg: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200" },
  "Pesticide / Spray":      { icon: Bug,          bg: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200" },
  "Harvest":                { icon: Sprout,       bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  "Purchase":               { icon: Coins,        bg: "bg-teal-50",    text: "text-teal-700",    border: "border-teal-200" },
  "Expense":                { icon: Coins,        bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
  "Field Observation":      { icon: BookOpen,     bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200" },
  "Shopping List":          { icon: FileSpreadsheet, bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
  "Calendar Created":       { icon: Calendar,     bg: "bg-purple-50",  text: "text-purple-700",  border: "border-purple-200" },
  "Note":                   { icon: FileText,     bg: "bg-slate-100",  text: "text-slate-700",   border: "border-slate-200" },
  "Other":                  { icon: HelpCircle,   bg: "bg-slate-100",  text: "text-slate-600",   border: "border-slate-200" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG["Other"];
}

export default function TimelinePage() {
  const router = useRouter();
  const { showToast } = useToastStore();

  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterCrop, setFilterCrop] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Compose Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newType, setNewType] = useState("Field Observation");
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCrop, setNewCrop] = useState("");
  const [newFieldName, setNewFieldName] = useState("");
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchActivities = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/v1/activity/", {
        params: {
          activity_type: filterType || undefined,
          crop: filterCrop || undefined,
          source: filterSource || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      });
      setActivities(res.data);
    } catch {
      showToast("Failed to fetch activity logs", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await api.get("/api/v1/activity/stats/summary");
      setStats(res.data);
    } catch {
      // Ignore stats failures silently
    }
  };

  useEffect(() => {
    fetchActivities();
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterCrop, filterSource, dateFrom, dateTo]);

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      showToast("Please enter a title", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/api/v1/activity/", {
        activity_type: newType,
        title: newTitle,
        description: newDescription,
        crop: newCrop || undefined,
        field_name: newFieldName || undefined,
        activity_date: newDate,
      });
      showToast("Activity logged successfully", "success");
      setIsModalOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewCrop("");
      setNewFieldName("");
      setNewDate(new Date().toISOString().split("T")[0]);
      fetchActivities();
      fetchStats();
    } catch {
      showToast("Failed to save activity log", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteActivity = async (id: number) => {
    if (!confirm("Are you sure you want to delete this activity log?")) return;
    try {
      await api.delete(`/api/v1/activity/${id}`);
      showToast("Activity deleted", "success");
      setActivities(prev => prev.filter(a => a.id !== id));
      fetchStats();
    } catch {
      showToast("Failed to delete activity", "error");
    }
  };

  const clearFilters = () => {
    setFilterType("");
    setFilterCrop("");
    setFilterSource("");
    setDateFrom("");
    setDateTo("");
  };

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
              <div className="bg-rose-50 text-rose-600 p-2 rounded-xl border border-rose-100">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <span className="font-display font-bold text-slate-900 text-base">Activity Timeline</span>
                <p className="text-xs text-slate-500">Digital Farming Diary & Log</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Activity
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Filters & Stats Sidebar */}
          <div className="space-y-6">
            <div className="clean-card p-6 space-y-4 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <Filter className="h-3.5 w-3.5 text-emerald-600" /> Filters
                </span>
                {(filterType || filterCrop || filterSource || dateFrom || dateTo) && (
                  <button onClick={clearFilters} className="text-[10px] font-bold text-emerald-700 hover:underline">
                    Clear
                  </button>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Activity Type</label>
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                  >
                    <option value="">All Types</option>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Crop</label>
                  <select
                    value={filterCrop}
                    onChange={e => setFilterCrop(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                  >
                    <option value="">All Crops</option>
                    {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Source</label>
                  <select
                    value={filterSource}
                    onChange={e => setFilterSource(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                  >
                    <option value="">All Sources</option>
                    <option value="auto">System Logs (Auto)</option>
                    <option value="manual">Manual Entries</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Date Range</label>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick summary stats */}
            <div className="clean-card p-6 bg-white shadow-sm">
              <div className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-3 mb-3 flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-emerald-600" /> Summary Breakdown
              </div>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {Object.entries(stats).length === 0 ? (
                  <div className="text-center py-3 text-xs text-slate-400">No logs found.</div>
                ) : (
                  Object.entries(stats).map(([type, count]) => {
                    const cfg = getTypeConfig(type);
                    return (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.bg} border ${cfg.border}`} />
                          <span className="text-slate-600 truncate">{type}</span>
                        </div>
                        <span className="font-bold text-slate-900">{count}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Timeline Feed */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin" />
                <span className="text-xs font-semibold">Loading timeline...</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="clean-card p-12 text-center bg-white shadow-sm">
                <BookOpen className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 text-sm mb-1">Your Diary is Empty</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto leading-relaxed">
                  Log your activities like seed purchases, irrigations, and fertilizer applications, or let the AI auto-log your scans and advisor chats.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 md:pl-8 border-l border-slate-200 space-y-4">
                {activities.map((act) => {
                  const cfg = getTypeConfig(act.activity_type);
                  const Icon = cfg.icon;
                  const dateObj = new Date(act.activity_date + "T00:00:00");
                  const formattedDate = dateObj.toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  });

                  return (
                    <div key={act.id} className="relative group">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[37px] md:-left-[45px] top-1.5 h-7 w-7 rounded-full border-2 border-white flex items-center justify-center ${cfg.bg} ${cfg.border} shadow-sm`}>
                        <Icon className={`h-3 w-3 ${cfg.text}`} />
                      </div>

                      {/* Log Card */}
                      <div className="clean-card p-5 space-y-2 bg-white shadow-sm hover:border-slate-300 transition-all">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                                {act.activity_type}
                              </span>
                              {act.crop && (
                                <span className="text-[10px] uppercase font-bold tracking-wider bg-slate-100 border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                                  {act.crop}
                                </span>
                              )}
                              {act.source === "auto" && (
                                <span className="text-[9px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/60 px-1.5 py-0.5 rounded">
                                  Auto
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-slate-900 text-sm leading-snug">{act.title}</h3>
                          </div>
                          <button
                            onClick={() => handleDeleteActivity(act.id)}
                            className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {act.description && (
                          <p className="text-xs text-slate-600 leading-relaxed max-w-3xl whitespace-pre-line">{act.description}</p>
                        )}

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium pt-2 border-t border-slate-100">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formattedDate}
                          </span>
                          {act.field_name && (
                            <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-slate-600">
                              Field: {act.field_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Manual Compose Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="clean-card bg-white rounded-2xl w-full max-w-lg overflow-hidden relative shadow-2xl">
            
            {/* Header */}
            <div className="border-b border-slate-100 p-5 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Log Farm Activity</h3>
                <p className="text-xs text-slate-500">Record an entry in your digital farm diary.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateActivity}>
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Activity Type</label>
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Date</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Title / Subject</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Sowed PR-126 Basmati Seeds"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Details / Description</label>
                  <textarea
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Describe inputs used, quantities, labor hours, observations, etc."
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Crop (optional)</label>
                    <select
                      value={newCrop}
                      onChange={e => setNewCrop(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      <option value="">None</option>
                      {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Field Name (optional)</label>
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={e => setNewFieldName(e.target.value)}
                      placeholder="e.g. North Plot"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    />
                  </div>
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
                  {isSubmitting ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Saving...</> : "Save Log Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
