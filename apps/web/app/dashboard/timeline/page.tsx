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
  CheckCircle,
  HelpCircle,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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
  "Disease Scan":           { icon: ShieldAlert,  bg: "bg-red-500/10",    text: "text-red-400",    border: "border-red-500/20" },
  "AI Chat":                { icon: Bot,          bg: "bg-primary/10",    text: "text-primary",    border: "border-primary/20" },
  "Fertilizer Application": { icon: FlaskConical, bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/20" },
  "Irrigation":             { icon: Droplets,     bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/20" },
  "Pesticide / Spray":      { icon: Bug,          bg: "bg-rose-500/10",   text: "text-rose-400",   border: "border-rose-500/20" },
  "Harvest":                { icon: Sprout,       bg: "bg-emerald-500/10",text: "text-emerald-400",border: "border-emerald-500/20" },
  "Purchase":               { icon: Coins,        bg: "bg-teal-500/10",   text: "text-teal-400",   border: "border-teal-500/20" },
  "Expense":                { icon: Coins,        bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20" },
  "Field Observation":      { icon: BookOpen,     bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/20" },
  "Shopping List":          { icon: FileSpreadsheet, bg: "bg-indigo-500/10", text: "text-indigo-400", border: "border-indigo-500/20" },
  "Calendar Created":       { icon: Calendar,     bg: "bg-purple-500/10", text: "text-purple-400", border: "border-purple-500/20" },
  "Note":                   { icon: FileText,     bg: "bg-neutral-800",   text: "text-neutral-300",border: "border-neutral-700" },
  "Other":                  { icon: HelpCircle,   bg: "bg-neutral-800",   text: "text-neutral-400",border: "border-neutral-700" },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? TYPE_CONFIG["Other"];
}

// ─── Component ────────────────────────────────────────────────────────────────

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
      // Reset form
      setNewTitle("");
      setNewDescription("");
      setNewCrop("");
      setNewFieldName("");
      setNewDate(new Date().toISOString().split("T")[0]);
      // Refresh list
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
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-display font-bold text-white text-lg">Activity Timeline</span>
                <p className="text-[10px] text-neutral-500 -mt-0.5 font-semibold uppercase tracking-wider">Digital Farming Diary & Audit Log</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-primary hover:bg-primary-600 text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(0,200,117,0.15)]"
          >
            <Plus className="h-4 w-4" />
            Log Activity
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Filters & Stats Sidebar */}
          <div className="space-y-6">
            {/* Filters panel */}
            <div className="glass border border-neutral-800 rounded-3xl p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
                <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-primary" /> Filters
                </span>
                {(filterType || filterCrop || filterSource || dateFrom || dateTo) && (
                  <button onClick={clearFilters} className="text-[10px] font-bold text-primary hover:underline">
                    Clear All
                  </button>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Activity Type</label>
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary transition-colors"
                  >
                    <option value="">All Types</option>
                    {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Crop Context</label>
                  <select
                    value={filterCrop}
                    onChange={e => setFilterCrop(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary transition-colors"
                  >
                    <option value="">All Crops</option>
                    {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Source</label>
                  <select
                    value={filterSource}
                    onChange={e => setFilterSource(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary transition-colors"
                  >
                    <option value="">All Sources</option>
                    <option value="auto">System Logs (Auto)</option>
                    <option value="manual">User Entries (Manual)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Date Range</label>
                  <div className="space-y-2">
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-[11px] text-white outline-none focus:border-primary transition-colors"
                    />
                    <input
                      type="date"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-[11px] text-white outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick summary stats */}
            <div className="glass border border-neutral-800 rounded-3xl p-6">
              <div className="text-xs font-bold text-neutral-300 border-b border-neutral-900 pb-3 mb-4 flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Log Summary
              </div>
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {Object.entries(stats).length === 0 ? (
                  <div className="text-center py-4 text-xs text-neutral-600">No logs found.</div>
                ) : (
                  Object.entries(stats).map(([type, count]) => {
                    const cfg = getTypeConfig(type);
                    return (
                      <div key={type} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${cfg.text} ${cfg.bg}`} />
                          <span className="text-neutral-400 truncate">{type}</span>
                        </div>
                        <span className="font-bold text-neutral-300">{count}</span>
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
              <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
                <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                <span className="text-xs font-semibold">Loading timeline...</span>
              </div>
            ) : activities.length === 0 ? (
              <div className="glass border border-neutral-800 rounded-3xl p-16 text-center">
                <BookOpen className="h-10 w-10 text-neutral-700 mx-auto mb-4" />
                <h3 className="font-bold text-neutral-300 mb-2">Your Diary is Empty</h3>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                  Log your activities like seed purchases, irrigations, and fertilizer applications, or let the AI auto-log your scans and advisor chats.
                </p>
              </div>
            ) : (
              <div className="relative pl-6 md:pl-8 border-l border-neutral-900 space-y-6">
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
                    <div key={act.id} className="relative group animate-fade-in">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[38px] md:-left-[46px] top-1 h-8 w-8 rounded-full border-2 border-neutral-950 flex items-center justify-center ${cfg.bg} ${cfg.border}`}>
                        <Icon className={`h-3.5 w-3.5 ${cfg.text}`} />
                      </div>

                      {/* Log Card */}
                      <div className="glass border border-neutral-800 group-hover:border-neutral-750 transition-all rounded-2xl p-5 space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                                {act.activity_type}
                              </span>
                              {act.crop && (
                                <span className="text-[9px] uppercase font-bold tracking-wider bg-neutral-900 border border-neutral-850 px-2 py-0.5 rounded text-neutral-400">
                                  {act.crop}
                                </span>
                              )}
                              {act.source === "auto" && (
                                <span className="text-[8px] uppercase font-bold tracking-wider bg-primary/5 text-primary/75 px-1.5 py-0.5 rounded">
                                  Auto
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-white text-sm md:text-base leading-snug">{act.title}</h3>
                          </div>
                          <button
                            onClick={() => handleDeleteActivity(act.id)}
                            className="text-neutral-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-neutral-900 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                            title="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>

                        {act.description && (
                          <p className="text-xs text-neutral-400 leading-relaxed max-w-3xl whitespace-pre-line">{act.description}</p>
                        )}

                        <div className="flex items-center gap-4 text-[10px] text-neutral-500 font-semibold pt-2 border-t border-neutral-900">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" /> {formattedDate}
                          </span>
                          {act.field_name && (
                            <span className="bg-neutral-900 px-2 py-0.5 rounded border border-neutral-850">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="glass border border-neutral-800 rounded-3xl w-full max-w-lg overflow-hidden relative animate-slide-up">
            
            {/* Header */}
            <div className="border-b border-neutral-800 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Log Farm Activity</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Write a manual entry in your farming diary.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateActivity}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Activity Type</label>
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors"
                    >
                      {ACTIVITY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Date</label>
                    <input
                      type="date"
                      value={newDate}
                      onChange={e => setNewDate(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Title / Subject</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    placeholder="e.g. Sowed PR-126 Basmati Seeds"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Details / Description</label>
                  <textarea
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="Describe inputs used, quantities, labor hours, observations, etc."
                    rows={4}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Crop Context (optional)</label>
                    <select
                      value={newCrop}
                      onChange={e => setNewCrop(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors"
                    >
                      <option value="">None</option>
                      {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Field / Node Name (optional)</label>
                    <input
                      type="text"
                      value={newFieldName}
                      onChange={e => setNewFieldName(e.target.value)}
                      placeholder="e.g. Field North 2"
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
                  {isSubmitting ? <><RefreshCw className="h-4 w-4 animate-spin" />Saving...</> : "Save Log Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
