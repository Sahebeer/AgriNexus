"use client";

import React, { useCallback, useEffect, useState } from "react";
import api from "../../lib/api";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Droplets,
  HelpCircle,
  Info,
  Layers,
  Leaf,
  Loader2,
  RefreshCw,
  Sliders,
  Sparkles,
  Sprout,
  Sun,
  Thermometer,
} from "lucide-react";

interface SoilReport {
  id: number;
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  soil_moisture: number;
  temperature: number;
  humidity: number;
  soil_texture: string;
  test_date: string;
}

interface Farm {
  id: number;
  name: string;
  state: string;
  district: string;
  village: string;
  current_crop: string;
  soil_reports?: SoilReport[];
}

interface RecommendationItem {
  rank: number;
  crop: string;
  model_probability: number;
  season_fit: "in_season" | "perennial" | "off_season";
  season_multiplier: number;
  texture_multiplier: number;
  score: number;
  reasons: string[];
  cautions: string[];
}

interface RecommendationResponse {
  farm_id?: number | null;
  month: number;
  season: string;
  soil_source: string;
  weather_source: string;
  ood_status: "ok" | "soft_ood" | "hard_ood";
  ood_reason?: string | null;
  recommendations: RecommendationItem[];
  model_version: string;
}

interface CropRecommendationModuleProps {
  onBack?: () => void;
}

const MONTHS = [
  { value: 1, label: "January (Rabi)" },
  { value: 2, label: "February (Rabi)" },
  { value: 3, label: "March (Rabi)" },
  { value: 4, label: "April (Zaid)" },
  { value: 5, label: "May (Zaid)" },
  { value: 6, label: "June (Kharif)" },
  { value: 7, label: "July (Kharif)" },
  { value: 8, label: "August (Kharif)" },
  { value: 9, label: "September (Kharif)" },
  { value: 10, label: "October (Kharif)" },
  { value: 11, label: "November (Rabi)" },
  { value: 12, label: "December (Rabi)" },
];

export default function CropRecommendationModule({ onBack }: CropRecommendationModuleProps) {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [selectedFarmId, setSelectedFarmId] = useState<number | "">("");
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth() + 1);
  const [topN, setTopN] = useState<number>(5);

  const [isLoadingFarms, setIsLoadingFarms] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendationResponse | null>(null);

  // Advanced overrides state
  const [showOverrides, setShowOverrides] = useState<boolean>(false);
  const [overrides, setOverrides] = useState({
    nitrogen: "",
    phosphorus: "",
    potassium: "",
    ph: "",
    moisture: "",
    temperature: "",
    humidity: "",
    rainfall: "",
  });

  const fetchFarms = useCallback(async () => {
    setIsLoadingFarms(true);
    setError(null);
    try {
      const res = await api.get("/api/v1/farms/");
      const farmList = res.data || [];
      setFarms(farmList);
      if (farmList.length > 0) {
        setSelectedFarmId((prev) => (prev === "" ? farmList[0].id : prev));
      }
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to load registered farms. Please try again.");
    } finally {
      setIsLoadingFarms(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    api
      .get("/api/v1/farms/")
      .then((res) => {
        if (!ignore) {
          const farmList = res.data || [];
          setFarms(farmList);
          if (farmList.length > 0) {
            setSelectedFarmId((prev) => (prev === "" ? farmList[0].id : prev));
          }
          setIsLoadingFarms(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err?.response?.data?.detail || "Failed to load registered farms. Please try again.");
          setIsLoadingFarms(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const handleOverrideChange = (field: string, val: string) => {
    setOverrides((prev) => ({ ...prev, [field]: val }));
  };

  const handleGenerateRecommendations = async () => {
    setIsSubmitting(true);
    setError(null);

    const payload: any = {
      month: Number(selectedMonth),
      top_n: Number(topN),
    };

    if (selectedFarmId !== "") {
      payload.farm_id = Number(selectedFarmId);
    }

    // Process overrides if filled
    const activeOverrides: any = {};
    Object.entries(overrides).forEach(([k, v]) => {
      if (v.trim() !== "") {
        const num = parseFloat(v);
        if (!isNaN(num)) activeOverrides[k] = num;
      }
    });

    if (Object.keys(activeOverrides).length > 0) {
      payload.overrides = activeOverrides;
    }

    try {
      const res = await api.post("/api/v1/crops/recommend", payload);
      setData(res.data);
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      if (typeof detail === "string") {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg || "Validation error").join(", "));
      } else {
        setError("Failed to compile crop recommendations. Please verify soil inputs.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentFarm = farms.find((f) => f.id === Number(selectedFarmId));
  const hasSoilReport = Boolean(currentFarm?.soil_reports && currentFarm.soil_reports.length > 0);

  return (
    <div className="space-y-6 text-left animate-fade-in pb-12" id="crop-recommendation-root">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              id="crop-rec-back-btn"
              className="p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs hover:bg-slate-50 transition"
              title="Return to console overview"
            >
              <ArrowLeft className="w-5 h-5 text-slate-600" />
            </button>
          )}
          <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
            <Sprout className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Crop Recommendation Engine
            </h1>
            <p className="text-sm text-slate-500">
              Rank the most optimal crops to sow for your field using real-time soil, weather &amp; seasonal intelligence.
            </p>
          </div>
        </div>

        <button
          onClick={fetchFarms}
          id="crop-rec-refresh-farms-btn"
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-2xs self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFarms ? "animate-spin" : ""}`} />
          Refresh Farms
        </button>
      </div>

      {/* Main Parameters Card */}
      <div className="p-6 rounded-3xl bg-white/80 backdrop-blur-md border border-slate-200/80 shadow-xs space-y-6">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-emerald-600" />
          Field &amp; Seasonal Configuration
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Farm selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="crop-rec-farm-select">
              Target Farm Field
            </label>
            <div className="relative">
              <select
                id="crop-rec-farm-select"
                value={selectedFarmId}
                onChange={(e) => setSelectedFarmId(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={isLoadingFarms || isSubmitting}
                className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition disabled:opacity-60"
              >
                {farms.length === 0 ? (
                  <option value="">No farms available</option>
                ) : (
                  farms.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.district}, {f.state}) {f.soil_reports?.length ? "✓ Soil Ready" : "⚠ No Soil Test"}
                    </option>
                  ))
                )}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
            {currentFarm && !hasSoilReport && (
              <p className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                No soil test on record. Please supply soil overrides below.
              </p>
            )}
          </div>

          {/* Month selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="crop-rec-month-select">
              Sowing Month &amp; Season
            </label>
            <div className="relative">
              <select
                id="crop-rec-month-select"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                disabled={isSubmitting}
                className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition disabled:opacity-60"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          {/* Top N Count */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="crop-rec-topn-select">
              Result Depth
            </label>
            <div className="relative">
              <select
                id="crop-rec-topn-select"
                value={topN}
                onChange={(e) => setTopN(Number(e.target.value))}
                disabled={isSubmitting}
                className="w-full appearance-none pl-3.5 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition disabled:opacity-60"
              >
                <option value={3}>Top 3 Ranked Crops</option>
                <option value={5}>Top 5 Ranked Crops (Standard)</option>
                <option value={10}>Top 10 Ranked Crops (Comprehensive)</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Advanced Overrides Accordion */}
        <div className="pt-2">
          <button
            type="button"
            id="crop-rec-toggle-overrides-btn"
            onClick={() => setShowOverrides(!showOverrides)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
          >
            <span>{showOverrides ? "Hide Manual Chemistry & Weather Overrides" : "Configure Custom Soil Chemistry & Weather Overrides"}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showOverrides ? "rotate-180" : ""}`} />
          </button>

          {showOverrides && (
            <div className="mt-4 p-5 rounded-2xl bg-slate-50/70 border border-slate-200/80 space-y-4 animate-fade-in">
              <p className="text-xs text-slate-500">
                Override field readings with custom laboratory values or custom weather assumptions.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1" htmlFor="override-n">
                    Nitrogen (N, mg/kg)
                  </label>
                  <input
                    id="override-n"
                    type="number"
                    min="0"
                    max="1000"
                    placeholder="e.g. 90"
                    value={overrides.nitrogen}
                    onChange={(e) => handleOverrideChange("nitrogen", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1" htmlFor="override-p">
                    Phosphorus (P, mg/kg)
                  </label>
                  <input
                    id="override-p"
                    type="number"
                    min="0"
                    max="1000"
                    placeholder="e.g. 42"
                    value={overrides.phosphorus}
                    onChange={(e) => handleOverrideChange("phosphorus", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1" htmlFor="override-k">
                    Potassium (K, mg/kg)
                  </label>
                  <input
                    id="override-k"
                    type="number"
                    min="0"
                    max="1000"
                    placeholder="e.g. 43"
                    value={overrides.potassium}
                    onChange={(e) => handleOverrideChange("potassium", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1" htmlFor="override-ph">
                    Soil pH (0-14)
                  </label>
                  <input
                    id="override-ph"
                    type="number"
                    step="0.1"
                    min="0"
                    max="14"
                    placeholder="e.g. 6.5"
                    value={overrides.ph}
                    onChange={(e) => handleOverrideChange("ph", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1" htmlFor="override-moisture">
                    Moisture (%)
                  </label>
                  <input
                    id="override-moisture"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 35"
                    value={overrides.moisture}
                    onChange={(e) => handleOverrideChange("moisture", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1" htmlFor="override-temp">
                    Temperature (°C)
                  </label>
                  <input
                    id="override-temp"
                    type="number"
                    step="0.1"
                    placeholder="e.g. 26.5"
                    value={overrides.temperature}
                    onChange={(e) => handleOverrideChange("temperature", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1" htmlFor="override-humidity">
                    Humidity (%)
                  </label>
                  <input
                    id="override-humidity"
                    type="number"
                    min="0"
                    max="100"
                    placeholder="e.g. 70"
                    value={overrides.humidity}
                    onChange={(e) => handleOverrideChange("humidity", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block text-2xs font-semibold text-slate-600 mb-1" htmlFor="override-rainfall">
                    Rainfall (mm)
                  </label>
                  <input
                    id="override-rainfall"
                    type="number"
                    min="0"
                    max="500"
                    placeholder="e.g. 150"
                    value={overrides.rainfall}
                    onChange={(e) => handleOverrideChange("rainfall", e.target.value)}
                    className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="pt-2 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            {currentFarm
              ? `Selected field: ${currentFarm.name} (${currentFarm.district}, ${currentFarm.state})`
              : "Select a farm or configure manual overrides"}
          </p>

          <button
            type="button"
            id="crop-rec-submit-btn"
            onClick={handleGenerateRecommendations}
            disabled={isSubmitting || (farms.length === 0 && !overrides.ph)}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-500 active:scale-98 transition shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Evaluating Agronomic Suitability...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Calculate Best Crops</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div
          className="p-4 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-900 flex items-start gap-3 shadow-xs animate-fade-in"
          id="crop-rec-error-banner"
        >
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold">Evaluation Error</h3>
            <p className="text-xs text-rose-700 mt-0.5">{error}</p>
          </div>
          <button
            onClick={handleGenerateRecommendations}
            id="crop-rec-retry-btn"
            className="px-3 py-1 bg-white border border-rose-200 rounded-lg text-xs font-semibold text-rose-700 hover:bg-rose-100 transition shadow-2xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isSubmitting && (
        <div className="space-y-4 animate-pulse" id="crop-rec-loading-skeleton">
          <div className="h-10 bg-slate-200/70 rounded-2xl w-1/3"></div>
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="h-32 bg-slate-200/50 rounded-3xl border border-slate-200/60"></div>
          ))}
        </div>
      )}

      {/* Hard OOD Warning Banner */}
      {data && data.ood_status === "hard_ood" && (
        <div
          className="p-5 rounded-3xl bg-rose-50/90 border border-rose-300 text-rose-900 space-y-2 shadow-xs animate-fade-in"
          id="crop-rec-hard-ood-banner"
        >
          <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
            <AlertCircle className="w-5 h-5" />
            Biological Plausibility Violation (Hard OOD)
          </div>
          <p className="text-xs text-rose-800">
            The provided soil or environmental readings are chemically hostile or fall outside plausible agricultural
            parameters: <strong>{data.ood_reason}</strong>.
          </p>
          <p className="text-xs text-rose-700">
            Crop recommendations have been withheld to safeguard your farm. Please conduct a soil retest or verify manual
            inputs.
          </p>
        </div>
      )}

      {/* Soft OOD Caution Banner */}
      {data && data.ood_status === "soft_ood" && (
        <div
          className="p-4 rounded-2xl bg-amber-50/90 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs animate-fade-in"
          id="crop-rec-soft-ood-banner"
        >
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-semibold text-amber-800">Operational Caution: </span>
            {data.ood_reason}. Recommendations remain viable but should be cross-verified with local soil tests.
          </div>
        </div>
      )}

      {/* Results List */}
      {data && data.recommendations.length > 0 && !isSubmitting && (
        <div className="space-y-4 animate-fade-in" id="crop-rec-results-container">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Optimal Crop Ranking for {data.season.toUpperCase()} Season
              </h3>
              <p className="text-xs text-slate-500">
                Calculated via {data.soil_source === "latest_soil_report" ? "field soil test" : "custom chemistry"} &amp;{" "}
                {data.weather_source === "live" ? "Open-Meteo microclimate" : "safe weather norms"}. Model: {data.model_version}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                {data.season.toUpperCase()}
              </span>
              <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                {data.recommendations.length} Candidates
              </span>
            </div>
          </div>

          <div className="space-y-3.5">
            {data.recommendations.map((rec) => {
              const isFirst = rec.rank === 1;
              const isSecond = rec.rank === 2;

              let seasonBadgeStyle = "bg-emerald-100 text-emerald-800 border-emerald-200";
              let seasonLabel = "In-Season";
              if (rec.season_fit === "perennial") {
                seasonBadgeStyle = "bg-blue-100 text-blue-800 border-blue-200";
                seasonLabel = "Perennial";
              } else if (rec.season_fit === "off_season") {
                seasonBadgeStyle = "bg-amber-100 text-amber-800 border-amber-200";
                seasonLabel = "Off-Season";
              }

              return (
                <div
                  key={rec.rank}
                  className={`p-5 rounded-3xl bg-white/90 backdrop-blur-md border transition-all duration-200 shadow-xs hover:shadow-md ${
                    isFirst
                      ? "border-emerald-300 ring-2 ring-emerald-500/10"
                      : "border-slate-200/80"
                  }`}
                  id={`crop-rec-item-${rec.rank}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      {/* Rank badge */}
                      <div
                        className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 ${
                          isFirst
                            ? "bg-emerald-500 text-white shadow-xs"
                            : isSecond
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        #{rec.rank}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-slate-900">{rec.crop}</h4>
                          <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold border ${seasonBadgeStyle}`}>
                            {seasonLabel}
                          </span>
                        </div>
                        <p className="text-2xs text-slate-500">
                          Biochemical Fit: {(rec.model_probability * 100).toFixed(1)}% | Season Mult: {rec.season_multiplier}x | Soil Mult: {rec.texture_multiplier}x
                        </p>
                      </div>
                    </div>

                    {/* Overall Score */}
                    <div className="text-right sm:self-center">
                      <div className="text-xs text-slate-400 font-medium">Agronomic Score</div>
                      <div className="text-xl font-black text-slate-900 tracking-tight">
                        {rec.score}
                        <span className="text-xs font-semibold text-slate-500">/100</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Score Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mb-3.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        rec.score >= 70
                          ? "bg-emerald-500"
                          : rec.score >= 50
                          ? "bg-emerald-400"
                          : rec.score >= 30
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                      style={{ width: `${Math.min(100, Math.max(5, rec.score))}%` }}
                    ></div>
                  </div>

                  {/* Reasons & Cautions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                    <div className="space-y-1">
                      <div className="text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Agronomic Drivers
                      </div>
                      {rec.reasons.map((r, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>

                    {rec.cautions.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-2xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                          Operational Cautions
                        </div>
                        {rec.cautions.map((c, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-xs text-amber-800">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                            <span>{c}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State / Initial Greeting */}
      {!data && !isSubmitting && !error && (
        <div
          className="p-10 rounded-3xl bg-white/70 border border-slate-200/80 text-center space-y-3 shadow-2xs"
          id="crop-rec-empty-state"
        >
          <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Sprout className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">Ready for Crop Recommendation</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Select one of your registered farms above or customize specific soil parameters to calculate the highest-yielding
            and most compatible crops for your field.
          </p>
        </div>
      )}
    </div>
  );
}
