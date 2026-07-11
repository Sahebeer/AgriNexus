"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "../../../lib/api";
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
  CheckCircle
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

  const fetchWeather = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/v1/weather/forecast");
      setData(res.data);
    } catch (err: any) {
      setError("Failed to retrieve microclimate forecast. Please verify server connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeather();
  }, []);

  const getWeatherIcon = (cond: string) => {
    const c = cond.toLowerCase();
    if (c.includes("sunny")) return <Sun className="h-6 w-6 text-amber-400" />;
    if (c.includes("rain") || c.includes("showers")) return <CloudRain className="h-6 w-6 text-blue-400" />;
    if (c.includes("storm") || c.includes("lightning")) return <CloudLightning className="h-6 w-6 text-purple-400" />;
    if (c.includes("cloud")) return <Cloud className="h-6 w-6 text-neutral-400" />;
    if (c.includes("drizzle")) return <CloudDrizzle className="h-6 w-6 text-teal-400" />;
    return <CloudSun className="h-6 w-6 text-primary" />;
  };

  const getGlowColor = (cond: string) => {
    const c = cond.toLowerCase();
    if (c.includes("sunny")) return "from-amber-500/10 to-orange-500/5 border-orange-500/20";
    if (c.includes("rain") || c.includes("showers") || c.includes("storm")) return "from-blue-500/10 to-indigo-500/5 border-blue-500/20";
    if (c.includes("frost") || c.includes("mist")) return "from-teal-500/10 to-cyan-500/5 border-teal-500/20";
    return "from-neutral-800/25 to-neutral-900/5 border-neutral-800";
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans pb-16">
      {/* Header Banner */}
      <header className="glass sticky top-0 z-40 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link 
            href="/dashboard" 
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-800 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <CloudSun className="h-5 w-5 text-primary" />
            Weather Intelligence
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-500 gap-3">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <span className="text-sm font-semibold">Contacting weather station...</span>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-3xl text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : data ? (
          <div className="space-y-8 animate-fade-in">
            {/* Upper grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
              
              {/* Primary Current Card (Left) */}
              <div className={`md:col-span-7 bg-gradient-to-br ${getGlowColor(data.condition)} border rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden shadow-xl min-h-[300px]`}>
                <div>
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400">Microclimate Center</span>
                      <h2 className="text-3xl font-display font-bold text-white mt-1">{data.state}</h2>
                    </div>
                    <div className="bg-neutral-900/60 p-3 rounded-2xl border border-neutral-800">
                      {getWeatherIcon(data.condition)}
                    </div>
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-display font-extrabold text-white">{data.temperature}</span>
                    <span className="text-2xl font-bold text-primary">°C</span>
                  </div>
                  <p className="text-neutral-300 font-semibold text-lg mt-2">{data.condition}</p>
                </div>

                <div className="text-[10px] text-neutral-500 mt-6 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-ping"></span>
                  Real-time localized satellite feed active
                </div>
              </div>

              {/* Warnings / Alerts Card (Right) */}
              <div className="md:col-span-5 glass border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-4">Microclimate Warnings</h3>
                  
                  {data.alerts.length === 0 ? (
                    <div className="py-10 text-center text-neutral-500 flex flex-col items-center gap-3">
                      <CheckCircle className="h-8 w-8 text-primary/40" />
                      <span className="text-xs font-semibold">No active warnings in this sector.</span>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {data.alerts.map((alt, idx) => (
                        <div 
                          key={idx} 
                          className={`p-4 rounded-xl border flex items-start gap-3 animate-pulse ${
                            alt.severity === "Red"
                              ? "bg-red-500/10 border-red-500/20 text-red-400"
                              : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          }`}
                        >
                          {alt.severity === "Red" ? (
                            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="text-xs font-bold uppercase tracking-wider">{alt.type}</div>
                            <p className="text-xs mt-1 leading-relaxed">{alt.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  onClick={fetchWeather}
                  className="w-full bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 hover:border-neutral-700 text-neutral-300 font-semibold py-2.5 rounded-xl text-xs transition-colors mt-4"
                >
                  Refresh Sensors
                </button>
              </div>
            </div>

            {/* Quick metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass border border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
                <div className="bg-neutral-900 p-2.5 rounded-xl border border-neutral-850 text-blue-400">
                  <Droplets className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Humidity</div>
                  <div className="text-sm font-bold text-white mt-0.5">{data.humidity}%</div>
                </div>
              </div>

              <div className="glass border border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
                <div className="bg-neutral-900 p-2.5 rounded-xl border border-neutral-850 text-primary">
                  <Wind className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Wind Speed</div>
                  <div className="text-sm font-bold text-white mt-0.5">{data.wind_speed} km/h</div>
                </div>
              </div>

              <div className="glass border border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
                <div className="bg-neutral-900 p-2.5 rounded-xl border border-neutral-850 text-emerald-400">
                  <Thermometer className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Wind Direction</div>
                  <div className="text-sm font-bold text-white mt-0.5">{data.wind_direction}</div>
                </div>
              </div>

              <div className="glass border border-neutral-800 rounded-2xl p-5 flex items-center gap-4">
                <div className="bg-neutral-900 p-2.5 rounded-xl border border-neutral-850 text-cyan-400">
                  <CloudRain className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest">Rain Chance</div>
                  <div className="text-sm font-bold text-white mt-0.5">{data.rain_chance}%</div>
                </div>
              </div>
            </div>

            {/* Forecast and advisory block */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Forecast (Left) */}
              <div className="lg:col-span-7 glass border border-neutral-800 rounded-3xl p-6 md:p-8">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6">5-Day Meteorological Outlook</h3>
                <div className="space-y-4">
                  {data.forecast.map((fc, idx) => (
                    <div 
                      key={idx}
                      className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-850/80 hover:border-neutral-800 flex items-center justify-between transition-colors"
                    >
                      <span className="font-bold text-sm text-white w-12">{fc.day}</span>
                      <div className="flex items-center gap-3 w-40">
                        {getWeatherIcon(fc.condition)}
                        <span className="text-xs text-neutral-400 truncate">{fc.condition}</span>
                      </div>
                      <div className="flex items-center gap-8 font-semibold">
                        <span className="text-xs text-neutral-500">{fc.rain_chance}% Rain</span>
                        <span className="text-sm text-primary">{fc.temp}°C</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Advisory (Right) */}
              <div className="lg:col-span-5 glass border border-neutral-800 rounded-3xl p-6 md:p-8">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4 text-primary animate-pulse" />
                  AgriNexus Crop Advisory
                </h3>
                
                <div className="space-y-4">
                  {data.advisories.map((adv, idx) => (
                    <div 
                      key={idx}
                      className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-start gap-3.5"
                    >
                      <CheckCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <p className="text-xs md:text-sm text-neutral-300 leading-relaxed font-medium">{adv}</p>
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
