"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../store/authStore";
import { useToastStore } from "../store/toastStore";
import AuthModal from "../components/auth/AuthModal";

// Modular Views
import OverviewModule from "../components/modules/OverviewModule";
import AdvisorModule from "../components/modules/AdvisorModule";
import DiseaseModule from "../components/modules/DiseaseModule";
import WeatherModule from "../components/modules/WeatherModule";
import MandiModule from "../components/modules/MandiModule";
import PricesModule from "../components/modules/PricesModule";
import SchemesModule from "../components/modules/SchemesModule";
import TimelineModule from "../components/modules/TimelineModule";
import ShoppingModule from "../components/modules/ShoppingModule";
import CalendarModule from "../components/modules/CalendarModule";
import ExpensesModule from "../components/modules/ExpensesModule";
import ProfileModule from "../components/modules/ProfileModule";
import SatelliteModule from "../components/modules/SatelliteModule";

import {
  Sprout,
  LayoutDashboard,
  Sparkles,
  Scan,
  CloudSun,
  TrendingUp,
  Coins,
  ShieldCheck,
  CalendarDays,
  Calculator,
  Activity,
  FileText,
  Compass,
  Satellite,
  User,
  LogOut,
  LogIn,
  Search,
  ChevronRight,
  Menu,
  X,
  Bell,
  Layers,
  Clock,
  Shield
} from "lucide-react";

type ModuleKey =
  | "overview"
  | "advisor"
  | "disease"
  | "weather"
  | "prices"
  | "mandi"
  | "schemes"
  | "calendar"
  | "shopping"
  | "expenses"
  | "timeline"
  | "profile"
  | "satellite";

interface NavItem {
  id: ModuleKey;
  label: string;
  icon: React.FC<any>;
  badge?: string;
  category: "core" | "insights" | "operations";
}

const NAV_ITEMS: NavItem[] = [
  { id: "overview", label: "Dashboard Hub", icon: LayoutDashboard, category: "core" },
  { id: "advisor", label: "AI Agronomist", icon: Sparkles, category: "core" },
  { id: "disease", label: "Disease Scanner", icon: Scan, category: "core" },
  { id: "satellite", label: "Satellite Earth AI", icon: Satellite, category: "core" },
  
  { id: "weather", label: "Microclimate Outlook", icon: CloudSun, category: "insights" },
  { id: "prices", label: "Commodity Rates & MSP", icon: TrendingUp, category: "insights" },
  { id: "mandi", label: "Trade Marketplace", icon: Coins, category: "insights" },
  { id: "schemes", label: "Govt Subsidies", icon: ShieldCheck, category: "insights" },

  { id: "calendar", label: "Sowing Schedule", icon: CalendarDays, category: "operations" },
  { id: "shopping", label: "Inputs Calculator", icon: Calculator, category: "operations" },
  { id: "expenses", label: "Expense Forecaster", icon: Activity, category: "operations" },
  { id: "timeline", label: "Farm Diary Log", icon: FileText, category: "operations" },
  { id: "profile", label: "Soil & Landholdings", icon: Compass, category: "operations" },
];

function MainConsoleContent() {
  const searchParams = useSearchParams();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<ModuleKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");

  // Sync tab from URL param if provided
  useEffect(() => {
    const tabParam = searchParams.get("tab") as ModuleKey | null;
    if (tabParam && NAV_ITEMS.some((n) => n.id === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Live digital clock in header
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (key: ModuleKey) => {
    setActiveTab(key);
    setSidebarOpen(false);
    if (typeof window !== "undefined") {
      const newUrl = key === "overview" ? "/" : `/?tab=${key}`;
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, "", newUrl);
    }
  };

  const handleSignOut = () => {
    logout();
    showToast("Signed out of operator console", "info");
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex text-slate-900 font-sans antialiased overflow-x-hidden">
      
      {/* ─── 1. Left Navigation Sidebar ───────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="h-16 px-6 border-b border-slate-100 flex items-center justify-between">
            <button
              onClick={() => handleTabChange("overview")}
              className="flex items-center gap-2.5 text-left group"
            >
              <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <Sprout className="h-5 w-5" />
              </div>
              <div>
                <span className="font-extrabold text-slate-900 text-sm tracking-tight block">
                  AgriNexus <span className="text-emerald-600">AI</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
                  Farm OS • Single Hub
                </span>
              </div>
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Links Grouped */}
          <div className="p-4 space-y-6 flex-1">
            
            {/* Core Intelligence */}
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Intelligence & Diagnostics
              </span>
              {NAV_ITEMS.filter((n) => n.category === "core").map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-emerald-50 text-emerald-950 font-bold border border-emerald-200 shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                        isActive ? "bg-emerald-200/80 text-emerald-900" : "bg-slate-100 text-slate-500"
                      }`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Markets & Economics */}
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Markets & Climate
              </span>
              {NAV_ITEMS.filter((n) => n.category === "insights").map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-emerald-50 text-emerald-950 font-bold border border-emerald-200 shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Operations */}
            <div className="space-y-1">
              <span className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Farm Management
              </span>
              {NAV_ITEMS.filter((n) => n.category === "operations").map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-emerald-50 text-emerald-950 font-bold border border-emerald-200 shadow-sm"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`h-4 w-4 ${isActive ? "text-emerald-700" : "text-slate-400"}`} />
                      <span>{item.label}</span>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>
        </div>

        {/* Sidebar Footer: User Card & Admin Entry */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 space-y-2.5">
          {isAuthenticated ? (
            <div className="flex items-center justify-between">
              <div 
                onClick={() => handleTabChange("profile")}
                className="flex items-center gap-2.5 cursor-pointer hover:opacity-80 transition-opacity"
              >
                <div className="h-8 w-8 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-bold text-xs">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : "O"}
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-900 block truncate max-w-[100px]">
                    {user?.full_name || "Operator"}
                  </span>
                  <span className="text-[10px] text-slate-500 block truncate max-w-[100px]">
                    {user?.state || "Punjab"}
                  </span>
                </div>
              </div>

              <button
                onClick={handleSignOut}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setAuthModalOpen(true)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Operator Sign In</span>
            </button>
          )}

          <Link
            href="/admin/login"
            className="w-full py-1.5 px-3 rounded-xl bg-amber-50/80 hover:bg-amber-100 border border-amber-200 text-amber-900 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors shadow-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-amber-700" />
            <span>Admin Demo Portal</span>
          </Link>
        </div>
      </aside>

      {/* Backdrop overlay for mobile sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm z-30 lg:hidden"
        />
      )}

      {/* ─── 2. Main Workspace Layout ─────────────────────────────────────── */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        
        {/* Top Workspace Header Bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 px-4 md:px-8 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb Module Title */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500">
              <button 
                onClick={() => handleTabChange("overview")}
                className="hover:text-slate-900"
              >
                Console
              </button>
              <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-900 font-bold">
                {NAV_ITEMS.find((n) => n.id === activeTab)?.label || "Dashboard"}
              </span>
            </div>
          </div>

          {/* Quick Right Shortcuts */}
          <div className="flex items-center gap-3">
            {/* Real-time Clock */}
            {currentTime && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <span>{currentTime}</span>
              </div>
            )}

            {/* Quick Module Switcher Pill Buttons */}
            <button
              onClick={() => handleTabChange("advisor")}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "advisor"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ask AI</span>
            </button>

            <button
              onClick={() => handleTabChange("disease")}
              className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === "disease"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700"
              }`}
            >
              <Scan className="h-3.5 w-3.5" />
              <span>Scan Leaf</span>
            </button>

            {!isAuthenticated && (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Login</span>
              </button>
            )}
          </div>
        </header>

        {/* Dynamic Main Workspace Canvas (One URL: /) */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          {activeTab === "overview" && (
            <OverviewModule
              onNavigate={(k) => handleTabChange(k as ModuleKey)}
              onOpenAuth={() => setAuthModalOpen(true)}
            />
          )}
          {activeTab === "advisor" && <AdvisorModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "disease" && <DiseaseModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "weather" && <WeatherModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "prices" && <PricesModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "mandi" && <MandiModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "schemes" && <SchemesModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "calendar" && <CalendarModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "shopping" && <ShoppingModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "expenses" && <ExpensesModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "timeline" && <TimelineModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "profile" && <ProfileModule onBack={() => handleTabChange("overview")} />}
          {activeTab === "satellite" && <SatelliteModule onBack={() => handleTabChange("overview")} />}
        </main>
      </div>

      {/* In-Place Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />

    </div>
  );
}

export default function UnifiedConsolePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-semibold text-xs">
        <Sprout className="h-6 w-6 text-emerald-600 animate-spin mr-2" />
        Initializing AgriNexus Single-Hub Farm Console...
      </div>
    }>
      <MainConsoleContent />
    </Suspense>
  );
}
