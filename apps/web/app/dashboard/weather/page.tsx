"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { 
  ArrowLeft, 
  CloudSun, 
  Thermometer, 
  Droplets, 
  Wind, 
  CloudRain, 
  AlertTriangle, 
  AlertCircle,
  Lightbulb,
  RefreshCw,
  Sun,
  Cloud,
  CloudLightning,
  CloudDrizzle,
  CheckCircle2
} from "lucide-react";

interface ForecastDay {
  day: string;
  temp: number;
  condition: string;
  rain_chance: number;
}

interface WeatherAlert {
  type: string;
  severity: string;
  message: string;
}

interface WeatherData {
  state: string;
  temperature: number;
  humidity: number;
  condition: string;
  wind_speed: number;
  wind_direction: string;
  rain_chance: number;
  forecast: ForecastDay[];
  alerts: WeatherAlert[];
  advisories: string[];
}

export default function WeatherPage() {
  const [data, setData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuthStore();

  const fetchWeather = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/v1/weather/forecast");
      
      const eieAdvisories: string[] = [];
      try {
        if (typeof window !== "undefined" && user?.email) {
          const stored = localStorage.getItem(`agrinexus_farms_${user.email}`);
          if (stored) {
            const parsed = JSON.parse(stored);
            for (const farm of parsed) {
              const forecasts = farm.earth_forecasts || [];
              const weekly = forecasts.find((f: any) => f.window === "weekly");
              if (weekly) {
                if (weekly.crop_stress_index > 0.4) {
                  eieAdvisories.push(
                    `[${farm.name}] Elevated crop stress warning (${Math.round(weekly.crop_stress_index * 100)}%). ${weekly.explanation}`
                  );
                }
                if (weekly.irrigation_demand_index > 0.5) {
                  eieAdvisories.push(
                    `[${farm.name}] High evapotranspiration detected. Consider scheduling irrigation.`
                  );
                }
              }
            }
          }
        }
      } catch (e) {}

      setData({
        ...res.data,
        advisories: [...res.data.advisories, ...eieAdvisories]
      });
    } catch (err: any) {
      setError("Failed to retrieve microclimate forecast. Please verify server connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const getWeatherIcon = (cond: string) => {
    const c = cond.toLowerCase();
    if (c.includes("sunny")) return <Sun className="h-6 w-6 text-amber-500" />;
    if (c.includes("rain") || c.includes("showers")) return <CloudRain className="h-6 w-6 text-sky-600" />;
    if (c.includes("storm") || c.includes("lightning")) return <CloudLightning className="h-6 w-6 text-purple-600" />;
    if (c.includes("cloud")) return <Cloud className="h-6 w-6 text-slate-500" />;
    if (c.includes("drizzle")) return <CloudDrizzle className="h-6 w-6 text-teal-600" />;
    return <CloudSun className="h-6 w-6 text-emerald-600" />;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard" 
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <CloudSun className="h-5 w-5 text-sky-600" />
              Weather & Microclimate Intelligence
            </h1>
          </div>
          <button 
            onClick={fetchWeather}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-sm transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-8 w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-28 text-slate-400 gap-3">
            <RefreshCw className="h-7 w-7 text-emerald-600 animate-spin" />
            <span className="text-xs font-semibold">Retrieving weather telemetry...</span>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 p-5 rounded-2xl text-xs flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Upper Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
              
              {/* Primary Current Card */}
              <div className="md:col-span-7 clean-card p-7 flex flex-col justify-between bg-white shadow-sm">
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Microclimate Center</span>
                      <h2 className="text-2xl font-display font-bold text-slate-900 mt-1">{data.state}</h2>
                    </div>
                    <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                      {getWeatherIcon(data.condition)}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-display font-extrabold text-slate-900">{data.temperature}</span>
                    <span className="text-2xl font-bold text-emerald-700">°C</span>
                  </div>
                  <p className="text-slate-600 font-semibold text-base mt-2">{data.condition}</p>
                </div>

                <div className="text-[11px] text-slate-400 mt-6 flex items-center gap-1.5">
                  <span className="h-2 w-2 bg-emerald-500 rounded-full"></span>
                  Real-time telemetry feed active
                </div>
              </div>

              {/* Warnings Card */}
              <div className="md:col-span-5 clean-card p-6 flex flex-col justify-between bg-white shadow-sm">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Risk & Warning Flags</h3>
                  
                  {data.alerts.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 flex flex-col items-center gap-2">
                      <CheckCircle2 className="h-7 w-7 text-emerald-600" />
                      <span className="text-xs font-semibold text-slate-600">No active microclimate hazards.</span>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.alerts.map((alt, idx) => (
                        <div 
                          key={idx} 
                          className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                            alt.severity === "Red"
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : "bg-amber-50 border-amber-200 text-amber-700"
                          }`}
                        >
                          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider">{alt.type}</div>
                            <p className="text-xs mt-0.5 leading-relaxed">{alt.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Metric Pills */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="clean-card p-4 flex items-center gap-3 bg-white">
                <div className="bg-sky-50 p-2.5 rounded-xl border border-sky-100 text-sky-600">
                  <Droplets className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Humidity</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{data.humidity}%</div>
                </div>
              </div>

              <div className="clean-card p-4 flex items-center gap-3 bg-white">
                <div className="bg-emerald-50 p-2.5 rounded-xl border border-emerald-100 text-emerald-600">
                  <Wind className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wind Speed</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{data.wind_speed} km/h</div>
                </div>
              </div>

              <div className="clean-card p-4 flex items-center gap-3 bg-white">
                <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-100 text-amber-600">
                  <Thermometer className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Wind Dir</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{data.wind_direction}</div>
                </div>
              </div>

              <div className="clean-card p-4 flex items-center gap-3 bg-white">
                <div className="bg-blue-50 p-2.5 rounded-xl border border-blue-100 text-blue-600">
                  <CloudRain className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rain Chance</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{data.rain_chance}%</div>
                </div>
              </div>
            </div>

            {/* Forecast & Advisory */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Forecast (Left) */}
              <div className="lg:col-span-7 clean-card p-6 bg-white shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">5-Day Forecast Outlook</h3>
                <div className="space-y-2.5">
                  {data.forecast.map((fc, idx) => (
                    <div 
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <span className="font-bold text-slate-800 w-12">{fc.day}</span>
                      <div className="flex items-center gap-2.5 w-40">
                        {getWeatherIcon(fc.condition)}
                        <span className="text-slate-600 truncate">{fc.condition}</span>
                      </div>
                      <div className="flex items-center gap-6 font-semibold">
                        <span className="text-slate-400">{fc.rain_chance}% Rain</span>
                        <span className="text-slate-900 font-bold">{fc.temp}°C</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advisory (Right) */}
              <div className="lg:col-span-5 clean-card p-6 bg-white shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4 text-emerald-600" />
                  Agronomic Advisories
                </h3>
                
                <div className="space-y-3">
                  {data.advisories.map((adv, idx) => (
                    <div 
                      key={idx}
                      className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 flex items-start gap-3"
                    >
                      <CheckCircle2 className="h-4 w-4 text-emerald-700 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-900 leading-relaxed font-medium">{adv}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
