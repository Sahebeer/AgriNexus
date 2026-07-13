"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import {
  ArrowLeft, CalendarDays, ChevronLeft, ChevronRight,
  CheckCircle, Circle, Sprout, Droplets, FlaskConical,
  Bug, ShieldAlert, Scissors, Wheat, Package, Leaf,
  Plus, RefreshCw, List, LayoutGrid, ArrowRight, Check,
  MapPin, Clock, X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface CalendarEvent {
  id: number;
  event_type: string;
  title: string;
  description: string;
  scheduled_date: string; // YYYY-MM-DD
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

// ─── Constants ────────────────────────────────────────────────────────────────
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
  "Land Preparation": { icon: Leaf,       bg: "bg-stone-500/10  border-stone-500/20",  text: "text-stone-400",  dot: "bg-stone-500"  },
  "Nursery":          { icon: Sprout,     bg: "bg-lime-500/10   border-lime-500/20",   text: "text-lime-400",   dot: "bg-lime-500"   },
  "Sowing":           { icon: Sprout,     bg: "bg-green-500/10  border-green-500/20",  text: "text-green-400",  dot: "bg-green-500"  },
  "Thinning":         { icon: Scissors,   bg: "bg-emerald-500/10 border-emerald-500/20",text:"text-emerald-400", dot: "bg-emerald-500"},
  "Irrigation":       { icon: Droplets,   bg: "bg-blue-500/10   border-blue-500/20",   text: "text-blue-400",   dot: "bg-blue-500"   },
  "Fertilizer":       { icon: FlaskConical,bg:"bg-amber-500/10  border-amber-500/20",  text: "text-amber-400",  dot: "bg-amber-500"  },
  "Weeding":          { icon: Scissors,   bg: "bg-yellow-500/10 border-yellow-500/20", text: "text-yellow-400", dot: "bg-yellow-500" },
  "Pest Monitoring":  { icon: Bug,        bg: "bg-orange-500/10 border-orange-500/20", text: "text-orange-400", dot: "bg-orange-500" },
  "Disease Monitoring":{ icon: ShieldAlert,bg:"bg-red-500/10    border-red-500/20",    text: "text-red-400",    dot: "bg-red-500"    },
  "Spray":            { icon: Package,    bg: "bg-rose-500/10   border-rose-500/20",   text: "text-rose-400",   dot: "bg-rose-500"   },
  "Harvest":          { icon: Wheat,      bg: "bg-primary/10    border-primary/20",    text: "text-primary",    dot: "bg-primary"    },
  "Post-Harvest":     { icon: Package,    bg: "bg-violet-500/10 border-violet-500/20", text: "text-violet-400", dot: "bg-violet-500" },
};
function getStyle(type: string) {
  return EVENT_TYPE_STYLE[type] ?? { icon: Circle, bg: "bg-neutral-800 border-neutral-700", text: "text-neutral-400", dot: "bg-neutral-500" };
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ─── Component ────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [view, setView] = useState<"setup" | "calendar" | "timeline" | "list">("setup");
  const [displayMode, setDisplayMode] = useState<"calendar" | "timeline">("calendar");

  // Setup wizard
  const [wizardStep, setWizardStep] = useState(0);
  const [crop, setCrop] = useState("");
  const [sowDate, setSowDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0];
  });
  const [variety, setVariety] = useState("");
  const [location, setLocation] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Active calendar
  const [activeCalendar, setActiveCalendar] = useState<CropCalendar | null>(null);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  // History
  const [history, setHistory] = useState<CalendarSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Pre-fill parameters from central database fields registry
  useEffect(() => {
    const prefillFromFarms = async () => {
      try {
        const res = await api.get("/api/v1/farms/");
        if (res.data && res.data.length > 0) {
          const f = res.data[0];
          if (f.current_crop) setCrop(f.current_crop);
          if (f.sowing_date) setSowDate(f.sowing_date);
          if (f.state) setLocation(f.state);
        }
      } catch (err) {
        console.error("Failed to prefill calendar parameters from database:", err);
      }
    };
    if (user) {
      prefillFromFarms();
      if (user.state) setLocation(user.state);
    }
  }, [user]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get("/api/v1/calendar/");
      setHistory(res.data);
    } catch { showToast("Failed to load calendars", "error"); }
    finally { setIsLoadingHistory(false); }
  };

  const handleCreate = async () => {
    if (!crop)    { showToast("Select a crop", "error"); return; }
    if (!sowDate) { showToast("Pick a sowing date", "error"); return; }
    setIsCreating(true);
    try {
      const res = await api.post("/api/v1/calendar/create", { crop, sow_date: sowDate, variety, location });
      setActiveCalendar(res.data);
      setCalMonth(new Date(sowDate + "T00:00:00"));
      setView("calendar");
      setDisplayMode("calendar");
      showToast("Crop calendar generated!", "success");
    } catch { showToast("Failed to create calendar", "error"); }
    finally { setIsCreating(false); }
  };

  const loadCalendar = async (id: number) => {
    try {
      const res = await api.get(`/api/v1/calendar/${id}`);
      setActiveCalendar(res.data);
      setCalMonth(new Date(res.data.sow_date + "T00:00:00"));
      setView("calendar");
      setDisplayMode("calendar");
    } catch { showToast("Failed to load calendar", "error"); }
  };

  const toggleEvent = async (ev: CalendarEvent) => {
    if (!activeCalendar) return;
    try {
      await api.patch(`/api/v1/calendar/${activeCalendar.id}/events/${ev.id}`, { is_completed: !ev.is_completed });
      setActiveCalendar(prev => prev ? {
        ...prev,
        events: prev.events.map(e => e.id === ev.id ? { ...e, is_completed: !e.is_completed } : e)
      } : prev);
      if (selectedEvent?.id === ev.id) setSelectedEvent({ ...ev, is_completed: !ev.is_completed });
    } catch { showToast("Update failed", "error"); }
  };

  // ─── Calendar grid logic ──────────────────────────────────────────────────
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    if (!activeCalendar) return map;
    activeCalendar.events.forEach(ev => {
      const key = ev.scheduled_date.slice(0, 10);
      (map[key] = map[key] ?? []).push(ev);
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

  // ─── Selected date events ─────────────────────────────────────────────────
  const selectedDateEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  // ─── Wizard steps ─────────────────────────────────────────────────────────
  const wizardSteps = ["Select Crop", "Sowing Date & Location"];

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => view !== "setup" ? setView("setup") : router.push("/dashboard")}
              className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-neutral-800 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                <CalendarDays className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-display font-bold text-white text-lg">Crop Calendar</span>
                <p className="text-[10px] text-neutral-500 -mt-0.5 font-semibold uppercase tracking-wider">Personalized Farming Schedule</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {view === "calendar" && (
              <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-1 gap-1">
                <button onClick={() => setDisplayMode("calendar")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${displayMode === "calendar" ? "bg-primary text-neutral-950" : "text-neutral-400 hover:text-white"}`}>
                  <LayoutGrid className="h-3.5 w-3.5" /> Calendar
                </button>
                <button onClick={() => setDisplayMode("timeline")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${displayMode === "timeline" ? "bg-primary text-neutral-950" : "text-neutral-400 hover:text-white"}`}>
                  <List className="h-3.5 w-3.5" /> Timeline
                </button>
              </div>
            )}
            <button onClick={() => { loadHistory(); setView("list"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 text-xs font-semibold transition-all">
              <CalendarDays className="h-4 w-4" /> My Calendars
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full">

        {/* ─── SETUP WIZARD ─────────────────────────────────────────────── */}
        {view === "setup" && (
          <div className="max-w-2xl mx-auto">
            {/* Step pills */}
            <div className="flex items-center justify-center gap-0 mb-10">
              {wizardSteps.map((s, i) => {
                const done = wizardStep > i; const active = wizardStep === i;
                return (
                  <React.Fragment key={i}>
                    <button onClick={() => i <= wizardStep && setWizardStep(i)}
                      className="flex flex-col items-center gap-1.5">
                      <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all ${done ? "bg-primary border-primary" : active ? "bg-primary/10 border-primary" : "bg-neutral-900 border-neutral-700"}`}>
                        {done ? <Check className="h-5 w-5 text-neutral-950" /> : <span className={`text-sm font-bold ${active ? "text-primary" : "text-neutral-500"}`}>{i + 1}</span>}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${active || done ? "text-neutral-200" : "text-neutral-600"}`}>{s}</span>
                    </button>
                    {i < wizardSteps.length - 1 && (
                      <div className={`h-0.5 w-20 mx-3 mb-5 rounded-full ${wizardStep > i ? "bg-primary" : "bg-neutral-800"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="glass border border-neutral-800 rounded-3xl p-8">
              {wizardStep === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white mb-1">Which crop are you growing?</h2>
                    <p className="text-sm text-neutral-400">We'll generate a complete season schedule based on this.</p>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                    {CROPS.map(c => (
                      <button key={c} onClick={() => setCrop(c)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left ${crop === c ? "bg-primary/10 border-primary text-primary" : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <button onClick={() => crop ? setWizardStep(1) : showToast("Select a crop", "error")}
                    disabled={!crop}
                    className="w-full bg-primary hover:bg-primary-600 disabled:opacity-40 text-neutral-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all">
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {wizardStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white mb-1">Sowing Date & Location</h2>
                    <p className="text-sm text-neutral-400">All activities will be scheduled relative to the sowing date.</p>
                  </div>
                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Sowing Date</label>
                      <input type="date" value={sowDate}
                        onChange={e => setSowDate(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Variety (optional)</label>
                      <input type="text" value={variety}
                        onChange={e => setVariety(e.target.value)}
                        placeholder={`e.g. PR-126, HD-3086, Pusa Basmati...`}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm placeholder-neutral-600 outline-none focus:border-primary transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">State / Location</label>
                      <select value={location} onChange={e => setLocation(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-primary transition-colors">
                        <option value="">Select state (optional)</option>
                        {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2 text-xs">
                    <div className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] mb-3">Calendar Summary</div>
                    {[["Crop", crop], ["Sowing Date", new Date(sowDate + "T00:00:00").toLocaleDateString("en-IN", { day:"numeric", month:"long", year:"numeric" })], ["Variety", variety || "—"], ["Location", location || "—"]].map(([k, v]) => (
                      <div key={k} className="flex justify-between"><span className="text-neutral-500">{k}</span><span className="text-neutral-200 font-semibold">{v}</span></div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setWizardStep(0)} className="flex-1 py-3 rounded-xl border border-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-900 transition-all">Back</button>
                    <button onClick={handleCreate} disabled={isCreating}
                      className="flex-[2] bg-primary hover:bg-primary-600 disabled:opacity-50 text-neutral-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all shadow-[0_0_20px_rgba(0,200,117,0.2)]">
                      {isCreating ? <><RefreshCw className="h-4 w-4 animate-spin" />Generating...</> : <><CalendarDays className="h-4 w-4" />Generate Calendar</>}
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
            <div className="glass border border-neutral-800 rounded-3xl p-6">
              <div className="flex flex-col md:flex-row justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {activeCalendar.location && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full">
                        <MapPin className="h-3 w-3" />{activeCalendar.location}
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                      Sown: {new Date(activeCalendar.sow_date + "T00:00:00").toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" })}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-white">{activeCalendar.name}</h1>
                  {activeCalendar.variety && <p className="text-neutral-400 text-sm mt-0.5">Variety: {activeCalendar.variety}</p>}
                </div>
                <div className="flex gap-4">
                  <div className="text-center p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800 min-w-[80px]">
                    <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-1">Total</div>
                    <div className="text-xl font-bold text-white">{totalCount}</div>
                  </div>
                  <div className="text-center p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 min-w-[80px]">
                    <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-1">Done</div>
                    <div className="text-xl font-bold text-emerald-400">{completedCount}</div>
                  </div>
                  <div className="text-center p-3 rounded-2xl bg-primary/5 border border-primary/15 min-w-[80px]">
                    <div className="text-[10px] text-primary uppercase tracking-widest font-bold mb-1">Left</div>
                    <div className="text-xl font-bold text-primary">{totalCount - completedCount}</div>
                  </div>
                </div>
              </div>
              {/* Progress */}
              <div className="mt-4">
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-700"
                    style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%" }} />
                </div>
              </div>
            </div>

            {/* ─── CALENDAR GRID MODE ───────────────────────────────────── */}
            {displayMode === "calendar" && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main grid */}
                <div className="lg:col-span-2 glass border border-neutral-800 rounded-3xl p-6">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-5">
                    <button onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() - 1))}
                      className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all">
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <h3 className="font-display font-bold text-white text-lg">
                      {MONTHS[calMonth.getMonth()]} {calMonth.getFullYear()}
                    </h3>
                    <button onClick={() => setCalMonth(d => new Date(d.getFullYear(), d.getMonth() + 1))}
                      className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-all">
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-2">
                    {DAYS.map(d => (
                      <div key={d} className="text-center text-[10px] font-bold text-neutral-600 uppercase tracking-widest py-1">{d}</div>
                    ))}
                  </div>

                  {/* Day cells */}
                  <div className="grid grid-cols-7 gap-0.5">
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
                            isSelected ? "bg-primary/20 border border-primary/40" :
                            isSow ? "bg-green-500/20 border border-green-500/30" :
                            isToday ? "bg-neutral-800 border border-neutral-700" :
                            hasEvent ? "hover:bg-neutral-800/60 border border-transparent hover:border-neutral-800" :
                            "border border-transparent"
                          }`}>
                          <span className={`font-bold text-[11px] ${
                            isSelected ? "text-primary" :
                            isSow ? "text-green-400" :
                            isToday ? "text-white" :
                            "text-neutral-400"
                          }`}>{parseInt(dateStr.split("-")[2])}</span>
                          {isSow && <div className="text-[7px] text-green-400 font-bold leading-none mt-0.5">SOW</div>}
                          {hasEvent && (
                            <div className="flex flex-wrap gap-0.5 justify-center mt-1 px-0.5">
                              {evs.slice(0, 3).map((ev, ei) => {
                                const style = getStyle(ev.event_type);
                                return (
                                  <div key={ei}
                                    className={`h-1.5 w-1.5 rounded-full ${allDone ? "opacity-30" : ""} ${style.dot}`} />
                                );
                              })}
                              {evs.length > 3 && <div className="text-[6px] text-neutral-600 font-bold">+{evs.length - 3}</div>}
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
                    <div className="glass border border-neutral-800 rounded-3xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Selected Date</div>
                          <div className="font-display font-bold text-white">
                            {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
                          </div>
                        </div>
                        <button onClick={() => setSelectedDate(null)} className="text-neutral-600 hover:text-white">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        {selectedDateEvents.map(ev => {
                          const { icon: Icon, bg, text } = getStyle(ev.event_type);
                          return (
                            <div key={ev.id} className={`p-3 rounded-xl border ${bg} flex items-start gap-3`}>
                              <Icon className={`h-4 w-4 ${text} flex-shrink-0 mt-0.5`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className={`text-xs font-bold ${text} ${ev.is_completed ? "line-through opacity-60" : ""}`}>{ev.title}</div>
                                  <button onClick={() => toggleEvent(ev)} className="flex-shrink-0 mt-0.5">
                                    {ev.is_completed
                                      ? <CheckCircle className="h-4 w-4 text-primary" />
                                      : <Circle className="h-4 w-4 text-neutral-600 hover:text-primary transition-colors" />}
                                  </button>
                                </div>
                                <div className="text-[10px] text-neutral-500 mt-1 leading-relaxed">{ev.description}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="glass border border-neutral-800 rounded-3xl p-5">
                      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Next Activities</div>
                      {upcomingEvents.length === 0 ? (
                        <div className="text-center py-4 text-neutral-600 text-xs">All activities completed! 🎉</div>
                      ) : (
                        <div className="space-y-3">
                          {upcomingEvents.map(ev => {
                            const { icon: Icon, bg, text } = getStyle(ev.event_type);
                            const daysLeft = Math.ceil((new Date(ev.scheduled_date + "T00:00:00").getTime() - new Date(today + "T00:00:00").getTime()) / 86400000);
                            return (
                              <div key={ev.id} className={`p-3 rounded-xl border ${bg}`}>
                                <div className="flex items-center gap-2 mb-1.5">
                                  <Icon className={`h-3.5 w-3.5 ${text}`} />
                                  <span className={`text-[10px] font-bold uppercase tracking-wider ${text}`}>{ev.event_type}</span>
                                  <span className="ml-auto text-[10px] text-neutral-500 font-semibold">
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
                  <div className="glass border border-neutral-800 rounded-3xl p-5">
                    <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Activity Legend</div>
                    <div className="space-y-2">
                      {Object.entries(EVENT_TYPE_STYLE).map(([type, style]) => {
                        const Icon = style.icon;
                        return (
                          <div key={type} className="flex items-center gap-2.5">
                            <div className={`h-2 w-2 rounded-full flex-shrink-0 ${style.dot}`} />
                            <span className="text-[11px] text-neutral-400">{type}</span>
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
                      {/* Date column */}
                      <div className="w-20 flex-shrink-0 text-right pt-4">
                        <div className={`text-[10px] font-bold uppercase ${isToday ? "text-primary" : isPast ? "text-neutral-600" : "text-neutral-400"}`}>
                          {evDate.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                        </div>
                        {ev.das !== undefined && (
                          <div className="text-[9px] text-neutral-700 font-semibold">
                            {ev.das < 0 ? `${Math.abs(ev.das)}d before` : `DAS ${ev.das}`}
                          </div>
                        )}
                      </div>

                      {/* Connector */}
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full mt-4 flex-shrink-0 border-2 border-neutral-950 ${dot} ${ev.is_completed ? "opacity-50" : ""}`} />
                        {i < activeCalendar.events.length - 1 && (
                          <div className="w-0.5 flex-1 bg-neutral-800 min-h-[2rem]" />
                        )}
                      </div>

                      {/* Event card */}
                      <div className={`flex-1 mb-2 p-4 rounded-2xl border transition-all ${bg} ${ev.is_completed ? "" : "group-hover:brightness-110"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 flex-1 min-w-0">
                            <Icon className={`h-4 w-4 ${text} flex-shrink-0 mt-0.5`} />
                            <div className="min-w-0">
                              <div className={`text-[10px] font-bold uppercase tracking-wider ${text} mb-0.5`}>{ev.event_type}</div>
                              <div className={`text-sm font-bold ${ev.is_completed ? "line-through text-neutral-500" : "text-white"}`}>{ev.title}</div>
                              <div className="text-[11px] text-neutral-500 mt-1 leading-relaxed">{ev.description}</div>
                            </div>
                          </div>
                          <button onClick={() => toggleEvent(ev)} className="flex-shrink-0 mt-0.5 transition-transform hover:scale-110">
                            {ev.is_completed
                              ? <CheckCircle className="h-5 w-5 text-primary" />
                              : <Circle className={`h-5 w-5 ${text} opacity-50 hover:opacity-100 transition-opacity`} />}
                          </button>
                        </div>
                        {isToday && (
                          <div className="mt-2 pt-2 border-t border-current/10 flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Today</span>
                          </div>
                        )}
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
                <h2 className="font-display text-2xl font-bold text-white">My Crop Calendars</h2>
                <p className="text-sm text-neutral-400 mt-1">All your farming schedules</p>
              </div>
              <button onClick={() => { setWizardStep(0); setView("setup"); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-neutral-950 text-xs font-bold hover:bg-primary-600 transition-all">
                <Plus className="h-4 w-4" /> New Calendar
              </button>
            </div>
            {isLoadingHistory ? (
              <div className="flex justify-center py-20"><RefreshCw className="h-6 w-6 animate-spin text-primary" /></div>
            ) : history.length === 0 ? (
              <div className="glass border border-neutral-800 rounded-3xl p-16 text-center">
                <CalendarDays className="h-10 w-10 text-neutral-700 mx-auto mb-4" />
                <h3 className="font-bold text-neutral-300 mb-2">No Calendars Yet</h3>
                <p className="text-xs text-neutral-500">Create your first crop calendar above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {history.map(cal => (
                  <button key={cal.id} onClick={() => loadCalendar(cal.id)}
                    className="glass border border-neutral-800 rounded-2xl p-6 text-left hover:border-neutral-600 hover:bg-neutral-900/20 transition-all group">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                        {new Date(cal.sow_date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                      </span>
                      {cal.location && (
                        <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{cal.location}
                        </span>
                      )}
                    </div>
                    <h3 className="font-bold text-white text-sm group-hover:text-primary transition-colors">{cal.name}</h3>
                    <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1.5">
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
