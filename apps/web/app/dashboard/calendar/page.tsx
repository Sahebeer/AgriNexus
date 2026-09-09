"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, Sprout, Droplets, FlaskConical,
  Bug, ShieldAlert, Scissors, Wheat, Package, Leaf,
  Plus, RefreshCw, List, LayoutGrid, ArrowRight, Check,
  MapPin, Clock, X,
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

interface CalendarSummary {
  id: number;
  name: string;
  crop: string;
  sow_date: string;
  location: string;
}

const CROPS = [
  "Rice","Wheat","Cotton","Tomato","Potato","Sugarcane","Mustard","Corn",
  "Soybean","Chickpeas (Gram)","Groundnut","Onion","Apple","Mango","Banana",
  "Orange","Grapes","Lentils (Masoor)","Pigeon Peas (Tur)","Mung Beans","Garlic","Ginger",
];

const STATES = [
  "Punjab","Haryana","Uttar Pradesh","Madhya Pradesh","Rajasthan","Maharashtra",
  "Karnataka","Tamil Nadu","Gujarat","Bihar","West Bengal","Andhra Pradesh",
  "Telangana","Odisha","Himachal Pradesh","Uttarakhand","Jharkhand","Chhattisgarh",
];

const EVENT_TYPE_STYLE: Record<string, { icon: React.FC<any>; bg: string; text: string; dot: string }> = {
  "Land Preparation": { icon: Leaf,       bg: "bg-slate-100 border-slate-200", text: "text-slate-700",  dot: "bg-slate-400"  },
  "Nursery":          { icon: Sprout,     bg: "bg-lime-50   border-lime-200",  text: "text-lime-800",   dot: "bg-lime-500"   },
  "Sowing":           { icon: Sprout,     bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", dot: "bg-emerald-600" },
  "Thinning":         { icon: Scissors,   bg: "bg-teal-50   border-teal-200",  text: "text-teal-800",   dot: "bg-teal-600"},
  "Irrigation":       { icon: Droplets,   bg: "bg-sky-50    border-sky-200",   text: "text-sky-800",    dot: "bg-sky-600"   },
  "Fertilizer":       { icon: FlaskConical,bg:"bg-amber-50  border-amber-200", text: "text-amber-800",  dot: "bg-amber-600"  },
  "Weeding":          { icon: Scissors,   bg: "bg-yellow-50 border-yellow-200", text: "text-yellow-800", dot: "bg-yellow-600" },
  "Pest Monitoring":  { icon: Bug,        bg: "bg-orange-50 border-orange-200", text: "text-orange-800", dot: "bg-orange-600" },
  "Disease Monitoring":{ icon: ShieldAlert,bg:"bg-rose-50   border-rose-200",   text: "text-rose-800",   dot: "bg-rose-600"   },
  "Spray":            { icon: Package,    bg: "bg-rose-50   border-rose-200",   text: "text-rose-800",   dot: "bg-rose-600"   },
  "Harvest":          { icon: Wheat,      bg: "bg-emerald-100 border-emerald-300", text: "text-emerald-900", dot: "bg-emerald-700" },
  "Post-Harvest":     { icon: Package,    bg: "bg-purple-50 border-purple-200", text: "text-purple-800", dot: "bg-purple-600" },
};

function getStyle(type: string) {
  return EVENT_TYPE_STYLE[type] ?? { icon: Circle, bg: "bg-slate-100 border-slate-200", text: "text-slate-700", dot: "bg-slate-400" };
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function CalendarPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [view, setView] = useState<"setup" | "calendar" | "timeline" | "list">("setup");
  const [displayMode, setDisplayMode] = useState<"calendar" | "timeline">("calendar");

  const [wizardStep, setWizardStep] = useState(0);
  const [crop, setCrop] = useState("");
  const [sowDate, setSowDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [variety, setVariety] = useState("");
  const [location, setLocation] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [activeCalendar, setActiveCalendar] = useState<CropCalendar | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [history, setHistory] = useState<CalendarSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const handleCreate = async () => {
    if (!crop) { showToast("Select a crop", "error"); return; }
    if (!sowDate) { showToast("Select sowing date", "error"); return; }
    setIsCreating(true);
    try {
      const res = await api.post("/api/v1/calendar/generate", {
        crop,
        sow_date: sowDate,
        variety: variety || undefined,
        location: location || undefined,
      });
      setActiveCalendar(res.data);
      setCalMonth(new Date(sowDate + "T00:00:00"));
      setView("calendar");
      showToast("Crop calendar generated!", "success");
    } catch {
      showToast("Failed to generate calendar", "error");
    } finally {
      setIsCreating(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get("/api/v1/calendar/history");
      setHistory(res.data);
    } catch {
      showToast("Failed to load calendars", "error");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadCalendar = async (id: number) => {
    try {
      const res = await api.get(`/api/v1/calendar/${id}`);
      setActiveCalendar(res.data);
      setCalMonth(new Date(res.data.sow_date + "T00:00:00"));
      setView("calendar");
    } catch {
      showToast("Failed to load calendar", "error");
    }
  };

  const toggleEvent = async (ev: CalendarEvent) => {
    if (!activeCalendar) return;
    try {
      await api.patch(`/api/v1/calendar/${activeCalendar.id}/events/${ev.id}`, {
        is_completed: !ev.is_completed,
      });
      setActiveCalendar(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          events: prev.events.map(e => e.id === ev.id ? { ...e, is_completed: !e.is_completed } : e)
        };
      });
    } catch {
      showToast("Update failed", "error");
    }
  };

  const eventsByDate = useMemo(() => {
    if (!activeCalendar) return {};
    const map: Record<string, CalendarEvent[]> = {};
    activeCalendar.events.forEach(e => {
      (map[e.scheduled_date] = map[e.scheduled_date] ?? []).push(e);
    });
    return map;
  }, [activeCalendar]);

  const calendarDays = useMemo(() => {
    const year = calMonth.getFullYear();
    const month = calMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days: (string | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
    }
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [calMonth]);

  const today = new Date().toISOString().split("T")[0];
  const completedCount = activeCalendar?.events.filter(e => e.is_completed).length ?? 0;
  const totalCount = activeCalendar?.events.length ?? 0;
  const upcomingEvents = activeCalendar?.events
    .filter(e => !e.is_completed && e.scheduled_date >= today)
    .slice(0, 3) ?? [];

  const selectedDateEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];
  const wizardSteps = ["Select Crop", "Sowing Date & Location"];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => view !== "setup" ? setView("setup") : router.push("/dashboard")}
              className="text-slate-500 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl border border-indigo-100">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <span className="font-display font-bold text-slate-900 text-base">Crop Calendar</span>
                <p className="text-xs text-slate-500">Personalized Farming Schedule</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {view === "calendar" && (
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-xl p-1 gap-1">
                <button onClick={() => setDisplayMode("calendar")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${displayMode === "calendar" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                  <LayoutGrid className="h-3.5 w-3.5" /> Calendar
                </button>
                <button onClick={() => setDisplayMode("timeline")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${displayMode === "timeline" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}>
                  <List className="h-3.5 w-3.5" /> Timeline
                </button>
              </div>
            )}
            <button onClick={() => { loadHistory(); setView("list"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-sm">
              <CalendarDays className="h-3.5 w-3.5" /> My Calendars
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full">

        {/* ─── SETUP WIZARD ─────────────────────────────────────────────── */}
        {view === "setup" && (
          <div className="max-w-2xl mx-auto">
            {/* Step pills */}
            <div className="flex items-center justify-center gap-0 mb-8">
              {wizardSteps.map((s, i) => {
                const done = wizardStep > i; const active = wizardStep === i;
                return (
                  <React.Fragment key={i}>
                    <button onClick={() => i <= wizardStep && setWizardStep(i)}
                      className="flex flex-col items-center gap-1">
                      <div className={`h-9 w-9 rounded-full border flex items-center justify-center transition-all ${done ? "bg-emerald-600 border-emerald-600 text-white" : active ? "bg-emerald-50 border-emerald-600 text-emerald-700 font-bold" : "bg-white border-slate-200 text-slate-400"}`}>
                        {done ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${active || done ? "text-slate-800" : "text-slate-400"}`}>{s}</span>
                    </button>
                    {i < wizardSteps.length - 1 && (
                      <div className={`h-0.5 w-20 mx-3 mb-4 rounded-full ${wizardStep > i ? "bg-emerald-600" : "bg-slate-200"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="clean-card p-8 bg-white shadow-sm">
              {wizardStep === 0 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 mb-1">Select Crop</h2>
                    <p className="text-xs text-slate-500">We will generate a phenology-aligned schedule from land prep to harvest.</p>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                    {CROPS.map(c => (
                      <button key={c} onClick={() => setCrop(c)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${crop === c ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => crop ? setWizardStep(1) : showToast("Select a crop", "error")}
                    disabled={!crop}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all shadow-sm">
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 mb-1">Sowing Date & Location</h2>
                    <p className="text-xs text-slate-500">All activities are scheduled relative to your planned sow date.</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Sowing Date</label>
                      <input type="date" value={sowDate}
                        onChange={e => setSowDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Variety (optional)</label>
                      <input type="text" value={variety}
                        onChange={e => setVariety(e.target.value)}
                        placeholder="e.g. PR-126, HD-3086, Pusa Basmati..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">State / Location</label>
                      <select value={location} onChange={e => setLocation(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors">
                        <option value="">Select state (optional)</option>
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-2">Calendar Summary</div>
                    {[["Crop", crop], ["Sowing Date", new Date(sowDate + "T00:00:00").toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })], ["Variety", variety || "—"], ["Location", location || "—"]].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs"><span className="text-slate-500">{k}</span><span className="text-slate-900 font-semibold">{v}</span></div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setWizardStep(0)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all">Back</button>
                    <button onClick={handleCreate} disabled={isCreating}
                      className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs transition-all shadow-sm">
                      {isCreating ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Generating...</> : <><CalendarDays className="h-3.5 w-3.5" />Generate Schedule</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── CALENDAR / TIMELINE VIEW ─────────────────────────────────── */}
        {view === "calendar" && activeCalendar && (
          <div className="space-y-6">
            {/* Calendar header stats */}
            <div className="clean-card p-6 bg-white shadow-sm">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {activeCalendar.location && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full">
                        <MapPin className="h-3 w-3" />{activeCalendar.location}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      Sown: {new Date(activeCalendar.sow_date + "T00:00:00").toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-slate-900">{activeCalendar.name}</h1>
                  {activeCalendar.variety && <p className="text-slate-500 text-xs mt-0.5">Variety: {activeCalendar.variety}</p>}
                </div>
                <div className="flex gap-3">
                  <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-200 min-w-[70px]">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Total</div>
                    <div className="text-lg font-bold text-slate-900">{totalCount}</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-emerald-50 border border-emerald-200 min-w-[70px]">
                    <div className="text-[10px] text-emerald-800 uppercase tracking-wider font-bold mb-0.5">Done</div>
                    <div className="text-lg font-bold text-emerald-800">{completedCount}</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-200 min-w-[70px]">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Left</div>
                    <div className="text-lg font-bold text-emerald-700">{totalCount - completedCount}</div>
                  </div>
                </div>
              </div>
              {/* Progress */}
              <div className="mt-4 pt-3 border-t border-slate-100">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                    style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%" }} />
                </div>
              </div>
            </div>

            {/* ─── CALENDAR GRID MODE ───────────────────────────────────── */}
            {displayMode === "calendar" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main grid */}
                <div className="lg:col-span-2 clean-card p-6 bg-white shadow-sm">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <h3 className="font-display font-bold text-slate-900 text-base">
                      {MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
                    </h3>
                    <button onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {DAYS.map(d => (
                      <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1">{d}</div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-1">
                    {calendarDays.map((dateStr, i) => {
                      if (!dateStr) return <div key={`empty-${i}`} className="aspect-square" />;
                      const evs = eventsByDate[dateStr] ?? [];
                      const isToday = dateStr === today;
                      const isSow = dateStr === activeCalendar.sow_date;
                      const isSelected = dateStr === selectedDate;
                      const hasEvent = evs.length > 0;
                      const allDone = hasEvent && evs.every(e => e.is_completed);

                      return (
                        <button key={dateStr}
                          onClick={() => { setSelectedDate(dateStr === selectedDate ? null : dateStr); }}
                          className={`aspect-square flex flex-col items-center justify-start pt-1.5 rounded-xl text-xs transition-all relative ${
                            isSelected ? "bg-emerald-100 border border-emerald-400 font-bold" :
                            isSow ? "bg-emerald-50 border border-emerald-300 font-bold text-emerald-800" :
                            isToday ? "bg-slate-100 border border-slate-300 font-bold text-slate-900" :
                            hasEvent ? "bg-slate-50 hover:bg-slate-100 border border-slate-200" :
                            "hover:bg-slate-50 border border-transparent"
                          }`}>
                          <span className={`text-[11px] ${
                            isSelected ? "text-emerald-900" :
                            isSow ? "text-emerald-800" :
                            isToday ? "text-slate-900" :
                            "text-slate-600"
                          }`}>{parseInt(dateStr.split("-")[2])}</span>
                          {isSow && <div className="text-[7px] text-emerald-700 font-bold leading-none mt-0.5">SOW</div>}
                          {hasEvent && (
                            <div className="flex flex-wrap gap-0.5 justify-center mt-1 px-0.5">
                              {evs.slice(0, 3).map((ev, ei) => {
                                const style = getStyle(ev.event_type);
                                return (
                                  <div key={ei}
                                    className={`h-1.5 w-1.5 rounded-full ${allDone ? "opacity-30" : ""} ${style.dot}`} />
                                );
                              })}
                              {evs.length > 3 && <div className="text-[6px] text-slate-400 font-bold">+{evs.length - 3}</div>}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right panel — selected day / upcoming */}
                <div className="space-y-4">
                  {selectedDate && selectedDateEvents.length > 0 ? (
                    <div className="clean-card p-5 bg-white shadow-sm">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selected Date</div>
                          <div className="font-display font-bold text-slate-900 text-sm">
                            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
                          </div>
                        </div>
                        <button onClick={() => setSelectedDate(null)} className="text-slate-400 hover:text-slate-700">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-2.5">
                        {selectedDateEvents.map(ev => {
                          const { icon: Icon, bg, text } = getStyle(ev.event_type);
                          return (
                            <div key={ev.id} className={`p-3 rounded-xl border ${bg} flex items-start gap-2.5`}>
                              <Icon className={`h-4 w-4 ${text} flex-shrink-0 mt-0.5`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className={`text-xs font-bold ${text} ${ev.is_completed ? "line-through opacity-60" : ""}`}>{ev.title}</div>
                                  <button onClick={() => toggleEvent(ev)} className="flex-shrink-0 mt-0.5">
                                    {ev.is_completed
                                      ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                      : <Circle className="h-4 w-4 text-slate-400 hover:text-emerald-600 transition-colors" />}
                                  </button>
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{ev.description}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="clean-card p-5 bg-white shadow-sm">
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Next Scheduled Tasks</div>
                      {upcomingEvents.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 text-xs">All scheduled tasks completed!</div>
                      ) : (
                        <div className="space-y-2.5">
                          {upcomingEvents.map(ev => {
                            const { icon: Icon, bg, text } = getStyle(ev.event_type);
                            const daysLeft = Math.ceil((new Date(ev.scheduled_date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
                            return (
                              <div key={ev.id} className={`p-3 rounded-xl border ${bg}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  <Icon className={`h-3.5 w-3.5 ${text}`} />
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>{ev.event_type}</span>
                                  <span className="ml-auto text-[10px] text-slate-500 font-semibold">
                                    {daysLeft === 0 ? "Today" : daysLeft === 1 ? "Tomorrow" : `in ${daysLeft} days`}
                                  </span>
                                </div>
                                <div className={`text-xs font-semibold ${text}`}>{ev.title}</div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Legend */}
                  <div className="clean-card p-5 bg-white shadow-sm">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Activity Legend</div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(EVENT_TYPE_STYLE).map(([type, style]) => {
                        return (
                          <div key={type} className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${style.dot}`} />
                            <span className="text-[11px] text-slate-600 truncate">{type}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ─── TIMELINE MODE ────────────────────────────────────────── */}
            {displayMode === "timeline" && (
              <div className="space-y-2">
                {activeCalendar.events.map((ev, i) => {
                  const { icon: Icon, bg, text, dot } = getStyle(ev.event_type);
                  const evDate = new Date(ev.scheduled_date + "T00:00:00");
                  const isPast = ev.scheduled_date < today;
                  const isToday = ev.scheduled_date === today;

                  return (
                    <div key={ev.id} className={`flex gap-4 group ${ev.is_completed ? "opacity-60" : ""}`}>
                      <div className="w-20 flex-shrink-0 text-right pt-3.5">
                        <div className={`text-[10px] font-bold uppercase ${isToday ? "text-emerald-700" : isPast ? "text-slate-400" : "text-slate-600"}`}>
                          {evDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                        </div>
                        {ev.das !== undefined && (
                          <div className="text-[9px] text-slate-400 font-medium">
                            {ev.das < 0 ? `${Math.abs(ev.das)}d before` : `DAS ${ev.das}`}
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-3.5 flex-shrink-0 border-2 border-white ${dot} ${ev.is_completed ? "opacity-50" : ""}`} />
                        {i < activeCalendar.events.length - 1 && (
                          <div className="w-0.5 flex-1 bg-slate-200 min-h-[2rem]" />
                        )}
                      </div>

                      <div className={`flex-1 mb-2 p-4 rounded-xl border transition-all ${bg}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <Icon className={`h-4 w-4 ${text} flex-shrink-0 mt-0.5`} />
                            <div className="min-w-0">
                              <div className={`text-[10px] font-bold uppercase tracking-wider ${text} mb-0.5`}>{ev.event_type}</div>
                              <div className={`text-xs font-bold ${ev.is_completed ? "line-through text-slate-400" : "text-slate-900"}`}>{ev.title}</div>
                              <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{ev.description}</div>
                            </div>
                          </div>
                          <button onClick={() => toggleEvent(ev)} className="flex-shrink-0 mt-0.5">
                            {ev.is_completed
                              ? <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              : <Circle className="h-4 w-4 text-slate-400 hover:text-emerald-600 transition-colors" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── HISTORY LIST ─────────────────────────────────────────────── */}
        {view === "list" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">Saved Crop Schedules</h2>
                <p className="text-xs text-slate-500 mt-0.5">All your farming calendars</p>
              </div>
              <button onClick={() => { setWizardStep(0); setView("setup"); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all shadow-sm">
                <Plus className="h-3.5 w-3.5" /> New Calendar
              </button>
            </div>
            {isLoadingHistory ? (
              <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-emerald-600" /></div>
            ) : history.length === 0 ? (
              <div className="clean-card p-16 text-center bg-white shadow-sm">
                <CalendarDays className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 text-sm mb-1">No Calendars Generated</h3>
                <p className="text-xs text-slate-500">Create your first crop calendar above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map(cal => (
                  <button key={cal.id} onClick={() => loadCalendar(cal.id)}
                    className="clean-card clean-card-hover p-5 text-left bg-white shadow-sm group">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {new Date(cal.sow_date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                      </span>
                      {cal.location && (
                        <span className="text-[10px] text-slate-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{cal.location}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors">{cal.name}</h3>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      Sown: {new Date(cal.sow_date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
