"use client";

import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { 
  ArrowLeft, 
  CloudSun, 
  Droplets, 
  Wind, 
  Compass, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw,
  Sun,
  CloudRain
} from "lucide-react";

interface WeatherModuleProps {
  onBack?: () => void;
}

// Simple, transparent spray rule from real forecast values (not a model).
function sprayAdvice(rainChance: number | undefined, wind: number | undefined): string {
  if ((rainChance ?? 0) >= 60 || (wind ?? 0) > 20) return "Avoid";
  if ((rainChance ?? 0) >= 30 || (wind ?? 0) > 15) return "Moderate";
  return "Optimal";
}

export function WeatherProvenance({ data }: { data: any }) {
  const agri = data?.agri_indices;
  const isDemo = data?.source === "demo";
  return (
    <div className="clean-card p-4 space-y-3 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`px-2 py-0.5 rounded font-bold uppercase text-[10px] border ${isDemo ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
          {isDemo ? "Demo data" : `Source: ${data?.source ?? "unknown"}`}
        </span>
        {data?.location_basis && (
          <span className="text-slate-500">
            Location: {data.location_basis}
            {data.lat != null && ` (${Number(data.lat).toFixed(3)}, ${Number(data.lon).toFixed(3)})`}
          </span>
        )}
        {data?.source_note && <span className="text-amber-700">{data.source_note}</span>}
      </div>
      {agri && agri.source !== "unavailable" && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div><span className="text-slate-400 block text-[10px] uppercase">GDD last 30 d (base {agri.gdd_base_c}°C)</span><b>{agri.gdd_last_30d}</b></div>
          <div><span className="text-slate-400 block text-[10px] uppercase">GDD since sowing</span><b>{agri.gdd_since_sowing ?? "n/a"}</b></div>
          <div><span className="text-slate-400 block text-[10px] uppercase">30-day water balance (P - ET0)</span><b>{agri.water_balance_30d_mm} mm</b></div>
          <div><span className="text-slate-400 block text-[10px] uppercase">Drought index</span><b>{agri.drought_index ?? "n/a"}</b> <span className="text-slate-500">({agri.drought_category})</span></div>
          <div className="col-span-2 sm:col-span-4 text-[10px] text-slate-400">
            {agri.source} · as of {agri.as_of} · {agri.drought_method}
          </div>
        </div>
      )}
      {agri && agri.source === "unavailable" && (
        <div className="text-[11px] text-slate-500">Agro indices unavailable: {agri.error}</div>
      )}
    </div>
  );
}

export default function WeatherModule({ onBack }: WeatherModuleProps) {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeather = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/v1/weather/forecast");
      setData(res.data);
    } catch {
      setError("Failed to fetch microclimate forecast. Please verify server connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header Banner */}
      <div className="clean-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <CloudSun className="h-5 w-5 text-amber-500" />
              Microclimate Intelligence & 5-Day Outlook
            </h1>
            <p className="text-xs text-slate-500">Real-time agro-meteorology, spray window suitability and rainfall probability</p>
          </div>
        </div>

        <button
          onClick={fetchWeather}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-3">
          <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fetching meteorological telemetry...</span>
        </div>
      ) : error ? (
        <div className="clean-card p-6 bg-rose-50 border-rose-200 text-rose-800 text-xs">
          {error}
        </div>
      ) : data ? (
        <div className="space-y-6">
          <WeatherProvenance data={data} />
          {/* Top Real-time Gauge Card */}
          <div className="clean-card p-6 md:p-8 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Current Field Conditions</span>
              <div className="flex items-baseline gap-4">
                <h2 className="text-4xl font-extrabold">{data.temperature ?? 29.2}°C</h2>
                <span className="text-sm font-semibold text-slate-300 capitalize">{data.condition ?? "Clear Sky"}</span>
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Humidity: {data.humidity ?? 54}% • Wind: {data.wind_speed ?? 12} km/h • Rainfall Prob: {data.rain_chance ?? "n/a"}%
              </p>
            </div>

            <div className="flex gap-4">
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl text-center">
                <Droplets className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Spray Window</span>
                <span className="text-xs font-bold text-emerald-400 block mt-0.5">{sprayAdvice(data.rain_chance, data.wind_speed)} Today</span>
              </div>
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl text-center">
                <Wind className="h-5 w-5 text-amber-400 mx-auto mb-1" />
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Wind Safety</span>
                <span className="text-xs font-bold text-emerald-400 block mt-0.5">{(data.wind_speed ?? 0) <= 15 ? "Safe (<15 km/h)" : `Caution (${data.wind_speed} km/h)`}</span>
              </div>
            </div>
          </div>

          {/* 5-Day Outlook */}
          <div className="clean-card p-6 md:p-8 space-y-6">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" /> 5-Day Precision Farming Outlook
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {(data.forecast || []).map((f: any) => ({
                day: f.day,
                temp: `${f.temp}°C avg`,
                condition: f.condition,
                rain: `${f.rain_chance}%`,
                spray: sprayAdvice(f.rain_chance, undefined),
              })).map((d: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-2">
                  <span className="text-xs font-bold text-slate-800 block">{d.day}</span>
                  <div className="text-xs font-semibold text-emerald-700">{d.temp}</div>
                  <span className="text-[11px] text-slate-500 block">{d.condition}</span>
                  <div className="pt-2 border-t border-slate-200 text-[10px]">
                    <span className="text-slate-400 block">Rain: {d.rain}</span>
                    <span className={`font-bold block mt-0.5 ${d.spray === 'Avoid' ? 'text-rose-600' : 'text-emerald-700'}`}>
                      Spray: {d.spray}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
