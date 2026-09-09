"use client";

import React from "react";
import { Layers, Info } from "lucide-react";

export type MapLayerId =
  | "crop_health"
  | "ndvi"
  | "moisture"
  | "vegetation_density"
  | "crop_growth"
  | "barren_land"
  | "irrigation_risk"
  | "productivity";

interface MapLegendProps {
  activeLayer: MapLayerId;
  isDemo?: boolean;
}

export default function MapLegend({ activeLayer, isDemo = true }: MapLegendProps) {
  const getLegendContent = () => {
    switch (activeLayer) {
      case "ndvi":
        return {
          title: "Vegetation Health (NDVI Index)",
          description: "Normalized Difference Vegetation Index measuring chlorophyll absorption.",
          gradient: "from-[#8B4513] via-[#EAB308] via-[#84CC16] to-[#059669]",
          labels: ["0.10 Barren / Soil", "0.40 Moderate", "0.70 Healthy", "0.90 Dense Canopy"]
        };
      case "moisture":
        return {
          title: "Soil & Crop Moisture Stress",
          description: "Root-zone dielectric hydration & transpiration deficit indicators.",
          gradient: "from-[#0284C7] via-[#06B6D4] via-[#F59E0B] to-[#EF4444]",
          labels: ["High Moisture (80%)", "Optimal (65%)", "Moderate Stress (45%)", "High Deficit (25%)"]
        };
      case "crop_health":
        return {
          title: "Overall Crop Vigor Status",
          description: "Composite index combining canopy biomass, phenology, and leaf integrity.",
          gradient: "from-[#10B981] via-[#FBBF24] to-[#EF4444]",
          labels: ["Optimal / High Vigor", "Moderate Caution", "Severe Stress"]
        };
      case "barren_land":
        return {
          title: "Land Utilization Status",
          description: "Nearby uncultivated parcels identified for potential agricultural development.",
          customItems: [
            { color: "bg-emerald-500", label: "Active Cultivated Farm" },
            { color: "bg-purple-500", label: "Candidate Underutilized Land" },
            { color: "bg-amber-500", label: "Seasonal Fallow / Shrub" }
          ]
        };
      case "irrigation_risk":
        return {
          title: "Irrigation Priority Zones",
          description: "Zones requiring immediate emitter pressure or delivery checks.",
          gradient: "from-[#10B981] via-[#F59E0B] to-[#EF4444]",
          labels: ["Low Risk / Hydrated", "Moderate Priority", "High Irrigation Priority"]
        };
      case "productivity":
        return {
          title: "Yield Productivity Index",
          description: "Estimated relative harvest potential vs regional baseline.",
          gradient: "from-[#6366F1] via-[#3B82F6] to-[#10B981]",
          labels: ["Baseline (1.0x)", "Above Avg (1.1x)", "High Potential (1.25x+)"]
        };
      default:
        return {
          title: "Agricultural Intelligence Layer",
          description: "Spatial multi-spectral overlay for precision farming.",
          gradient: "from-blue-500 to-emerald-500",
          labels: ["Low", "Moderate", "Optimal"]
        };
    }
  };

  const legend = getLegendContent();

  return (
    <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800/80 rounded-2xl p-3.5 shadow-2xl text-xs text-neutral-200 select-none max-w-sm pointer-events-auto transition-all">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 font-bold text-white text-[11px] tracking-wide">
          <Layers className="h-3.5 w-3.5 text-primary" />
          <span>{legend.title}</span>
        </div>
        {isDemo && (
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            Demo Data
          </span>
        )}
      </div>

      <p className="text-[10px] text-neutral-400 leading-tight mb-2.5">
        {legend.description}
      </p>

      {legend.customItems ? (
        <div className="space-y-1.5 pt-1">
          {legend.customItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 text-[10px]">
              <span className={`w-2.5 h-2.5 rounded-full ${item.color} shadow-sm`} />
              <span className="text-neutral-300 font-medium">{item.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className={`h-2.5 w-full rounded-full bg-gradient-to-r ${legend.gradient} shadow-inner`} />
          <div className="flex justify-between text-[9px] text-neutral-400 font-medium px-0.5">
            {legend.labels?.map((label, idx) => (
              <span key={idx}>{label}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
