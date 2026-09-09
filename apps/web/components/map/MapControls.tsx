"use client";

import React, { useState } from "react";
import {
  Plus,
  Minus,
  Locate,
  PenTool,
  RotateCcw,
  Sparkles,
  Search,
  Check,
  X,
  MapPin,
  Compass
} from "lucide-react";

interface MapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocateMe: () => void;
  onExploreDemoFarm: () => void;
  onSearchLocation: (locationName: string, lat: number, lon: number) => void;
  isDrawing: boolean;
  onToggleDrawing: () => void;
  onResetBoundary: () => void;
  hasDrawnPolygon: boolean;
}

const POPULAR_LOCATIONS = [
  { name: "Niphad, Nashik (Demo Farm)", state: "Maharashtra", lat: 20.0788, lon: 74.1115 },
  { name: "Samrala, Ludhiana", state: "Punjab", lat: 30.8350, lon: 76.1920 },
  { name: "Hoshangabad (Narmadapuram)", state: "Madhya Pradesh", lat: 22.7510, lon: 77.7280 },
  { name: "Baramati, Pune", state: "Maharashtra", lat: 18.1520, lon: 74.5770 },
  { name: "Guntur Agricultural Belt", state: "Andhra Pradesh", lat: 16.3067, lon: 80.4365 },
  { name: "Karnal Precision Cluster", state: "Haryana", lat: 29.6857, lon: 76.9905 }
];

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onLocateMe,
  onExploreDemoFarm,
  onSearchLocation,
  isDrawing,
  onToggleDrawing,
  onResetBoundary,
  hasDrawnPolygon
}: MapControlsProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const filteredLocations = POPULAR_LOCATIONS.filter((loc) =>
    loc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    loc.state.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-3 pointer-events-auto select-none">
      {/* 1. Location Search Capsule */}
      <div className="relative">
        <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800/80 rounded-2xl p-1.5 shadow-2xl flex items-center gap-2 max-w-xs transition-all focus-within:border-primary/50">
          <Search className="h-4 w-4 text-neutral-400 ml-2" />
          <input
            type="text"
            placeholder="Search farm, district, village..."
            value={searchQuery}
            onFocus={() => setShowSearchDropdown(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowSearchDropdown(true);
            }}
            className="bg-transparent text-xs text-neutral-100 placeholder-neutral-500 focus:outline-none w-48 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setShowSearchDropdown(false);
              }}
              className="p-1 text-neutral-500 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {showSearchDropdown && (
          <div className="absolute left-0 mt-2 w-72 bg-neutral-900/95 backdrop-blur-2xl border border-neutral-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="px-3 py-1.5 text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
              Agricultural Regions
            </div>
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {filteredLocations.map((loc, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    onSearchLocation(loc.name, loc.lat, loc.lon);
                    setSearchQuery(loc.name);
                    setShowSearchDropdown(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-neutral-800/70 text-neutral-200 hover:text-white flex items-center justify-between transition-colors"
                >
                  <div>
                    <div className="font-semibold">{loc.name}</div>
                    <div className="text-[10px] text-neutral-400">{loc.state}</div>
                  </div>
                  <MapPin className="h-3.5 w-3.5 text-primary/70" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 2. Primary Action Bar: Demo Farm & Boundary Drawing */}
      <div className="flex items-center gap-2">
        {/* Explore Demo Farm Button */}
        <button
          onClick={onExploreDemoFarm}
          className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          title="Jump directly to the 12.4 ha Indian Demonstration Farm"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-200" />
          <span>Explore Demo Farm</span>
        </button>

        {/* Draw / Edit Boundary Toggle */}
        <button
          onClick={onToggleDrawing}
          className={`px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold transition-all ${
            isDrawing
              ? "bg-amber-500 text-neutral-950 ring-2 ring-amber-400/50 animate-pulse"
              : "bg-neutral-900/90 backdrop-blur-xl border border-neutral-800/80 text-neutral-200 hover:text-white hover:border-neutral-700"
          }`}
          title={isDrawing ? "Click points on the map to define boundary" : "Start drawing your farm boundary"}
        >
          <PenTool className="h-3.5 w-3.5" />
          <span>{isDrawing ? "Finish Drawing" : hasDrawnPolygon ? "Redraw Boundary" : "Draw Boundary"}</span>
        </button>

        {hasDrawnPolygon && (
          <button
            onClick={onResetBoundary}
            className="p-2 bg-neutral-900/90 backdrop-blur-xl border border-neutral-800/80 text-neutral-400 hover:text-red-400 hover:border-red-500/30 rounded-2xl shadow-xl transition-all"
            title="Clear farm boundary"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* 3. Floating Vertical Control Capsule (Zoom & Geolocation) */}
      <div className="bg-neutral-900/90 backdrop-blur-xl border border-neutral-800/80 rounded-2xl p-1 shadow-2xl flex flex-col items-center w-10">
        <button
          onClick={onZoomIn}
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-colors"
          title="Zoom In"
        >
          <Plus className="h-4 w-4" />
        </button>

        <div className="h-[1px] w-6 bg-neutral-800 my-0.5" />

        <button
          onClick={onZoomOut}
          className="p-2 text-neutral-300 hover:text-white hover:bg-neutral-800/60 rounded-xl transition-colors"
          title="Zoom Out"
        >
          <Minus className="h-4 w-4" />
        </button>

        <div className="h-[1px] w-6 bg-neutral-800 my-0.5" />

        <button
          onClick={onLocateMe}
          className="p-2 text-neutral-300 hover:text-primary hover:bg-neutral-800/60 rounded-xl transition-colors"
          title="Locate My Position"
        >
          <Locate className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
