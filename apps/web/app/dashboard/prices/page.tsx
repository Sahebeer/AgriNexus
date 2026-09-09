"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "../../../lib/api";
import { 
  ArrowLeft, 
  TrendingUp, 
  Coins, 
  MapPin, 
  Scale, 
  Activity, 
  RefreshCw,
  AlertCircle,
  TrendingDown,
  Info
} from "lucide-react";

interface MandiRate {
  name: string;
  price: number;
  volume_tons: number;
}

interface CropPriceData {
  crop: string;
  msp: number;
  average_price: number;
  high_price: number;
  low_price: number;
  change_percent: number;
  mandis: MandiRate[];
  history_7d: number[];
}

export default function MarketPricesPage() {
  const [data, setData] = useState<CropPriceData[]>([]);
  const [activeCrop, setActiveCrop] = useState<CropPriceData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get("/api/v1/prices/market");
      setData(res.data);
      if (res.data && res.data.length > 0) {
        setActiveCrop(res.data[0]);
      }
    } catch (err: any) {
      setError("Failed to retrieve market prices. Please verify server connection.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
  }, []);

  const selectCropByName = (name: string) => {
    const matched = data.find((c) => c.crop === name);
    if (matched) {
      setActiveCrop(matched);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans pb-16">
      {/* Header Banner */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
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
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Live Commodity Rates & Mandi Tickers
              </h1>
            </div>
          </div>
          <button 
            onClick={fetchPrices}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
            Refresh Rates
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-slate-400 gap-3">
            <RefreshCw className="h-8 w-8 text-emerald-600 animate-spin" />
            <span className="text-sm font-semibold text-slate-600">Fetching live commodity ticker...</span>
          </div>
        ) : error ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : data.length > 0 && activeCrop ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
            
            {/* Left list: Crop selector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="clean-card p-5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Commodity Ticker</div>
                
                <div className="space-y-2">
                  {data.map((c) => {
                    const isSelected = activeCrop.crop === c.crop;
                    const priceUp = c.change_percent >= 0;
                    return (
                      <button
                        key={c.crop}
                        onClick={() => selectCropByName(c.crop)}
                        className={`w-full flex items-center justify-between p-4 rounded-xl transition-all border text-left ${
                          isSelected
                            ? "bg-emerald-50 border-emerald-300 text-emerald-950 shadow-sm"
                            : "border-slate-100 bg-slate-50/50 hover:bg-slate-100/80 text-slate-700"
                        }`}
                      >
                        <div>
                          <div className={`font-bold text-sm ${isSelected ? "text-emerald-900" : "text-slate-900"}`}>{c.crop}</div>
                          <div className="text-xs text-slate-500 mt-0.5">Average Wholesale</div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">₹{c.average_price}</div>
                          <div className={`text-xs font-semibold mt-0.5 flex items-center justify-end gap-0.5 ${
                            priceUp ? "text-emerald-600" : "text-rose-600"
                          }`}>
                            {priceUp ? "+" : ""}{c.change_percent}%
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right panel: Mandi Details (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Overview Card */}
              <div className="clean-card p-6 md:p-8 space-y-6">
                
                <div className="flex items-start justify-between border-b border-slate-100 pb-5">
                  <div>
                    <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Market Index
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 mt-2">{activeCrop.crop} Price Profile</h2>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400">Government MSP</span>
                    <div className="text-lg font-bold text-slate-800 mt-0.5">
                      {activeCrop.msp > 0 ? `₹${activeCrop.msp} / Qtl` : "No MSP"}
                    </div>
                  </div>
                </div>

                {/* Price Gauge Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Lowest Mandi</span>
                    <span className="text-lg font-extrabold text-slate-900 mt-1 block">₹{activeCrop.low_price}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200">
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider block">Average Rate</span>
                    <span className="text-lg font-extrabold text-emerald-700 mt-1 block">₹{activeCrop.average_price}</span>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Highest Mandi</span>
                    <span className="text-lg font-extrabold text-slate-900 mt-1 block">₹{activeCrop.high_price}</span>
                  </div>
                </div>

                {/* MSP comparison bar chart */}
                {activeCrop.msp > 0 && (
                  <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-600">Trading vs MSP Margin</span>
                      <span className="text-emerald-700 font-bold">
                        +₹{activeCrop.average_price - activeCrop.msp} Above Support Price
                      </span>
                    </div>

                    <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-slate-400 h-full"
                        style={{ width: `${Math.min(100, (activeCrop.msp / activeCrop.average_price) * 100)}%` }}
                      ></div>
                      <div 
                        className="bg-emerald-600 h-full transition-all duration-1000"
                        style={{ width: `${Math.max(0, (1 - (activeCrop.msp / activeCrop.average_price)) * 100)}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[11px] text-slate-500 font-semibold">
                      <span>MSP (₹{activeCrop.msp})</span>
                      <span>Mandi Average (₹{activeCrop.average_price})</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mandi comparisons table */}
              <div className="clean-card p-6 md:p-8 space-y-5">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  Regional Mandi Rate Sheets
                </h3>

                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider font-bold text-slate-500">
                        <th className="pb-3 font-semibold">Mandi Location</th>
                        <th className="pb-3 text-right font-semibold">Wholesale Price (Qtl)</th>
                        <th className="pb-3 text-right font-semibold">Daily Volume (Tons)</th>
                        <th className="pb-3 text-right font-semibold">MSP Deviation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {activeCrop.mandis.map((m, idx) => {
                        const dev = activeCrop.msp > 0 ? m.price - activeCrop.msp : 0;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3.5 text-slate-800">{m.name}</td>
                            <td className="py-3.5 text-right font-bold text-slate-900">₹{m.price}</td>
                            <td className="py-3.5 text-right text-slate-600">{m.volume_tons} T</td>
                            <td className="py-3.5 text-right">
                              {activeCrop.msp > 0 ? (
                                <span className={`font-semibold ${dev >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
                                  {dev >= 0 ? "+" : ""}₹{dev}
                                </span>
                              ) : (
                                <span className="text-slate-400">N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Weekly price index charts */}
              <div className="clean-card p-6 md:p-8 space-y-6">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-emerald-600" />
                  7-Day Price Trend
                </h3>
                
                <div className="h-36 flex items-end justify-between gap-3 px-4 border-b border-l border-slate-200 pt-4">
                  {activeCrop.history_7d.map((val, idx) => {
                    const min = Math.min(...activeCrop.history_7d);
                    const max = Math.max(...activeCrop.history_7d);
                    const heightPercent = max === min ? 50 : ((val - min) / (max - min)) * 60 + 30;
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                        <span className="text-[10px] font-bold text-emerald-700 opacity-0 group-hover:opacity-100 transition-opacity">
                          ₹{val}
                        </span>
                        <div 
                          className="w-full bg-slate-100 group-hover:bg-emerald-600 border border-slate-200 group-hover:border-emerald-600 rounded-t-lg transition-all duration-300"
                          style={{ height: `${heightPercent}px` }}
                        ></div>
                        <span className="text-[11px] font-semibold text-slate-500 mb-1">
                          Day {idx + 1}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
