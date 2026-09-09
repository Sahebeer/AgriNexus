"use client";

import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
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
  X
} from "lucide-react";

interface ActivityLog {
  id: number;
  activity_type: string;
  source: string;
  title: string;
  description: string;
  crop: string;
  field_name: string;
  activity_date: string;
  created_at: string;
}

interface TimelineModuleProps {
  onBack?: () => void;
}

const ACTIVITY_TYPES = [
  "All",
  "Fertilizer Application",
  "Irrigation",
  "Pesticide / Spray",
  "Disease Scan",
  "Harvest",
  "Expense",
  "Note"
];

export default function TimelineModule({ onBack }: TimelineModuleProps) {
  const { showToast } = useToastStore();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState("All");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form fields
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState("Fertilizer Application");
  const [crop, setCrop] = useState("Wheat");
  const [fieldName, setFieldName] = useState("Field A");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/v1/activities/");
      setLogs(res.data);
    } catch {
      // Demo fallback logs
      setLogs([
        {
          id: 1,
          activity_type: "Irrigation",
          source: "manual",
          title: "Drip Irrigation Cycle",
          description: "Applied 2.5 hours of drip irrigation to Canal Bed parcel.",
          crop: "Wheat",
          field_name: "West Canal Bed",
          activity_date: new Date().toISOString().split("T")[0],
          created_at: new Date().toISOString()
        },
        {
          id: 2,
          activity_type: "Fertilizer Application",
          source: "manual",
          title: "Urea Top Dressing",
          description: "Applied 45 kg/ha Nitrogen top-dressing at early tillering stage.",
          crop: "Wheat",
          field_name: "North Orchard",
          activity_date: new Date(Date.now() - 86400000 * 2).toISOString().split("T")[0],
          created_at: new Date(Date.now() - 86400000 * 2).toISOString()
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setIsSubmitting(true);
    try {
      await api.post("/api/v1/activities/", {
        activity_type: activityType,
        title,
        description,
        crop,
        field_name: fieldName,
        activity_date: date,
      });
      showToast("Activity event logged to diary", "success");
      setShowAddModal(false);
      setTitle("");
      setDescription("");
      fetchLogs();
    } catch {
      showToast("Failed to log activity", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/api/v1/activities/${id}`);
      showToast("Activity deleted", "info");
      fetchLogs();
    } catch {
      showToast("Failed to delete activity", "error");
    }
  };

  const filtered = logs.filter((l) => {
    if (selectedType === "All") return true;
    return l.activity_type.toLowerCase() === selectedType.toLowerCase();
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
              <FileText className="h-5 w-5 text-blue-600" />
              Farmer Timeline & Digital Diary
            </h1>
            <p className="text-xs text-slate-500">Chronological field operations log for irrigation, spray schedules and agronomic notes</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Log Field Event</span>
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {ACTIVITY_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              selectedType === type
                ? "bg-blue-50 border-blue-300 text-blue-900 shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      {isLoading ? (
        <div className="flex justify-center py-24"><RefreshCw className="h-8 w-8 animate-spin text-emerald-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="clean-card p-16 text-center text-slate-400 space-y-3">
          <BookOpen className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700">No events found in timeline</h3>
          <p className="text-xs text-slate-400">Click &quot;Log Field Event&quot; to register your first agronomic diary entry.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((log) => (
            <div key={log.id} className="clean-card p-5 flex items-start justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 flex-shrink-0 mt-0.5">
                  <Activity className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{log.title}</span>
                    <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      {log.activity_type}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{log.description}</p>
                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1 font-medium">
                    <span>Field: <strong className="text-slate-700">{log.field_name}</strong></span>
                    <span>•</span>
                    <span>Crop: <strong className="text-slate-700">{log.crop}</strong></span>
                    <span>•</span>
                    <span>Date: {log.activity_date}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => handleDelete(log.id)}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition-colors"
                title="Delete Entry"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="border-b border-slate-100 p-6 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">Log Operational Activity</h3>
                <p className="text-xs text-slate-500 mt-0.5">Record farm maintenance, irrigation or spray events.</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateActivity}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Activity Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Applied Pre-Emergence Herbicide"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Activity Type</label>
                    <select
                      value={activityType}
                      onChange={(e) => setActivityType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors font-semibold"
                    >
                      {ACTIVITY_TYPES.filter(t => t !== "All").map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Date</label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Field / Landholding</label>
                    <input
                      type="text"
                      value={fieldName}
                      onChange={(e) => setFieldName(e.target.value)}
                      placeholder="e.g. North Plot"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Crop</label>
                    <input
                      type="text"
                      value={crop}
                      onChange={(e) => setCrop(e.target.value)}
                      placeholder="e.g. Wheat"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Notes & Observations</label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter operational notes or dosage quantities..."
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none transition-colors resize-none"
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
                  {isSubmitting ? "Saving..." : "Commit Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
