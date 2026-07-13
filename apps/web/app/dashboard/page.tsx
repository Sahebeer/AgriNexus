"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../../store/authStore";
import { 
  Sprout, 
  ShieldAlert, 
  Coins, 
  CloudSun, 
  TrendingUp, 
  User, 
  Bot, 
  LogOut, 
  ArrowRight,
  Shield,
  Activity,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  CalendarDays
} from "lucide-react";

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    if (!user?.email) return;
    const key = `agrinexus_farms_${user.email}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setNodeCount(parsed.length);
      } catch (e) {
        setNodeCount(0);
      }
    } else {
      const isRajesh = user.full_name?.toLowerCase().includes("rajesh") || user.email.toLowerCase().includes("rajesh");
      setNodeCount(isRajesh ? 2 : 0);
    }
  }, [user]);

  const dashboardCards = [
    {
      title: "AI Disease Detection",
      desc: "Analyze leaf anomalies and identify crop diseases instantly using deep neural networks.",
      icon: ShieldAlert,
      tag: "Highest Priority",
      color: "text-red-400 bg-red-500/10 border-red-500/20",
      actionText: "Upload Image",
      path: "/dashboard/disease"
    },
    {
      title: "AI Crop Advisor",
      desc: "Consult the AgriNexus interactive LLM for custom fertilizer schedules, planting insights, and general inquiries.",
      icon: Bot,
      tag: "Ready",
      color: "text-primary bg-primary/10 border-primary/20",
      actionText: "Ask AI Agent",
      path: "/dashboard/advisor"
    },
    {
      title: "Government Schemes",
      desc: "Review match results for state and central subsidies, fertilizers, PM-KISAN, and Kisan cards.",
      icon: Coins,
      tag: "Ready",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
      actionText: "Check Eligibility",
      path: "/dashboard/schemes"
    },
    {
      title: "Weather Intelligence",
      desc: "Check local humidity thresholds, rainfall metrics, and microclimate warning flags.",
      icon: CloudSun,
      tag: "Integrated",
      color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
      actionText: "View Forecast",
      path: "/dashboard/weather"
    },
    {
      title: "Market Prices",
      desc: "Analyze real-time MSP indices, wholesale commodity prices, and market predictions.",
      icon: TrendingUp,
      tag: "Mocked",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/20",
      actionText: "Compare Prices",
      path: "/dashboard/prices"
    },
    {
      title: "Operator Profile",
      desc: "Manage multi-farm fields, geographic coordinates, soil types, and update credentials.",
      icon: User,
      tag: "Active",
      color: "text-neutral-400 bg-neutral-800/40 border-neutral-800",
      actionText: "Edit Details",
      path: "/dashboard/profile"
    },
    {
      title: "Smart Shopping List",
      desc: "Generate a complete farm inputs list — seeds, fertilizers, pesticides, and tools — scaled to your crop and field size.",
      icon: ShoppingCart,
      tag: "New",
      color: "text-teal-400 bg-teal-500/10 border-teal-500/20",
      actionText: "Generate List",
      path: "/dashboard/shopping"
    },
    {
      title: "Crop Calendar",
      desc: "Auto-generate a complete farming schedule from land prep to post-harvest based on your crop and sowing date.",
      icon: CalendarDays,
      tag: "New",
      color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
      actionText: "Create Schedule",
      path: "/dashboard/calendar"
    }
  ];

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Dashboard Top Header */}
      <header className="glass sticky top-0 z-40 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
              <Sprout className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display font-bold text-lg text-white">AgriNexus Console</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-neutral-900 border border-neutral-800 text-xs font-semibold text-neutral-300">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="capitalize">{user?.role}</span>
            </div>
            
            <button 
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-semibold"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
        {/* Welcome Section */}
        <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">Smart Farm OS Terminal</span>
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse"></span>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-white">
              Hello, {user?.full_name || "Operator"}
            </h1>
            <p className="text-neutral-400 text-sm md:text-base mt-1">
              Active Location: <span className="text-neutral-200 font-semibold">{user?.state || "Not configured"}</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-neutral-900/60 border border-neutral-850">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Node Status</div>
                <div className="text-xs font-bold text-neutral-200">
                  {nodeCount} Connected {nodeCount === 1 ? "Node" : "Nodes"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboardCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <div 
                key={idx} 
                className="glass glass-hover p-6 rounded-2xl border border-neutral-800 flex flex-col justify-between transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-2.5 rounded-xl border ${card.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400">
                      {card.tag}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-neutral-400 text-sm leading-relaxed mb-6">
                    {card.desc}
                  </p>
                </div>

                <button 
                  onClick={() => router.push(card.path)}
                  className="w-full bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 hover:border-neutral-700 text-neutral-200 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all group"
                >
                  {card.actionText}
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
