"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import {
  ArrowLeft,
  Satellite,
  Radio,
  Activity,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  Compass,
  Droplets,
  Sprout,
  Map as MapIcon,
  ShieldAlert
} from "lucide-react";

import LayerControl, { BaseMapStyle } from "../../../components/map/LayerControl";
import MapLegend, { MapLayerId } from "../../../components/map/MapLegend";
import MapControls from "../../../components/map/MapControls";
import FarmAnalysisPanel, {
  FarmIntelligenceData,
  FarmZone,
  BarrenParcel
} from "../../../components/farm/FarmAnalysisPanel";

// Dynamically import FarmMap to disable SSR for Leaflet window dependencies
const FarmMap = dynamic(() => import("../../../components/map/FarmMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-neutral-900 rounded-3xl border border-neutral-800 flex items-center justify-center text-neutral-400 text-xs font-semibold animate-pulse">
      <Satellite className="h-6 w-6 text-primary animate-spin mr-2" />
      Loading Agricultural Map Tiles & Multi-Spectral Overlays...
    </div>
  )
});

interface FarmField {
  id: number;
  name: string;
  current_crop: string;
  area: number;
  area_unit: string;
  state: string;
  district: string;
  gps_coordinates?: string;
}

interface SARDiagnostic {
  status: string;
  field_id: number;
  field_name: string;
  crop: string;
  satellite: string;
  observation_date: string;
  orbit?: string;
  polarization?: string;
  features: {
    vv: number;
    vh: number;
    vv_vh_ratio: number;
    radar_vegetation_index?: number;
    normalized_polarization_ratio?: number;
  };
  temporal?: {
    has_temporal_history: boolean;
    observations_count: number;
    delta_vv: number;
    delta_vh: number;
    delta_ratio: number;
    trend: string;
    anomaly_detected: boolean;
    anomaly_reason?: string | null;
  };
  condition: string;
  confidence: number;
  interpretation: string;
}

interface SARHistoryItem {
  id: number;
  observation_date: string;
  satellite: string;
  orbit: string;
  vv: number;
  vh: number;
  vv_vh_ratio: number;
  condition: string;
  confidence: number;
}

// [[south, west], [north, east]] of a GeoJSON boundary string or a [lon, lat] ring.
function boundsOf(boundary: any): [[number, number], [number, number]] | null {
  try {
    let g = typeof boundary === "string" ? JSON.parse(boundary) : boundary;
    if (g?.type === "FeatureCollection") g = g.features?.[0]?.geometry;
    if (g?.type === "Feature") g = g.geometry;
    const pts: number[][] = Array.isArray(g)
      ? g
      : g?.type === "Polygon" ? g.coordinates.flat() : g?.type === "MultiPolygon" ? g.coordinates.flat(2) : [];
    if (pts.length < 3) return null;
    const lons = pts.map((p) => p[0]);
    const lats = pts.map((p) => p[1]);
    return [[Math.min(...lats), Math.min(...lons)], [Math.max(...lats), Math.max(...lons)]];
  } catch {
    return null;
  }
}

export default function SatellitePage() {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  // Mode: "map" (Smart Farm Maps & Intelligence) vs "radar" (Sentinel-1 SAR passes)
  const [activeViewMode, setActiveViewMode] = useState<"map" | "radar">("map");

  // Map & Overlays State
  const [baseStyle, setBaseStyle] = useState<BaseMapStyle>("satellite");
  const [activeLayer, setActiveLayer] = useState<MapLayerId>("ndvi");
  const [showZones, setShowZones] = useState<boolean>(true);

  // Geographic coordinates & zoom
  const [mapCenter, setMapCenter] = useState<[number, number]>([22.5, 79.0]); // India overview until a farm loads
  const [mapZoom, setMapZoom] = useState<number>(5);

  // Boundary Drawing State
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawnVertices, setDrawnVertices] = useState<[number, number][]>([]);
  const [customPolygon, setCustomPolygon] = useState<[number, number][] | null>(null);

  // Farm Intelligence Data
  const [farmData, setFarmData] = useState<FarmIntelligenceData | null>(null);
  const [selectedZone, setSelectedZone] = useState<FarmZone | null>(null);
  const [selectedBarrenParcel, setSelectedBarrenParcel] = useState<BarrenParcel | null>(null);
  const [isMapLoading, setIsMapLoading] = useState<boolean>(false);

  // SAR Radar State
  const [farms, setFarms] = useState<FarmField[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [farmsLoaded, setFarmsLoaded] = useState<boolean>(false);
  const [farmError, setFarmError] = useState<string | null>(null);
  const [isSavingBoundary, setIsSavingBoundary] = useState<boolean>(false);
  const [focusBounds, setFocusBounds] = useState<{ bounds: [[number, number], [number, number]]; key: number } | null>(null);
  const focusOn = (boundary: any) => {
    const b = boundsOf(boundary);
    if (b) setFocusBounds({ bounds: b, key: Date.now() });
  };
  const [sarData, setSarData] = useState<SARDiagnostic | null>(null);
  const [sarHistory, setSarHistory] = useState<SARHistoryItem[]>([]);
  const [isSarLoading, setIsSarLoading] = useState<boolean>(false);
  const [sarError, setSarError] = useState<string | null>(null);

  // Satellite analysis of one of the signed-in user's own farms (server checks ownership).
  const loadFarmAnalysis = async (farmId: number) => {
    focusOn((farms.find((f: any) => f.id === farmId) as any)?.boundary_geojson);
    setIsMapLoading(true);
    setFarmError(null);
    try {
      const res = await api.get(`/api/v1/satellite-maps/farms/${farmId}`, { timeout: 150000 });
      setFarmData(res.data);
      if (res.data.boundary) focusOn(res.data.boundary);
      setCustomPolygon(null);
      setDrawnVertices([]);
      setIsDrawing(false);
      showToast(`${res.data.name} loaded (${res.data.area_hectares} ha, ${res.data.is_demo ? "demo NDVI" : "Sentinel-2 NDVI"})`, "success");
    } catch (err: any) {
      console.error("Failed to load farm analysis:", err);
      setFarmData(null);
      const detail = err.response?.data?.detail;
      setFarmError(typeof detail === "string" ? detail : "Could not load satellite analysis for this farm.");
    } finally {
      setIsMapLoading(false);
    }
  };

  // 1. Load the user's own farms (no demo/fallback farm is ever shown)
  useEffect(() => {
    const fetchFarms = async () => {
      try {
        const res = await api.get("/api/v1/farms/");
        const farmList = res.data || [];
        setFarms(farmList);
        setSelectedFarmId(farmList.length > 0 ? farmList[0].id : null);
        if (farmList.length === 0) setFarmData(null);
      } catch (err) {
        console.error("Failed to load user farms:", err);
        setFarms([]);
      } finally {
        setFarmsLoaded(true);
      }
    };
    fetchFarms();
  }, [user]);

  // 2. Load map analysis for the selected farm
  useEffect(() => {
    if (selectedFarmId) loadFarmAnalysis(selectedFarmId);
  }, [selectedFarmId]);

  // 3. Load SAR Telemetry
  useEffect(() => {
    if (!selectedFarmId) return;

    const fetchSARData = async () => {
      setIsSarLoading(true);
      setSarError(null);
      try {
        const [latestRes, historyRes] = await Promise.all([
          api.get(`/api/v1/satellite/field/${selectedFarmId}`),
          api.get(`/api/v1/satellite/field/${selectedFarmId}/history`).catch(() => ({ data: [] }))
        ]);
        setSarData(latestRes.data);
        setSarHistory(historyRes.data || []);
      } catch (err: any) {
        const msg =
          err.response?.data?.detail?.message ||
          err.response?.data?.detail ||
          "Failed to load Sentinel-1 radar observations for this field.";
        setSarError(msg);
      } finally {
        setIsSarLoading(false);
      }
    };

    fetchSARData();
  }, [selectedFarmId]);

  // 4. Map Control Handlers
  const handleZoomIn = () => setMapZoom((prev) => Math.min(prev + 1, 19));
  const handleZoomOut = () => setMapZoom((prev) => Math.max(prev - 1, 4));

  const handleLocateMe = () => {
    if (typeof window !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setMapCenter([lat, lon]);
          setMapZoom(16);
          showToast(`Located position: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, "success");
        },
        (err) => {
          showToast("Geolocation unavailable or denied.", "info");
        }
      );
    } else {
      showToast("Geolocation is not supported by your browser.", "info");
    }
  };

  const handleSearchLocation = (locationName: string, lat: number, lon: number) => {
    setMapCenter([lat, lon]);
    setMapZoom(15);
    showToast(`Navigated to ${locationName}`, "success");
  };

  const handleToggleDrawing = () => {
    if (!isDrawing) {
      setDrawnVertices([]);
      setCustomPolygon(null);
      setIsDrawing(true);
      showToast("Click on map to mark field vertices. Click the starting point to finish.", "info");
    } else {
      handleCompletePolygon();
    }
  };

  const handleAddVertex = (lat: number, lon: number) => {
    setDrawnVertices((prev) => [...prev, [lat, lon]]);
  };

  const handleCompletePolygon = async () => {
    if (drawnVertices.length < 3) {
      showToast("A farm boundary requires at least 3 points.", "error");
      return;
    }

    // Close polygon
    const closed = [...drawnVertices, drawnVertices[0]];
    setCustomPolygon(closed);
    setIsDrawing(false);

    // Convert to GeoJSON [[lon, lat], ...]
    const geoJsonCoords = closed.map((p) => [p[1], p[0]]);

    // Trigger analysis
    await analyzeBoundary(geoJsonCoords);
  };

  const analyzeBoundary = async (geoJsonCoords: number[][]) => {
    setIsMapLoading(true);
    try {
      const res = await api.post("/api/v1/satellite-maps/analyze-boundary", {
        boundary: geoJsonCoords,
        crop: "Wheat",
        farm_name: "Drawn Boundary (unsaved)"
      }, { timeout: 150000 });
      setFarmData(res.data);
      showToast(`Analyzed ${res.data.area_hectares} ha (${res.data.area_acres} acres) with AI Reasoning!`, "success");
    } catch (err: any) {
      console.error("Boundary analysis failed:", err);
      showToast("Analysis failed. Please ensure a valid closed boundary.", "error");
    } finally {
      setIsMapLoading(false);
    }
  };

  // Save the drawn polygon as the selected farm's boundary (reuses the KML/GeoJSON upload API).
  const saveBoundaryToFarm = async () => {
    if (!customPolygon || !selectedFarmId) return;
    const farm = farms.find((f: any) => f.id === selectedFarmId) as any;
    const geojson = {
      type: "Feature",
      properties: { name: farm?.name || "Drawn boundary" },
      geometry: { type: "Polygon", coordinates: [customPolygon.map((p) => [p[1], p[0]])] },
    };
    const form = new FormData();
    form.append("file", new Blob([JSON.stringify(geojson)], { type: "application/geo+json" }), "boundary.geojson");
    setIsSavingBoundary(true);
    try {
      const res = await api.post(`/api/v1/farms/${selectedFarmId}/boundary`, form, {
        timeout: 60000,
        headers: { "Content-Type": "multipart/form-data" },
      });
      showToast(`Boundary saved to ${farm?.name || "farm"} (${res.data.area?.hectares} ha)`, "success");
      await loadFarmAnalysis(selectedFarmId);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      showToast(typeof detail === "string" ? detail : "Could not save boundary.", "error");
    } finally {
      setIsSavingBoundary(false);
    }
  };

  const handleResetBoundary = () => {
    setDrawnVertices([]);
    setCustomPolygon(null);
    setIsDrawing(false);
    if (selectedFarmId) loadFarmAnalysis(selectedFarmId);
    else setFarmData(null);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans pb-16">
      {/* ─── Top Header & Navigation ─────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Satellite className="h-5 w-5 text-emerald-600" />
                AgriNexus Smart Farm Maps & Earth Intelligence
              </h1>
              <p className="text-xs text-slate-500 font-medium">
                Sentinel-2 L2A NDVI (Element84) • Field Boundary Drawing • Rule-based Agronomy
              </p>
            </div>
          </div>

          {/* View Mode Segmented Switcher */}
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 border border-slate-200 p-1 rounded-xl flex items-center gap-1">
              <button
                onClick={() => setActiveViewMode("map")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeViewMode === "map"
                    ? "bg-white text-emerald-950 shadow-sm border border-slate-200/80"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <MapIcon className="h-3.5 w-3.5 text-emerald-600" />
                <span>Smart Maps</span>
              </button>

              <button
                onClick={() => setActiveViewMode("radar")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeViewMode === "radar"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                }`}
              >
                <Radio className="h-3.5 w-3.5" />
                <span>SAR Radar Passes</span>
              </button>
            </div>

            {/* Quick Admin Demonstration Link */}
            <Link
              href="/admin"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-xl text-xs font-semibold shadow-sm transition-colors"
            >
              <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
              <span>Admin Demo</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Main Content Views ─────────────────────────────────────────── */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 py-6 flex flex-col">
        {activeViewMode === "map" ? (
          /* ─── VIEW 1: SMART AGRICULTURAL MAPS INTERFACE ───────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
            {/* Left 8 Columns: Apple Maps Style Interactive Map Container */}
            <div className="lg:col-span-8 relative h-[78vh] min-h-[550px] w-full flex flex-col rounded-2xl overflow-hidden border border-slate-200 shadow-sm">
              {/* Floating Top Left Controls */}
              <div className="absolute top-4 left-4 z-10">
                <MapControls
                  onZoomIn={handleZoomIn}
                  onZoomOut={handleZoomOut}
                  onLocateMe={handleLocateMe}
                  onShowMyFarm={() => selectedFarmId && loadFarmAnalysis(selectedFarmId)}
                  onSearchLocation={handleSearchLocation}
                  isDrawing={isDrawing}
                  onToggleDrawing={handleToggleDrawing}
                  onResetBoundary={handleResetBoundary}
                  hasDrawnPolygon={!!customPolygon || drawnVertices.length > 0}
                />
              </div>

              {/* Floating Top Right Base & Layer Selectors */}
              <div className="absolute top-4 right-4 z-10">
                <LayerControl
                  baseStyle={baseStyle}
                  onBaseStyleChange={setBaseStyle}
                  activeLayer={activeLayer}
                  onLayerChange={setActiveLayer}
                  showZones={showZones}
                  onToggleZones={setShowZones}
                />
              </div>

              {/* Floating Bottom Left Continuous Gradient Legend */}
              <div className="absolute bottom-4 left-4 z-10">
                <MapLegend activeLayer={activeLayer} isDemo={farmData?.is_demo ?? true} />
              </div>

              {/* Core Interactive Leaflet Map Component */}
              <FarmMap
                baseStyle={baseStyle}
                activeLayer={activeLayer}
                showZones={showZones}
                farmData={farmData}
                selectedZone={selectedZone}
                onSelectZone={setSelectedZone}
                selectedBarrenParcel={selectedBarrenParcel}
                onSelectBarrenParcel={setSelectedBarrenParcel}
                isDrawing={isDrawing}
                drawnVertices={drawnVertices}
                onAddVertex={handleAddVertex}
                onCompletePolygon={handleCompletePolygon}
                customPolygon={customPolygon}
                center={mapCenter}
                zoom={mapZoom}
                focusBounds={focusBounds}
              />
            </div>

            {/* Right 4 Columns: Farm Intelligence & AI Reasoning Side Panel */}
            <div className="lg:col-span-4 w-full">
              {farmsLoaded && farms.length === 0 ? (
                <div className="mb-4 p-5 rounded-2xl border border-dashed border-slate-300 bg-white text-center space-y-2">
                  <h3 className="text-sm font-bold text-slate-900">No farms on this account yet</h3>
                  <p className="text-xs text-slate-500">
                    Add a farm with its boundary on the Profile page (draw it or import a KML/GeoJSON file) to see its satellite analysis here.
                  </p>
                  <a href="/dashboard/profile" className="inline-block text-xs font-semibold text-emerald-700 hover:underline">Add a farm →</a>
                </div>
              ) : farms.length > 0 && (
                <div className="mb-4">
                  <label className="block text-[10px] uppercase font-semibold text-slate-500 mb-1">Farm</label>
                  <select
                    value={selectedFarmId ?? ""}
                    onChange={(e) => setSelectedFarmId(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {farms.map((f: any) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                  {customPolygon && !isDrawing && (
                    <button
                      onClick={saveBoundaryToFarm}
                      disabled={isSavingBoundary}
                      className="mt-2 w-full rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold py-2"
                    >
                      {isSavingBoundary
                        ? "Saving boundary…"
                        : `Save drawn boundary to ${(farms.find((f: any) => f.id === selectedFarmId) as any)?.name || "this farm"}`}
                    </button>
                  )}
                </div>
              )}
              <FarmAnalysisPanel
                emptyMessage={farmError || (farmsLoaded && farms.length === 0 ? "No farms yet. Add one on the Profile page, or draw a boundary to try an analysis." : undefined)}
                data={farmData}
                isLoading={isMapLoading}
                selectedZone={selectedZone}
                onSelectZone={setSelectedZone}
                selectedBarrenParcel={selectedBarrenParcel}
                onSelectBarrenParcel={setSelectedBarrenParcel}
                onAnalyzeBoundary={() => {
                  if (customPolygon) {
                    analyzeBoundary(customPolygon.map((p) => [p[1], p[0]]));
                  }
                }}
                hasBoundary={!!customPolygon || drawnVertices.length >= 3}
              />
            </div>
          </div>
        ) : (
          /* ─── VIEW 2: SENTINEL-1 SAR RADAR OBSERVATIONS ───────────────── */
          <div className="space-y-6">
            {/* SAR Banner */}
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900 shadow-sm">
              <Radio className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5 animate-pulse" />
              <div className="leading-relaxed">
                <strong className="text-blue-950 font-bold block mb-0.5">
                  Sentinel-1 C-Band SAR Microwave Telemetry
                </strong>
                Synthetic Aperture Radar penetrates cloud cover and darkness to measure dielectric moisture dynamics and canopy volume scattering.
              </div>
            </div>

            {sarError ? (
              <div className="clean-card p-8 text-center space-y-4">
                <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
                <h3 className="text-lg font-bold text-slate-900">Observation Telemetry Notice</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">{sarError}</p>
              </div>
            ) : isSarLoading && !sarData ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-32 rounded-2xl bg-slate-100 border border-slate-200" />
                ))}
              </div>
            ) : sarData ? (
              <div className="space-y-6">
                {/* SAR Telemetry Card Header */}
                <div className="clean-card p-6 md:p-8 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
                    <div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                        <span>{sarData.field_name}</span>
                        <span className="text-slate-300">•</span>
                        <span className="text-emerald-700 font-semibold">{sarData.crop}</span>
                      </div>
                      <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                        Sentinel-1 SAR Radar Pass
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                          {sarData.orbit || "ASCENDING"} ORBIT
                        </span>
                      </h2>
                    </div>

                    <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <Calendar className="h-4 w-4 text-slate-400" />
                        <span>Pass Date: {sarData.observation_date}</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                        <Compass className="h-4 w-4 text-slate-400" />
                        <span>Pol: {sarData.polarization || "VV+VH"}</span>
                      </div>
                    </div>
                  </div>

                  {/* 4-Metric Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-left">
                      <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                        VV Polarization
                      </div>
                      <div className="text-2xl font-bold text-slate-900">
                        {sarData.features.vv} <span className="text-xs text-slate-400 font-normal">dB</span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-tight">
                        Vertical co-polarized backscatter reflecting soil moisture dynamics.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-left">
                      <div className="text-[11px] text-emerald-800 font-bold uppercase tracking-wider">
                        VH Cross-Pol
                      </div>
                      <div className="text-2xl font-bold text-emerald-700">
                        {sarData.features.vh} <span className="text-xs text-emerald-600/70 font-normal">dB</span>
                      </div>
                      <p className="text-[11px] text-emerald-700 leading-tight">
                        Cross-polarized volume scattering driven by canopy structure.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-2 text-left">
                      <div className="text-[11px] text-amber-800 font-bold uppercase tracking-wider">
                        VV / VH Ratio
                      </div>
                      <div className="text-2xl font-bold text-amber-700">
                        {sarData.features.vv_vh_ratio} <span className="text-xs text-amber-600/70 font-normal">dB</span>
                      </div>
                      <p className="text-[11px] text-amber-700 leading-tight">
                        Normalized index sensitive to crop phenology and biomass.
                      </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2 text-left">
                      <div className="text-[11px] text-blue-800 font-bold uppercase tracking-wider">
                        Radar Vegetation (RVI)
                      </div>
                      <div className="text-2xl font-bold text-blue-700">
                        {sarData.features.radar_vegetation_index ?? 0.52}
                      </div>
                      <p className="text-[11px] text-blue-700 leading-tight">
                        Dual-pol canopy vigor index (0.0 bare soil to 1.0 full canopy).
                      </p>
                    </div>
                  </div>
                </div>

                {/* History Table */}
                {sarHistory.length > 0 && (
                  <div className="clean-card p-6 md:p-8 space-y-4 text-left">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      Historical Satellite Radar Passes
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-600">
                        <thead className="text-[10px] uppercase text-slate-400 font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-3 px-4">Pass Date</th>
                            <th className="py-3 px-4">Satellite</th>
                            <th className="py-3 px-4">Orbit</th>
                            <th className="py-3 px-4">VV (dB)</th>
                            <th className="py-3 px-4">VH (dB)</th>
                            <th className="py-3 px-4">VV/VH (dB)</th>
                            <th className="py-3 px-4">Condition</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {sarHistory.map((h, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-3 px-4 text-slate-900 font-semibold">{h.observation_date}</td>
                              <td className="py-3 px-4">{h.satellite}</td>
                              <td className="py-3 px-4">{h.orbit}</td>
                              <td className="py-3 px-4 text-blue-700 font-semibold">{h.vv}</td>
                              <td className="py-3 px-4 text-emerald-700 font-semibold">{h.vh}</td>
                              <td className="py-3 px-4 text-amber-700 font-semibold">{h.vv_vh_ratio}</td>
                              <td className="py-3 px-4 capitalize">{h.condition.replace("_", " ")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
}
