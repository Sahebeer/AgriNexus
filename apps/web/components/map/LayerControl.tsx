"use client";

import React, { useState } from "react";
import {
  Layers,
  Map as MapIcon,
  Eye,
  Check,
  ChevronDown,
  Sparkles,
  Droplets,
  Sprout,
  Activity,
  Mountain,
  Compass
} from "lucide-react";
import { MapLayerId } from "./MapLegend";

export type BaseMapStyle = "standard" | "satellite" | "agricultural" | "terrain";

interface LayerControlProps {
  baseStyle: BaseMapStyle;
  onBaseStyleChange: (style: BaseMapStyle) => void;
  activeLayer: MapLayerId;
  onLayerChange: (layer: MapLayerId) => void;
  showZones: boolean;
  onToggleZones: (show: boolean) => void;
}

export default function LayerControl({
  baseStyle,
  onBaseStyleChange,
  activeLayer,
  onLayerChange,
  showZones,
  onToggleZones
}: LayerControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  const layerOptions: { id: MapLayerId; label: string; icon: any; color: string }[] = [
    { id: "crop_health", label: "Crop Health", icon: Sprout, color: "text-emerald-400" },
    { id: "ndvi", label: "NDVI Heatmap", icon: Sparkles, color: "text-green-400" },
    { id: "moisture", label: "Moisture Stress", icon: Droplets, color: "text-blue-400" },
    { id: "vegetation_density", label: "Vegetation Density", icon: Activity, color: "text-amber-400" },
    { id: "crop_growth", label: "Crop Growth Index", icon: Sprout, color: "text-teal-400" },
    { id: "barren_land", label: "Barren / Unused Land", icon: Mountain, color: "text-purple-400" },
    { id: "irrigation_risk", label: "Irrigation Risk", icon: Droplets, color: "text-cyan-400" },
    { id: "productivity", label: "Productivity Index", icon: Sparkles, color: "text-indigo-400" }
  ];

  return (
    <div className="flex flex-col gap-2 pointer-events-auto select-none items-end">
      {/* 1. Apple-Style Base Map Segmented Pill */}
      <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800/80 p-1 rounded-2xl shadow-2xl flex items-center gap-1">
        {(
          [
            { id: "satellite", label: "Satellite" },
            { id: "standard", label: "Standard" },
            { id: "agricultural", label: "Agri" },
            { id: "terrain", label: "Terrain" }
          ] as const
        ).map((style) => {
          const isActive = baseStyle === style.id;
          return (
            <button
              key={style.id}
              onClick={() => onBaseStyleChange(style.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-white text-neutral-900 shadow-md scale-[1.02]"
                  : "text-neutral-400 hover:text-white hover:bg-neutral-800/60"
              }`}
            >
              {style.label}
            </button>
          );
        })}
      </div>

      {/* 2. Floating Agricultural Layer Selector Capsule */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800/80 px-3.5 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-semibold text-neutral-200 hover:text-white hover:border-neutral-700 transition-all"
        >
          <Layers className="h-4 w-4 text-primary" />
          <span>Layer:</span>
          <span className="text-white font-bold">
            {layerOptions.find((l) => l.id === activeLayer)?.label}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-neutral-900/95 backdrop-blur-2xl border border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150 space-y-1">
            <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Agricultural Overlays</span>
            </div>

            <div className="space-y-0.5">
              {layerOptions.map((layer) => {
                const isSelected = activeLayer === layer.id;
                const IconComponent = layer.icon;
                return (
                  <button
                    key={layer.id}
                    onClick={() => {
                      onLayerChange(layer.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-primary/15 text-primary font-semibold border border-primary/20"
                        : "text-neutral-300 hover:bg-neutral-800/70 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <IconComponent className={`h-4 w-4 ${layer.color}`} />
                      <span>{layer.label}</span>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-neutral-800/80 mt-1">
              <label className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-neutral-800/70 cursor-pointer text-xs text-neutral-300 font-medium">
                <span className="flex items-center gap-2">
                  <Compass className="h-3.5 w-3.5 text-neutral-400" />
                  Show Field Micro-Zones
                </span>
                <input
                  type="checkbox"
                  checked={showZones}
                  onChange={(e) => onToggleZones(e.target.checked)}
                  className="rounded border-neutral-700 text-primary focus:ring-0 bg-neutral-800 h-4 w-4 accent-primary"
                />
              </label>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
