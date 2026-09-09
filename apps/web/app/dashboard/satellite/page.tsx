"use client";

import React, { useState, useEffect } from "react";
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
  Sprout
} from "lucide-react";

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

export default function SatellitePage() {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [farms, setFarms] = useState<FarmField[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | null>(null);
  const [sarData, setSarData] = useState<SARDiagnostic | null>(null);
  const [history, setHistory] = useState<SARHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's registered farms
  useEffect(() => {
    const fetchFarms = async () => {
      try {
        const res = await api.get("/api/v1/farms/");
        const farmList = res.data || [];
        setFarms(farmList);
        if (farmList.length > 0) {
          setSelectedFarmId(farmList[0].id);
        }
      } catch (err) {
        console.error("Failed to load farms:", err);
        // Fallback to demo field if local farm API empty
        const fallbackFarm = {
          id: 1,
          name: "Field 01 - North Sector",
          current_crop: "Tomato",
          area: 2.5,
          area_unit: "hectares",
          state: "Punjab",
          district: "Ludhiana"
        };
        setFarms([fallbackFarm]);
        setSelectedFarmId(1);
      }
    };
    fetchFarms();
  }, [user]);

  // Load SAR telemetry when selected farm changes
  useEffect(() => {
    if (!selectedFarmId) return;

    const fetchSARData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [latestRes, historyRes] = await Promise.all([
          api.get(`/api/v1/satellite/field/${selectedFarmId}`),
          api.get(`/api/v1/satellite/field/${selectedFarmId}/history`).catch(() => ({ data: [] }))
        ]);
        setSarData(latestRes.data);
        setHistory(historyRes.data || []);
      } catch (err: any) {
        const msg =
          err.response?.data?.detail?.message ||
          err.response?.data?.detail ||
          "Failed to load Sentinel-1 radar observations for this field.";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSARData();
  }, [selectedFarmId]);

  const handleRefresh = async () => {
    if (!selectedFarmId) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/api/v1/satellite/field/${selectedFarmId}`);
      setSarData(res.data);
      showToast("Sentinel-1 telemetry updated successfully!", "success");
    } catch (err: any) {
      showToast("Failed to refresh satellite observations.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedFarm = farms.find((f) => f.id === selectedFarmId);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans pb-16">
      {/* Top Banner Navigation */}
      <header className="glass sticky top-0 z-40 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-800 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Satellite className="h-5 w-5 text-blue-400" />
                Sentinel-1 SAR Satellite Intelligence
              </h1>
              <p className="text-[11px] text-neutral-400 font-medium">
                C-Band Synthetic Aperture Radar (SAR) Telemetry & Anomaly Analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Field Dropdown Selector */}
            {farms.length > 0 && (
              <select
                value={selectedFarmId || ""}
                onChange={(e) => setSelectedFarmId(Number(e.target.value))}
                className="bg-neutral-900 border border-neutral-800 text-xs text-neutral-200 rounded-xl px-3 py-2 font-medium focus:outline-none focus:border-primary/50"
              >
                {farms.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.current_crop})
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-2 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-xl text-neutral-300 transition-colors disabled:opacity-50"
              title="Refresh SAR Observations"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-8 flex-1 w-full space-y-8">
        {/* Banner Alert on Model Derivation */}
        <div className="glass border border-blue-500/20 bg-blue-500/5 rounded-2xl p-4 flex items-start gap-3 text-xs text-neutral-300">
          <Radio className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
          <div className="leading-relaxed">
            <strong className="text-blue-300 font-semibold block mb-0.5">
              Active Radar Earth Observation Pipeline
            </strong>
            Synthetic Aperture Radar (SAR) transmits microwave pulses (C-band 5.4 GHz) independent of cloud cover or darkness.
            Indicators below represent dielectric moisture dynamics and crop canopy volume scattering—not direct leaf-level disease diagnoses.
          </div>
        </div>

        {error ? (
          <div className="glass border border-amber-500/20 rounded-3xl p-8 text-center space-y-4">
            <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Observation Telemetry Notice</h3>
            <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">{error}</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs font-semibold text-neutral-200 hover:border-neutral-700 transition-colors"
            >
              Retry Satellite Acquisition
            </button>
          </div>
        ) : isLoading && !sarData ? (
          /* Loading Skeleton */
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass h-32 rounded-2xl bg-neutral-900/40 border border-neutral-850"></div>
            ))}
          </div>
        ) : sarData ? (
          <>
            {/* Primary Telemetry Card Header */}
            <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
                <div>
                  <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                    <span>{sarData.field_name}</span>
                    <span className="text-neutral-700">•</span>
                    <span className="text-primary">{sarData.crop}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    Sentinel-1 SAR Radar Pass
                    <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                      {sarData.orbit || "ASCENDING"} ORBIT
                    </span>
                  </h2>
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-neutral-400">
                  <div className="flex items-center gap-1.5 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-neutral-800">
                    <Calendar className="h-4 w-4 text-neutral-500" />
                    <span>Pass Date: {sarData.observation_date}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-neutral-800">
                    <Compass className="h-4 w-4 text-neutral-500" />
                    <span>Pol: {sarData.polarization || "VV+VH"}</span>
                  </div>
                </div>
              </div>

              {/* 4-Metric Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* VV Metric */}
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 space-y-2 text-left">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                    VV Polarization
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {sarData.features.vv} <span className="text-xs text-neutral-500 font-normal">dB</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    Vertical co-polarized backscatter reflecting soil moisture & direct return.
                  </p>
                </div>

                {/* VH Metric */}
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 space-y-2 text-left">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                    VH Cross-Pol
                  </div>
                  <div className="text-2xl font-bold text-primary">
                    {sarData.features.vh} <span className="text-xs text-neutral-500 font-normal">dB</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    Cross-polarized volume scattering driven by vegetative canopy structure.
                  </p>
                </div>

                {/* VV/VH Ratio Metric */}
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 space-y-2 text-left">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                    VV / VH Ratio
                  </div>
                  <div className="text-2xl font-bold text-amber-400">
                    {sarData.features.vv_vh_ratio} <span className="text-xs text-neutral-500 font-normal">dB</span>
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    Normalized index sensitive to crop phenology and biomass saturation.
                  </p>
                </div>

                {/* Radar Vegetation Index */}
                <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 space-y-2 text-left">
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                    Radar Vegetation (RVI)
                  </div>
                  <div className="text-2xl font-bold text-blue-400">
                    {sarData.features.radar_vegetation_index ?? 0.52}
                  </div>
                  <p className="text-[10px] text-neutral-400 leading-tight">
                    Dual-pol canopy vigor index (ranges 0.0 bare soil to 1.0 full canopy).
                  </p>
                </div>
              </div>
            </div>

            {/* Condition & Multi-Pass Dynamics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Field Condition Assessment */}
              <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary">
                      <Sprout className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        Agricultural Classification
                      </div>
                      <h3 className="text-base font-bold text-white">Radar Condition Status</h3>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary uppercase">
                    {sarData.condition.replace("_", " ")}
                  </span>
                </div>

                <div className="space-y-4 text-left">
                  <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-850 space-y-2">
                    <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">
                      Agronomic Interpretation
                    </div>
                    <p className="text-xs md:text-sm text-neutral-200 leading-relaxed">
                      {sarData.interpretation}
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-2xl bg-neutral-950 border border-neutral-900">
                    <span className="text-xs text-neutral-400 font-medium">Model Certainty</span>
                    <span className="text-xs font-bold text-primary">
                      {Math.round(sarData.confidence * 100)}% Confidence
                    </span>
                  </div>
                </div>
              </div>

              {/* Temporal Anomaly Tracking */}
              <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                      <Activity className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
                        Sequential Analysis
                      </div>
                      <h3 className="text-base font-bold text-white">Multi-Pass Dynamics</h3>
                    </div>
                  </div>
                  {sarData.temporal?.anomaly_detected ? (
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">
                      Anomaly Detected
                    </span>
                  ) : (
                    <span className="text-xs font-bold px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary">
                      Normal Trajectory
                    </span>
                  )}
                </div>

                <div className="space-y-4 text-left">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-850">
                      <span className="text-[10px] text-neutral-500 font-semibold uppercase block mb-1">
                        ΔVV (Moisture Shift)
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          sarData.temporal && sarData.temporal.delta_vv > 0 ? "text-blue-400" : "text-neutral-300"
                        }`}
                      >
                        {sarData.temporal ? (sarData.temporal.delta_vv >= 0 ? `+${sarData.temporal.delta_vv}` : sarData.temporal.delta_vv) : "0.0"}{" "}
                        <span className="text-[10px] text-neutral-600">dB</span>
                      </span>
                    </div>

                    <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-850">
                      <span className="text-[10px] text-neutral-500 font-semibold uppercase block mb-1">
                        ΔVH (Canopy Shift)
                      </span>
                      <span
                        className={`text-lg font-bold ${
                          sarData.temporal && sarData.temporal.delta_vh > 0 ? "text-primary" : "text-neutral-300"
                        }`}
                      >
                        {sarData.temporal ? (sarData.temporal.delta_vh >= 0 ? `+${sarData.temporal.delta_vh}` : sarData.temporal.delta_vh) : "0.0"}{" "}
                        <span className="text-[10px] text-neutral-600">dB</span>
                      </span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-900 space-y-1">
                    <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block">
                      Trajectory Indicator
                    </span>
                    <p className="text-xs text-neutral-300 capitalize">
                      {sarData.temporal?.trend.replace("_", " ") || "Baseline Established"}
                    </p>
                    {sarData.temporal?.anomaly_reason && (
                      <p className="text-[11px] text-amber-400 pt-1">
                        Notice: {sarData.temporal.anomaly_reason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Historical Observations Table */}
            {history.length > 0 && (
              <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Historical Satellite Passes
                  </h3>
                  <span className="text-xs text-neutral-400 font-medium">
                    {history.length} observations logged
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-neutral-300">
                    <thead className="text-[10px] uppercase text-neutral-500 font-bold border-b border-neutral-850">
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
                    <tbody className="divide-y divide-neutral-900 font-medium">
                      {history.map((h, idx) => (
                        <tr key={idx} className="hover:bg-neutral-900/50 transition-colors">
                          <td className="py-3 px-4 text-white font-semibold">{h.observation_date}</td>
                          <td className="py-3 px-4">{h.satellite}</td>
                          <td className="py-3 px-4">{h.orbit}</td>
                          <td className="py-3 px-4 text-blue-400">{h.vv}</td>
                          <td className="py-3 px-4 text-primary">{h.vh}</td>
                          <td className="py-3 px-4 text-amber-400">{h.vv_vh_ratio}</td>
                          <td className="py-3 px-4 capitalize">{h.condition.replace("_", " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        ) : null}
      </main>
    </div>
  );
}
