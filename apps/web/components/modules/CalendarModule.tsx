"use client";

import React, { useState, useEffect, useMemo } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, Sprout, Droplets, FlaskConical,
  Bug, Wheat, Leaf,
  Plus, RefreshCw, List, LayoutGrid, Check,
  X
} from "lucide-react";

interface CalendarEvent {
  id: number;
  event_type: string;
  title: string;
  description: string;
  scheduled_date: string;
  das: number;
  is_completed: boolean;
  notes: string;
}

interface CropCalendar {
  id: number;
  name: string;
  crop: string;
  variety: string;
  location: string;
  sow_date: string;
  events: CalendarEvent[];
}

interface CalendarModuleProps {
  onBack?: () => void;
}

const CROPS = ["Wheat", "Rice", "Cotton", "Tomato", "Potato", "Sugarcane", "Mustard", "Corn"];

export default function CalendarModule({ onBack }: CalendarModuleProps) {
  const { showToast } = useToastStore();
  const [calendars, setCalendars] = useState<CropCalendar[]>([]);
  const [activeCal, setActiveCal] = useState<CropCalendar | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // New Calendar Form
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [crop, setCrop] = useState("Wheat");
  const [sowDate, setSowDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [location, setLocation] = useState("Punjab");
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchCalendars = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/v1/calendar/");
      setCalendars(res.data);
      if (res.data.length > 0 && !activeCal) {
        setActiveCal(res.data[0]);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendars();
  }, []);

  const handleCreateCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await api.post("/api/v1/calendar/generate", {
        crop,
        sow_date: sowDate,
        location,
        variety: "Hybrid Vigor",
      });
      showToast("Phenological sowing schedule generated!", "success");
      setActiveCal(res.data);
      setShowCreateModal(false);
      fetchCalendars();
    } catch {
      showToast("Failed to generate sowing schedule", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleEvent = async (eventId: number) => {
    if (!activeCal) return;
    try {
      await api.patch(`/api/v1/calendar/events/${eventId}/toggle`);
      setActiveCal((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          events: prev.events.map((ev) => (ev.id === eventId ? { ...ev, is_completed: !ev.is_completed } : ev)),
        };
      });
    } catch {
      showToast("Failed to update milestone", "error");
    }
  };

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
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              Crop Calendar & Sowing Schedule
            </h1>
            <p className="text-xs text-slate-500">Phenological growth milestone planner from seed treatment to harvest window</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>New Sowing Plan</span>
        </button>
      </div>

      {activeCal ? (
        <div className="space-y-6">
          {/* Calendar Header Card */}
          <div className="clean-card p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200 uppercase">
                  {activeCal.crop}
                </span>
                <span className="text-xs text-slate-500 font-medium">Sown: {activeCal.sow_date}</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">{activeCal.name || `${activeCal.crop} Season Plan`}</h2>
            </div>

            <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg text-xs font-semibold ${viewMode === "list" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg text-xs font-semibold ${viewMode === "grid" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Events Stream */}
          <div className="clean-card p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phenological Growth Milestones</h3>

            <div className="space-y-3">
              {activeCal.events.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => handleToggleEvent(ev.id)}
                  className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-4 cursor-pointer ${
                    ev.is_completed
                      ? "bg-slate-50/60 border-slate-200 opacity-80"
                      : "bg-white hover:bg-slate-50 border-slate-200 shadow-sm"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <button className="mt-0.5 text-slate-400 hover:text-emerald-600">
                      {ev.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Circle className="h-5 w-5 text-slate-300" />
                      )}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold ${ev.is_completed ? "line-through text-slate-500" : "text-slate-900"}`}>
                          {ev.title}
                        </span>
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          {ev.event_type}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ev.description}</p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-xs font-bold text-slate-800 block">{ev.scheduled_date}</span>
                    <span className="text-[11px] text-slate-400 font-semibold block">DAS: Day +{ev.das}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="clean-card p-16 text-center text-slate-400 space-y-3">
          <CalendarDays className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700">No active sowing calendar</h3>
          <p className="text-xs text-slate-400">Generate a custom crop calendar based on your regional sowing date.</p>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="border-b border-slate-100 p-6 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Sowing Schedule</h3>
                <p className="text-xs text-slate-500 mt-0.5">Generate daily milestone tasks tailored to your crop.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCalendar}>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Crop Selection</label>
                  <select
                    value={crop}
                    onChange={(e) => setCrop(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                  >
                    {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Sowing Date</label>
                  <input
                    type="date"
                    required
                    value={sowDate}
                    onChange={(e) => setSowDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Region / State</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Punjab"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 p-5 bg-slate-50/50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5"
                >
                  {isGenerating ? "Building Schedule..." : "Generate Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
