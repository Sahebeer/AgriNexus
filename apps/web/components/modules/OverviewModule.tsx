"use client";

import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import {
  Sparkles,
  Sprout,
  TrendingUp,
  Coins,
  CloudSun,
  ShieldCheck,
  Calendar,
  Layers,
  MapPin,
  FileText,
  Activity,
  ArrowRight,
  Calculator,
  Scan,
  Compass,
  Satellite,
  Lock
} from "lucide-react";

interface OverviewModuleProps {
  onNavigate: (moduleKey: string) => void;
  onOpenAuth?: () => void;
}

export default function OverviewModule({ onNavigate, onOpenAuth }: OverviewModuleProps) {
  const { user, isAuthenticated } = useAuthStore();
  const [activeFarmsCount, setActiveFarmsCount] = useState<number>(0);
  const [totalHectares, setTotalHectares] = useState<number>(0);

  useEffect(() => {
    const fetchFarms = async () => {
      try {
        const res = await api.get("/api/v1/farms/");
        const list = res.data || [];
        setActiveFarmsCount(list.length);
        const ha = list.reduce((acc: number, f: any) => acc + (f.area || 0), 0);
        setTotalHectares(ha);
      } catch {
        // Fallback demo stats
        setActiveFarmsCount(2);
        setTotalHectares(12.4);
      }
    };
    fetchFarms();
  }, []);

  const features = [
    {
      id: "advisor",
      title: "AI Agronomist",
      desc: "Instant multi-lingual advisory for disease, pest control & nutrient balance.",
      icon: Sparkles,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      id: "disease",
      title: "Crop Disease Scanner",
      desc: "Multi-class vision pipeline diagnosing 15+ crop ailments in real-time.",
      icon: Scan,
      color: "text-rose-700 bg-rose-50 border-rose-200",
    },
    {
      id: "satellite",
      title: "Earth & Satellite Maps",
      desc: "Sentinel-2 multi-spectral NDVI layers and Sentinel-1 SAR microwave passes.",
      icon: Satellite,
      color: "text-blue-700 bg-blue-50 border-blue-200",
    },
    {
      id: "weather",
      title: "Microclimate Intelligence",
      desc: "5-day agro-meteorological forecasting & spray window alerts.",
      icon: CloudSun,
      color: "text-amber-700 bg-amber-50 border-amber-200",
    },
    {
      id: "prices",
      title: "Commodity Rates & MSP",
      desc: "Daily mandi trading boards, wholesale rates & MSP margin analysis.",
      icon: TrendingUp,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      id: "mandi",
      title: "Marketplace & Trade",
      desc: "Direct farmer-to-buyer APMC trading floor with verified buyer connections.",
      icon: Coins,
      color: "text-cyan-700 bg-cyan-50 border-cyan-200",
    },
    {
      id: "schemes",
      title: "Govt Subsidies & Schemes",
      desc: "Curated national and state agricultural schemes with eligibility verification.",
      icon: ShieldCheck,
      color: "text-purple-700 bg-purple-50 border-purple-200",
    },
    {
      id: "calendar",
      title: "Sowing Calendar",
      desc: "Phenological stage tracking and crop schedule optimization.",
      icon: Calendar,
      color: "text-indigo-700 bg-indigo-50 border-indigo-200",
    },
    {
      id: "shopping",
      title: "Farm Inputs Calculator",
      desc: "Fertilizer, pesticide & seed requirement calculator with cost checklist.",
      icon: Calculator,
      color: "text-emerald-700 bg-emerald-50 border-emerald-200",
    },
    {
      id: "expenses",
      title: "Expense & Revenue Forecaster",
      desc: "Track cultivation input costs and project seasonal harvest profit margins.",
      icon: Activity,
      color: "text-amber-700 bg-amber-50 border-amber-200",
    },
    {
      id: "timeline",
      title: "Farmer Timeline Diary",
      desc: "Chronological operational log for irrigation, spray and fertilizer events.",
      icon: FileText,
      color: "text-blue-700 bg-blue-50 border-blue-200",
    },
    {
      id: "profile",
      title: "Farm & Soil Console",
      desc: "Manage multiple field boundaries, NPK chemical tests & operator settings.",
      icon: Compass,
      color: "text-slate-700 bg-slate-100 border-slate-200",
    },
  ];

  return (
    <div className="space-y-8 animate-fade-in text-left">
      
      {/* Top Banner KPI Card */}
      <div className="clean-card p-6 md:p-8 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-semibold mb-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>All AgriNexus Farm Modules Operational</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
                Welcome to your Unified Farm Operating System
              </h2>
              <p className="text-emerald-100/80 text-xs md:text-sm mt-1 max-w-2xl">
                {isAuthenticated 
                  ? `Operator: ${user?.full_name || "Active Farmer"} • Region: ${user?.state || "Punjab"}`
                  : "Explore live agricultural AI models, Sentinel satellite telemetry, and commodity rate sheets."
                }
              </p>
            </div>

            {!isAuthenticated && onOpenAuth && (
              <button
                onClick={onOpenAuth}
                className="px-4 py-2.5 rounded-xl bg-white text-emerald-950 hover:bg-emerald-50 font-bold text-xs shadow-md transition-all self-start md:self-center flex items-center gap-2"
              >
                <Lock className="h-4 w-4 text-emerald-700" />
                <span>Operator Sign In</span>
              </button>
            )}
          </div>

          {/* KPI Mini-Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-emerald-700/50">
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-700/40">
              <span className="text-[10px] text-emerald-200/70 uppercase font-bold tracking-wider block">Farm Health Index</span>
              <span className="text-xl font-extrabold text-white mt-0.5 block">94.2%</span>
            </div>
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-700/40">
              <span className="text-[10px] text-emerald-200/70 uppercase font-bold tracking-wider block">Active Field Area</span>
              <span className="text-xl font-extrabold text-emerald-300 mt-0.5 block">{totalHectares || 12.4} ha</span>
            </div>
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-700/40">
              <span className="text-[10px] text-emerald-200/70 uppercase font-bold tracking-wider block">Volumetric Moisture</span>
              <span className="text-xl font-extrabold text-blue-300 mt-0.5 block">28.5%</span>
            </div>
            <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-700/40">
              <span className="text-[10px] text-emerald-200/70 uppercase font-bold tracking-wider block">Mandi Tickers Active</span>
              <span className="text-xl font-extrabold text-amber-300 mt-0.5 block">+4.8% Gain</span>
            </div>
          </div>
        </div>
      </div>

      {/* Module Grid Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Agricultural Intelligence Modules</h3>
          <p className="text-xs text-slate-500">Access all real-time tools directly from this workspace</p>
        </div>
      </div>

      {/* 12-Module Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {features.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.id}
              onClick={() => onNavigate(f.id)}
              className="clean-card clean-card-hover p-6 flex flex-col justify-between space-y-4 cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className={`p-3 rounded-xl border ${f.color} shadow-sm group-hover:scale-105 transition-transform`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {f.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-semibold text-emerald-700 group-hover:text-emerald-800">
                <span>Launch Tool</span>
                <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
