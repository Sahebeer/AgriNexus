"use client";

import React, { useEffect, useState } from "react";
import api from "../../lib/api";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Droplets,
  FlaskConical,
  Leaf,
  Loader2,
  RefreshCw,
  Sprout,
  Upload,
} from "lucide-react";

interface Benchmark {
  crop: string;
  target_nitrogen: number;
  target_phosphorus: number;
  target_potassium: number;
  target_ph: number;
  target_moisture: number;
  preferred_textures: string[];
}

interface NutrientAnalysis {
  nutrient: string;
  value: number;
  unit: string;
  target_min: number;
  target_max: number;
  status: string;
  score: number;
}

interface Recommendation {
  material: string;
  application: string;
  reason: string;
  priority: string;
}

interface CropPrediction {
  crop: string;
  probability: number;
}

interface Prediction {
  crop: string;
  health_score: number;
  suitability_score: number;
  suitability: string;
  predicted_crop: string;
  classifier_confidence: number;
  classifier_status: string;
  ood_distance: number;
  ood_reason?: string | null;
  top_predictions: CropPrediction[];
  model_version: string;
  weather_source: string;
  texture_multiplier: number;
  summary: string;
  limiting_factors: string[];
  nutrients: NutrientAnalysis[];
  recommendations: Recommendation[];
  benchmark: Benchmark;
}

interface SoilPredictionModuleProps {
  onBack?: () => void;
}

const TEXTURES = ["Loamy", "Clayey", "Sandy", "Silty", "Peaty"];
const FALLBACK_CROPS = ["rice", "maize", "cotton", "chickpea", "pigeonpeas", "banana"];
const FIT_THRESHOLDS = [
  { min: 80, max: 100, range: "80–100", label: "Excellent" },
  { min: 60, max: 79, range: "60–79", label: "Good" },
  { min: 40, max: 59, range: "40–59", label: "Moderate" },
  { min: 0, max: 39, range: "0–39", label: "Needs attention" },
] as const;

type RGB = readonly [number, number, number];
const FIT_COLOR_STOPS = [
  { at: 0, color: [220, 38, 38] },
  { at: 20, color: [249, 115, 22] },
  { at: 40, color: [245, 158, 11] },
  { at: 60, color: [250, 204, 21] },
  { at: 80, color: [163, 230, 53] },
  { at: 100, color: [34, 197, 94] },
] as const;

const clampScore = (score: number) => Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
const rgbToCss = (rgb: RGB, alpha?: number) => alpha === undefined ? `rgb(${rgb.join(", ")})` : `rgba(${rgb.join(", ")}, ${alpha})`;
const blendRgb = (from: RGB, to: RGB, amount: number): RGB => [
  Math.round(from[0] + (to[0] - from[0]) * amount),
  Math.round(from[1] + (to[1] - from[1]) * amount),
  Math.round(from[2] + (to[2] - from[2]) * amount),
];

const interpolateFitColor = (score: number) => {
  const value = clampScore(score);
  const upperIndex = FIT_COLOR_STOPS.findIndex((stop) => value <= stop.at);
  const upper = FIT_COLOR_STOPS[upperIndex === -1 ? FIT_COLOR_STOPS.length - 1 : upperIndex];
  const lower = FIT_COLOR_STOPS[Math.max(0, (upperIndex === -1 ? FIT_COLOR_STOPS.length : upperIndex) - 1)];
  const ratio = upper.at === lower.at ? 0 : (value - lower.at) / (upper.at - lower.at);
  return blendRgb(lower.color, upper.color, ratio);
};

const adjustBrightness = (rgb: RGB, factor: number): RGB => [
  Math.round(rgb[0] * factor),
  Math.round(rgb[1] * factor),
  Math.round(rgb[2] * factor),
];
const lighten = (rgb: RGB, amount: number): RGB => blendRgb(rgb, [255, 255, 255], amount);

const getFitTone = (score: number) => {
  const clampedScore = clampScore(score);
  const tone = FIT_THRESHOLDS.find(({ min }) => clampedScore >= min) || FIT_THRESHOLDS[FIT_THRESHOLDS.length - 1];
  const color = interpolateFitColor(clampedScore);
  const previousColor = interpolateFitColor(clampedScore - 16);
  const nextColor = interpolateFitColor(clampedScore + 16);
  return {
    ...tone,
    score: clampedScore,
    color: rgbToCss(color),
    badgeText: rgbToCss(adjustBrightness(color, 0.55)),
    border: rgbToCss(color, 0.58),
    badgeBackground: `linear-gradient(135deg, ${rgbToCss(previousColor, 0.14)}, ${rgbToCss(color, 0.22)}, ${rgbToCss(nextColor, 0.16)})`,
    cardBackground: `linear-gradient(135deg, ${rgbToCss(previousColor, 0.08)}, ${rgbToCss(color, 0.17)}, ${rgbToCss(nextColor, 0.11)})`,
    bar: `linear-gradient(90deg, ${rgbToCss(adjustBrightness(previousColor, 0.62))}, ${rgbToCss(adjustBrightness(color, 0.78))}, ${rgbToCss(color)})`,
    headerBackground: `linear-gradient(135deg, ${rgbToCss(adjustBrightness(previousColor, 0.42))}, ${rgbToCss(adjustBrightness(color, 0.52))}, ${rgbToCss(adjustBrightness(nextColor, 0.46))})`,
    headerScore: rgbToCss(lighten(color, 0.68)),
    headerMuted: rgbToCss(lighten(color, 0.42)),
    headerSubtle: rgbToCss(lighten(color, 0.68), 0.82),
  };
};

export default function SoilPredictionModule({ onBack }: SoilPredictionModuleProps) {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [form, setForm] = useState({
    crop: "rice",
    ph: 6.5,
    nitrogen: 90,
    phosphorus: 42,
    potassium: 43,
    moisture: 35,
    texture: "Loamy",
    temperature: 23,
    humidity: 82,
    rainfall: 240,
  });
  const [prediction, setPrediction] = useState<Prediction | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingBenchmarks, setIsLoadingBenchmarks] = useState(true);
  const [isLoadingFarm, setIsLoadingFarm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadBenchmarks = async () => {
      try {
        const response = await api.get<Benchmark[]>("/api/v1/soil/benchmarks");
        setBenchmarks(response.data);
      } catch {
        setBenchmarks(FALLBACK_CROPS.map((crop) => ({
          crop,
          target_nitrogen: 70,
          target_phosphorus: 45,
          target_potassium: 45,
          target_ph: 6.5,
          target_moisture: 32,
          preferred_textures: ["Loamy"],
        })));
      } finally {
        setIsLoadingBenchmarks(false);
      }
    };
    loadBenchmarks();
  }, []);

  const updateNumber = (field: "ph" | "nitrogen" | "phosphorus" | "potassium" | "moisture", value: string) => {
    setForm((current) => ({ ...current, [field]: Number(value) }));
  };

  const predict = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.post<Prediction>("/api/v1/soil/predict", form);
      setPrediction(response.data);
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || "Unable to calculate soil suitability. Please check the inputs and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const loadFromFarm = async () => {
    setIsLoadingFarm(true);
    setError(null);
    try {
      const response = await api.get("/api/v1/farms/");
      const farm = response.data?.[0];
      const report = farm?.soil_reports?.[0];
      if (!farm || !report) {
        throw new Error("No farm soil report is available yet. Add a soil test in Farm & Soil Console first.");
      }
      const requestedCrop = String(farm.current_crop || "").toLowerCase();
      const crop = benchmarks.some((benchmark) => benchmark.crop === requestedCrop) ? requestedCrop : form.crop;
      setForm({
        crop,
        ph: report.ph,
        nitrogen: report.nitrogen,
        phosphorus: report.phosphorus,
        potassium: report.potassium,
        moisture: report.soil_moisture,
        texture: TEXTURES.find((texture) => texture.toLowerCase() === String(report.soil_texture).toLowerCase()) || "Loamy",
        temperature: report.temperature,
        humidity: report.humidity,
        rainfall: form.rainfall,
      });
    } catch (requestError: any) {
      setError(requestError?.message || "Could not load a soil report from your farm.");
    } finally {
      setIsLoadingFarm(false);
    }
  };

  const cropOptions = benchmarks.length ? benchmarks : FALLBACK_CROPS.map((crop) => ({ crop } as Benchmark));
  const overallTone = getFitTone(prediction?.suitability_score ?? 0);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      <div className="clean-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all" aria-label="Back to dashboard">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
            <FlaskConical className="h-5 w-5 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">AI Soil Prediction</h1>
            <p className="text-xs text-slate-500">Compare your soil profile with crop requirements and receive a practical nutrient plan.</p>
          </div>
        </div>
        <button onClick={loadFromFarm} disabled={isLoadingFarm} className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 disabled:opacity-60 transition-colors">
          {isLoadingFarm ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Load from Farm
        </button>
      </div>

      {error && (
        <div className="clean-card p-4 bg-rose-50 border-rose-200 text-rose-800 text-xs flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form onSubmit={predict} className="xl:col-span-5 clean-card p-6 space-y-5">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Field inputs</div>
            <p className="text-xs text-slate-500 mt-1">Use the latest lab or sensor readings for the selected field.</p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Target crop</span>
            <select value={form.crop} onChange={(event) => setForm((current) => ({ ...current, crop: event.target.value }))} disabled={isLoadingBenchmarks} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900">
              {cropOptions.map((benchmark) => <option key={benchmark.crop} value={benchmark.crop}>{benchmark.crop.charAt(0).toUpperCase() + benchmark.crop.slice(1)}</option>)}
            </select>
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between"><label htmlFor="soil-ph" className="text-xs font-bold text-slate-700">Soil pH</label><span className="text-sm font-extrabold text-emerald-700">{form.ph.toFixed(1)}</span></div>
            <input id="soil-ph" type="range" min="0" max="14" step="0.1" value={form.ph} onChange={(event) => updateNumber("ph", event.target.value)} className="w-full accent-emerald-600" />
            <div className="flex justify-between text-[10px] text-slate-400"><span>Acidic</span><span>Neutral</span><span>Alkaline</span></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {([
              ["nitrogen", "Nitrogen (mg/kg)", 0, 300],
              ["phosphorus", "Phosphorus (mg/kg)", 0, 200],
              ["potassium", "Potassium (mg/kg)", 0, 300],
              ["moisture", "Moisture (%)", 0, 100],
            ] as const).map(([field, label, min, max]) => (
              <label key={field} className="block space-y-1.5">
                <span className="text-[11px] font-bold text-slate-700">{label}</span>
                <input type="number" min={min} max={max} step="0.1" value={form[field]} onChange={(event) => updateNumber(field, event.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-900" />
              </label>
            ))}
          </div>

          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Weather features</div>
            <div className="grid grid-cols-3 gap-3">
              {([
                ["temperature", "Temperature (°C)", -20, 60],
                ["humidity", "Humidity (%)", 0, 100],
                ["rainfall", "Rainfall (mm)", 0, 500],
              ] as const).map(([field, label, min, max]) => (
                <label key={field} className="block space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-700">{label}</span>
                  <input type="number" min={min} max={max} step="0.1" value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: Number(event.target.value) }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2.5 text-xs font-semibold text-slate-900" />
                </label>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2">Temperature and humidity load from a farm report; rainfall remains a manual weather input.</p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Soil texture</span>
            <select value={form.texture} onChange={(event) => setForm((current) => ({ ...current, texture: event.target.value }))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-900">
              {TEXTURES.map((texture) => <option key={texture} value={texture}>{texture}</option>)}
            </select>
          </label>

          <button type="submit" disabled={isLoading} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white py-3 text-xs font-bold shadow-sm transition-colors">
            {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sprout className="h-4 w-4" />}
            {isLoading ? "Calculating soil fit..." : "Run soil prediction"}
          </button>
        </form>

        <section className="xl:col-span-7 space-y-6">
          {!prediction ? (
            <div className="clean-card min-h-[420px] flex flex-col items-center justify-center text-center p-8 bg-gradient-to-br from-white to-emerald-50/40">
              <div className="h-16 w-16 rounded-2xl bg-emerald-100 flex items-center justify-center mb-4"><Leaf className="h-8 w-8 text-emerald-700" /></div>
              <h2 className="text-lg font-bold text-slate-900">Your soil health report will appear here</h2>
              <p className="text-xs text-slate-500 max-w-sm mt-2">Enter a field profile or load the latest farm report to see crop suitability, nutrient status, and fertilizer recommendations.</p>
            </div>
          ) : (
            <>
              <div className="clean-card p-6 text-white overflow-hidden relative" style={{ background: overallTone.headerBackground }}>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: overallTone.headerMuted }}><CheckCircle2 className="h-4 w-4" /> Prediction ready</div>
                    <h2 className="text-2xl font-extrabold mt-2">{prediction.crop} soil fit</h2>
                    <p className="text-sm mt-2 max-w-xl" style={{ color: overallTone.headerSubtle }}>{prediction.summary}</p>
                  </div>
                  <div className="shrink-0 text-center rounded-2xl bg-white/10 border border-white/15 p-4 min-w-[118px]" style={{ boxShadow: `0 0 0 1px ${overallTone.border}` }}>
                    <div className="text-4xl font-extrabold" style={{ color: overallTone.headerScore }}>{Math.round(overallTone.score)}%</div>
                    <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: overallTone.headerMuted }}>Suitability score</div>
                    <div className="text-xs font-semibold text-white mt-1">{overallTone.label}</div>
                  </div>
                </div>
              </div>

              <div className={`clean-card p-5 border ${prediction.classifier_status === "confident" ? "bg-emerald-50 border-emerald-200" : prediction.classifier_status === "hard_ood" ? "bg-rose-50 border-rose-200" : "bg-amber-50 border-amber-200"}`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trained crop classifier</div>
                    <div className="text-lg font-extrabold text-slate-900 mt-1">Predicted crop: {prediction.predicted_crop}</div>
                    <p className="text-xs text-slate-600 mt-1">Confidence {Math.round(prediction.classifier_confidence * 100)}% • Status: {prediction.classifier_status.replace("_", " ")} • Weather source: {prediction.weather_source.replace("_", " ")}</p>
                    {prediction.classifier_status !== "confident" && <p className="text-xs font-extrabold text-rose-700 mt-2">Recommendation is not reliable for this input. Verify the soil test and weather values before acting.</p>}
                    {prediction.ood_reason && <p className="text-xs font-semibold text-slate-700 mt-2">{prediction.ood_reason}</p>}
                  </div>
                  <div className="flex gap-2">
                    {prediction.top_predictions.map((candidate) => <div key={candidate.crop} className="rounded-xl bg-white/70 border border-white px-3 py-2 text-center"><div className="text-xs font-bold text-slate-800">{candidate.crop}</div><div className="text-[10px] text-slate-500">{Math.round(candidate.probability * 100)}%</div></div>)}
                  </div>
                </div>
              </div>

              <div className="clean-card p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Nutrient status matrix</h3><p className="text-[11px] text-slate-500 mt-0.5">Compared with the {prediction.crop.toLowerCase()} benchmark.</p></div><div className="flex items-center gap-2"><span className="text-xs font-bold px-2.5 py-1 rounded-lg border" style={{ color: overallTone.badgeText, background: overallTone.badgeBackground, borderColor: overallTone.border }}>{overallTone.label}</span><span className="text-xs font-bold" style={{ color: overallTone.badgeText }}>{Math.round(overallTone.score)}% fit</span></div></div>
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500" role="group" aria-label="Fit score legend"><span className="font-bold text-slate-700">Fit scale:</span>{FIT_THRESHOLDS.map((tone) => { const legendTone = getFitTone((tone.min + tone.max) / 2); return <span key={tone.label} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-1"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: legendTone.color }} aria-hidden="true" />{tone.range} {tone.label}</span>; })}</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {prediction.nutrients.map((nutrient) => {
                    const fitTone = getFitTone(nutrient.score);
                    const statusClass = nutrient.status === "optimal" ? "text-emerald-700 bg-emerald-50 border-emerald-200" : nutrient.status === "high" ? "text-amber-700 bg-amber-50 border-amber-200" : "text-rose-700 bg-rose-50 border-rose-200";
                    return <div key={nutrient.nutrient} className="rounded-xl border p-3" style={{ background: fitTone.cardBackground, borderColor: fitTone.border }}><div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-700">{nutrient.nutrient}</span><div className="flex items-center gap-1.5"><span className="text-[10px] font-bold px-2 py-1 rounded-md border" style={{ color: fitTone.badgeText, background: fitTone.badgeBackground, borderColor: fitTone.border }}>{fitTone.label}</span><span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md border ${statusClass}`}>{nutrient.status}</span></div></div><div className="flex items-end justify-between mt-2"><span className="text-lg font-extrabold text-slate-900">{nutrient.value} <span className="text-[10px] font-medium text-slate-400">{nutrient.unit}</span></span><span className="text-[10px] text-slate-400">Target {nutrient.target_min}–{nutrient.target_max}</span></div><div className="h-1.5 bg-white/70 rounded-full mt-2 overflow-hidden" role="progressbar" aria-label={`${nutrient.nutrient} fit score`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fitTone.score)}><div className="h-full rounded-full" style={{ width: `${Math.max(3, fitTone.score)}%`, background: fitTone.bar }} /></div></div>;
                  })}
                </div>
              </div>

              <div className="clean-card p-6 space-y-4">
                <div className="flex items-center gap-2"><Droplets className="h-4 w-4 text-emerald-600" /><h3 className="text-sm font-bold text-slate-900">Recommended action plan</h3></div>
                <div className="space-y-3">
                  {prediction.recommendations.map((recommendation) => <div key={`${recommendation.material}-${recommendation.application}`} className="rounded-xl bg-slate-50 border border-slate-100 p-4"><div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2"><span className="text-xs font-bold text-slate-900">{recommendation.material}</span><span className={`text-[10px] font-bold uppercase ${recommendation.priority === "high" ? "text-rose-700" : recommendation.priority === "medium" ? "text-amber-700" : "text-emerald-700"}`}>{recommendation.priority} priority</span></div><p className="text-xs text-slate-700 mt-1">{recommendation.application}</p><p className="text-[11px] text-slate-500 mt-1">{recommendation.reason}</p></div>)}
                </div>
                <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-3">Use a local soil lab or agronomist to confirm amendment rates before a large application.</p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
