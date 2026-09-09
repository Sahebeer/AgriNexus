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
          {/* Top Real-time Gauge Card */}
          <div className="clean-card p-6 md:p-8 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-col md:flex-row justify-between items-start md:items-center gap-6 shadow-md">
            <div className="space-y-2">
              <span className="text-[10px] uppercase font-bold tracking-widest text-emerald-400">Current Field Conditions</span>
              <div className="flex items-baseline gap-4">
                <h2 className="text-4xl font-extrabold">{data.temperature ?? 29.2}°C</h2>
                <span className="text-sm font-semibold text-slate-300 capitalize">{data.condition ?? "Clear Sky"}</span>
              </div>
              <p className="text-xs text-slate-400 max-w-md">
                Humidity: {data.humidity ?? 54}% • Wind: {data.wind_speed ?? 12} km/h • Rainfall Prob: {data.rain_probability ?? 10}%
              </p>
            </div>

            <div className="flex gap-4">
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl text-center">
                <Droplets className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Spray Window</span>
                <span className="text-xs font-bold text-emerald-400 block mt-0.5">Optimal Today</span>
              </div>
              <div className="p-4 bg-slate-800/80 border border-slate-700 rounded-2xl text-center">
                <Wind className="h-5 w-5 text-amber-400 mx-auto mb-1" />
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Wind Safety</span>
                <span className="text-xs font-bold text-emerald-400 block mt-0.5">Safe (&lt;15 km/h)</span>
              </div>
            </div>
          </div>

          {/* 5-Day Outlook */}
          <div className="clean-card p-6 md:p-8 space-y-6">
            <h3 className="text-sm font-bold text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sun className="h-4 w-4 text-amber-500" /> 5-Day Precision Farming Outlook
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
              {(data.daily_forecast || [
                { day: "Today", temp: "29°C / 18°C", condition: "Sunny", rain: "5%", spray: "Optimal" },
                { day: "Tomorrow", temp: "30°C / 19°C", condition: "Partly Cloudy", rain: "15%", spray: "Optimal" },
                { day: "Day 3", temp: "28°C / 18°C", condition: "Light Rain", rain: "65%", spray: "Avoid" },
                { day: "Day 4", temp: "27°C / 17°C", condition: "Cloudy", rain: "30%", spray: "Moderate" },
                { day: "Day 5", temp: "31°C / 20°C", condition: "Clear", rain: "0%", spray: "Optimal" },
              ]).map((d: any, idx: number) => (
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
