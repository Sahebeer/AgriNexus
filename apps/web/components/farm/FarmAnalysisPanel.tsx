"use client";

import React, { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  Droplets,
  Sprout,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Zap,
  Info,
  Layers,
  Mountain,
  Compass,
  X,
  Check,
  Calendar,
  Activity
} from "lucide-react";

export interface FarmZone {
  zone_id: string;
  name: string;
  status: string;
  health_score: number;
  ndvi: number;
  moisture_score: number;
  trend: string;
  risk_level: string;
  area_hectares?: number;
  area_acres?: number;
  description: string;
  suggested_action: string;
  polygon: number[][];
}

export interface BarrenParcel {
  parcel_id: string;
  name: string;
  area_hectares: number;
  area_acres: number;
  current_vegetation: string;
  ndvi_mean: number;
  soil_type: string;
  estimated_potential: string;
  feasibility_score: number;
  candidate_crops: string[];
  water_feasibility: string;
  disclaimer: string;
  polygon: number[][];
}

export interface GrowthHistoryItem {
  week: string;
  ndvi: number;
  stage: string;
  date: string;
}

export interface EfficiencyPillar {
  pillar: string;
  title: string;
  priority: string;
  impact: string;
  description: string;
  action_items: string[];
}

export interface FarmIntelligenceData {
  farm_id: string;
  name: string;
  location?: string;
  crop: string;
  crop_confidence?: number;
  area_hectares: number;
  area_acres: number;
  area_square_meters?: number;
  boundary?: number[][];
  health_score: number;
  health_status: string;
  ndvi_mean: number;
  moisture_index: number;
  growth_stage?: string;
  satellite_source: string;
  is_demo: boolean;
  zones: FarmZone[];
  barren_land: BarrenParcel[];
  growth_history: GrowthHistoryItem[];
  ai_reasoning: {
    summary: string;
    observed: string[];
    inferred: string[];
    recommended: string[];
    confidence: number;
  };
  efficiency_recommendations: EfficiencyPillar[];
}

interface FarmAnalysisPanelProps {
  data: FarmIntelligenceData | null;
  isLoading: boolean;
  selectedZone: FarmZone | null;
  onSelectZone: (zone: FarmZone | null) => void;
  selectedBarrenParcel: BarrenParcel | null;
  onSelectBarrenParcel: (parcel: BarrenParcel | null) => void;
  onAnalyzeBoundary: () => void;
  hasBoundary: boolean;
}

export default function FarmAnalysisPanel({
  data,
  isLoading,
  selectedZone,
  onSelectZone,
  selectedBarrenParcel,
  onSelectBarrenParcel,
  onAnalyzeBoundary,
  hasBoundary
}: FarmAnalysisPanelProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "zones" | "growth" | "barren">("overview");
  const [showEfficiencyModal, setShowEfficiencyModal] = useState(false);

  if (isLoading) {
    return (
      <div className="bg-neutral-900/90 backdrop-blur-2xl border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-neutral-800 rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          <div className="h-20 bg-neutral-800/60 rounded-2xl" />
          <div className="h-20 bg-neutral-800/60 rounded-2xl" />
          <div className="h-20 bg-neutral-800/60 rounded-2xl" />
        </div>
        <div className="h-36 bg-neutral-800/40 rounded-2xl" />
        <div className="h-24 bg-neutral-800/50 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-neutral-900/90 backdrop-blur-2xl border border-neutral-800 rounded-3xl p-6 shadow-2xl text-center space-y-4">
        <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-2xl w-fit mx-auto text-primary">
          <Compass className="h-6 w-6" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white">Smart Farm Intelligence</h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto leading-relaxed">
            {hasBoundary
              ? "Boundary completed! Click below to compute multi-spectral indices, zones, and AI reasoning."
              : "Locate your farm or use the 'Explore Demo Farm' button to inspect high-resolution agricultural analytics."}
          </p>
        </div>
        {hasBoundary && (
          <button
            onClick={onAnalyzeBoundary}
            className="w-full bg-primary hover:bg-primary/90 text-neutral-950 font-bold py-2.5 px-4 rounded-2xl shadow-lg transition-all text-xs"
          >
            Analyze Farm Boundary
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="bg-neutral-900/95 backdrop-blur-2xl border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all">
        {/* 1. Header & Crop Identification */}
        <div className="p-5 border-b border-neutral-800/80 space-y-2 bg-gradient-to-b from-neutral-850/50 to-transparent">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                {data.crop}
              </span>
              {data.crop_confidence && (
                <span className="text-[10px] text-neutral-400 font-medium">
                  {Math.round(data.crop_confidence * 100)}% Match
                </span>
              )}
            </div>
            {data.is_demo && (
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                DEMO ENVIRONMENT
              </span>
            )}
          </div>

          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-extrabold text-white tracking-tight truncate">
              {data.name}
            </h2>
            <div className="text-right flex-shrink-0">
              <span className="text-base font-bold text-white">{data.area_hectares}</span>{" "}
              <span className="text-xs text-neutral-400 font-medium">ha</span>
              <span className="text-[10px] text-neutral-500 block">
                ({data.area_acres} acres)
              </span>
            </div>
          </div>

          {data.location && (
            <p className="text-[11px] text-neutral-400 truncate">{data.location}</p>
          )}
        </div>

        {/* 2. Key Metrics Bar */}
        <div className="grid grid-cols-3 gap-2 p-4 border-b border-neutral-800/80 bg-neutral-950/40">
          <div className="p-3 rounded-2xl bg-neutral-900/70 border border-neutral-800/60 text-left">
            <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
              NDVI Index
            </div>
            <div className="text-lg font-bold text-primary">{data.ndvi_mean}</div>
            <div className="text-[9px] text-emerald-400 font-medium">High Canopy</div>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-900/70 border border-neutral-800/60 text-left">
            <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
              Moisture
            </div>
            <div className="text-lg font-bold text-blue-400">{data.moisture_index}%</div>
            <div className="text-[9px] text-neutral-400 font-medium">Adequate</div>
          </div>

          <div className="p-3 rounded-2xl bg-neutral-900/70 border border-neutral-800/60 text-left">
            <div className="text-[9px] font-bold text-neutral-400 uppercase tracking-wider mb-0.5">
              Crop Health
            </div>
            <div className="text-lg font-bold text-white">{data.health_score}</div>
            <div className="text-[9px] text-primary font-medium">{data.health_status}</div>
          </div>
        </div>

        {/* 3. Navigation Tabs */}
        <div className="flex border-b border-neutral-800/80 px-4 pt-2 gap-1 text-xs font-semibold select-none bg-neutral-950/20">
          {(
            [
              { id: "overview", label: "AI Insights" },
              { id: "zones", label: `Zones (${data.zones.length})` },
              { id: "growth", label: "Growth Trend" },
              { id: "barren", label: `Unused Land (${data.barren_land.length})` }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-2.5 px-2.5 transition-all relative ${
                activeTab === tab.id
                  ? "text-white font-bold"
                  : "text-neutral-400 hover:text-neutral-200"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full shadow-sm" />
              )}
            </button>
          ))}
        </div>

        {/* 4. Scrollable Tab Content Area */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-neutral-300">
          {/* TAB 1: AI INSIGHTS & REASONING */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Executive Summary */}
              <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-1.5 text-left">
                <div className="flex items-center gap-2 text-primary font-bold text-xs">
                  <Sparkles className="h-4 w-4" />
                  <span>AI Farm Reasoning</span>
                </div>
                <p className="text-xs text-neutral-200 leading-relaxed">
                  {data.ai_reasoning.summary}
                </p>
              </div>

              {/* Observed vs Inferred vs Recommended */}
              <div className="space-y-3">
                {/* Observed */}
                <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 text-left space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    <Activity className="h-3.5 w-3.5 text-blue-400" />
                    <span>Observed Telemetry</span>
                  </div>
                  <ul className="space-y-1.5 text-neutral-300 text-[11px] leading-relaxed">
                    {data.ai_reasoning.observed.map((obs, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-400 mt-1">•</span>
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Inferred */}
                <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 text-left space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-400" />
                    <span>Inferred Agronomic Patterns</span>
                  </div>
                  <ul className="space-y-1.5 text-neutral-300 text-[11px] leading-relaxed">
                    {data.ai_reasoning.inferred.map((inf, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-amber-400 mt-1">•</span>
                        <span>{inf}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Recommended */}
                <div className="p-3.5 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 text-left space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                    <Sprout className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Actionable Recommendations</span>
                  </div>
                  <ul className="space-y-1.5 text-neutral-300 text-[11px] leading-relaxed">
                    {data.ai_reasoning.recommended.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-1">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Action Button: Improve Farm Efficiency */}
              <button
                onClick={() => setShowEfficiencyModal(true)}
                className="w-full bg-gradient-to-r from-primary to-emerald-400 hover:from-primary/90 hover:to-emerald-300 text-neutral-950 font-bold py-3 px-4 rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all transform hover:scale-[1.01] active:scale-[0.99]"
              >
                <Zap className="h-4 w-4 fill-current" />
                <span>Improve Farm Efficiency</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* TAB 2: FARM ZONES */}
          {activeTab === "zones" && (
            <div className="space-y-3">
              <p className="text-[11px] text-neutral-400 text-left">
                Partitioned into {data.zones.length} sub-zones. Click any sector to inspect localized moisture dynamics and suggested actions.
              </p>

              <div className="space-y-2">
                {data.zones.map((zone) => {
                  const isSelected = selectedZone?.zone_id === zone.zone_id;
                  const isStressed = zone.status === "stressed" || zone.risk_level === "high";
                  const isModerate = zone.status === "moderate";

                  return (
                    <div
                      key={zone.zone_id}
                      onClick={() => onSelectZone(isSelected ? null : zone)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all text-left ${
                        isSelected
                          ? "bg-neutral-850 border-primary shadow-lg ring-1 ring-primary/40"
                          : "bg-neutral-900/60 border-neutral-800/80 hover:bg-neutral-850 hover:border-neutral-700"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white text-xs">{zone.name}</span>
                          <span
                            className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              isStressed
                                ? "bg-red-500/15 text-red-400 border border-red-500/20"
                                : isModerate
                                ? "bg-amber-500/15 text-amber-400 border border-amber-500/20"
                                : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            }`}
                          >
                            {zone.status}
                          </span>
                        </div>
                        <div className="text-[11px] font-semibold text-neutral-300">
                          NDVI {zone.ndvi}
                        </div>
                      </div>

                      <p className="text-[11px] text-neutral-400 leading-snug">
                        {zone.description}
                      </p>

                      {isSelected && (
                        <div className="mt-3 pt-2.5 border-t border-neutral-800 space-y-2 animate-in fade-in">
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div className="p-2 rounded-xl bg-neutral-950/60 border border-neutral-900">
                              <span className="text-neutral-500 block">Moisture Level</span>
                              <span className="font-bold text-blue-400 text-xs">
                                {zone.moisture_score}%
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-neutral-950/60 border border-neutral-900">
                              <span className="text-neutral-500 block">Biomass Trend</span>
                              <span className="font-bold text-neutral-200 capitalize text-xs">
                                {zone.trend}
                              </span>
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-[11px] text-primary">
                            <strong>Action:</strong> {zone.suggested_action}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: GROWTH TREND */}
          {activeTab === "growth" && (
            <div className="space-y-4 text-left">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Crop Growth NDVI Time-Series
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Tracks weekly canopy chlorophyll index across phenological development stages.
                </p>
              </div>

              {/* Smooth Bar/Curve Graph Representation */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-850 space-y-3">
                <div className="flex items-end justify-between gap-1.5 h-32 pt-4">
                  {data.growth_history.map((g, idx) => {
                    const heightPercent = Math.round((g.ndvi / 1.0) * 100);
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group">
                        <span className="text-[9px] font-semibold text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          {g.ndvi}
                        </span>
                        <div className="w-full bg-neutral-850 rounded-t-lg h-24 flex items-end">
                          <div
                            style={{ height: `${heightPercent}%` }}
                            className="w-full bg-gradient-to-t from-primary/60 to-emerald-400 rounded-t-lg transition-all duration-500 hover:brightness-125"
                          />
                        </div>
                        <span className="text-[9px] text-neutral-500 font-medium truncate w-full text-center">
                          {g.week.replace("Week ", "W")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-1 pt-2 border-t border-neutral-900">
                  {data.growth_history.map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[10px] py-0.5 text-neutral-400">
                      <span className="text-neutral-300 font-medium">{g.week} ({g.stage})</span>
                      <span className="font-bold text-primary">NDVI {g.ndvi}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: BARREN / UNUSED LAND */}
          {activeTab === "barren" && (
            <div className="space-y-3 text-left">
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-2">
                  <Mountain className="h-4 w-4 text-purple-400" />
                  Potentially Underutilized Land Parcels
                </h4>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Nearby low-vegetation parcels detected for candidate pulse, millet, or agroforestry expansion.
                </p>
              </div>

              <div className="space-y-2.5">
                {data.barren_land.map((parcel) => {
                  const isSelected = selectedBarrenParcel?.parcel_id === parcel.parcel_id;

                  return (
                    <div
                      key={parcel.parcel_id}
                      onClick={() => onSelectBarrenParcel(isSelected ? null : parcel)}
                      className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-purple-950/30 border-purple-500 ring-1 ring-purple-500/40"
                          : "bg-neutral-900/60 border-neutral-800/80 hover:bg-neutral-850 hover:border-purple-500/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-white text-xs">{parcel.name}</span>
                        <span className="text-xs font-bold text-purple-400">
                          {parcel.area_hectares} ha ({parcel.area_acres} ac)
                        </span>
                      </div>

                      <div className="text-[10px] text-neutral-400 mb-2">
                        <span>Vegetation: {parcel.current_vegetation}</span> •{" "}
                        <span className="text-emerald-400">{parcel.estimated_potential}</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="text-[10px] font-semibold text-neutral-300">
                          Candidate Crops:
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {parcel.candidate_crops.map((crop, cIdx) => (
                            <span
                              key={cIdx}
                              className="text-[9px] font-medium bg-neutral-800/80 text-neutral-200 px-2 py-0.5 rounded-md border border-neutral-700/60"
                            >
                              {crop}
                            </span>
                          ))}
                        </div>
                      </div>

                      {isSelected && (
                        <div className="mt-3 pt-2.5 border-t border-purple-500/20 space-y-2 animate-in fade-in">
                          <div className="p-2 rounded-xl bg-neutral-950 border border-neutral-900 text-[10px] text-neutral-300">
                            <strong>Water Feasibility:</strong> {parcel.water_feasibility}
                          </div>
                          <p className="text-[9px] text-amber-400/90 leading-tight">
                            ⚠️ {parcel.disclaimer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 5. Footer Satellite Transparency */}
        <div className="p-3 border-t border-neutral-800/80 bg-neutral-950/60 text-[10px] text-neutral-500 text-center flex items-center justify-center gap-2">
          <Layers className="h-3.5 w-3.5 text-neutral-600" />
          <span>{data.satellite_source}</span>
        </div>
      </div>

      {/* 6. IMPROVE FARM EFFICIENCY MODAL */}
      {showEfficiencyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col text-left">
            {/* Modal Header */}
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between bg-neutral-850/50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                  <Zap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Farm Operational Efficiency Roadmap
                  </h3>
                  <p className="text-xs text-neutral-400">
                    5-Pillar Agronomic Optimization Plan for {data.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEfficiencyModal(false)}
                className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {data.efficiency_recommendations.map((pillar, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-neutral-950 border border-neutral-850 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
                      {pillar.pillar}
                    </span>
                    <span
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                        pillar.priority === "High"
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {pillar.priority} Priority
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white">{pillar.title}</h4>
                  <p className="text-xs text-neutral-300 leading-relaxed">{pillar.description}</p>

                  <div className="p-2.5 rounded-xl bg-neutral-900 border border-neutral-800/80 text-[11px] text-emerald-400 font-medium">
                    <strong>Projected Impact:</strong> {pillar.impact}
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Action Items:
                    </span>
                    <ul className="space-y-1 text-xs text-neutral-300">
                      {pillar.action_items.map((item, aIdx) => (
                        <li key={aIdx} className="flex items-start gap-2">
                          <Check className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-neutral-800 bg-neutral-950 flex justify-end">
              <button
                onClick={() => setShowEfficiencyModal(false)}
                className="px-5 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold rounded-xl transition-colors"
              >
                Close Roadmap
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
