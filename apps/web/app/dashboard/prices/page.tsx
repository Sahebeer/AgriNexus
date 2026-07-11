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
  TrendingDown
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
        // Default to first item
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
            <TrendingUp className="h-5 w-5 text-primary" />
            Market Commodity Prices
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-500 gap-3">
            <RefreshCw className="h-8 w-8 text-primary animate-spin" />
            <span className="text-sm font-semibold">Fetching commodity ticker...</span>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-3xl text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : data.length > 0 && activeCrop ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
            
            {/* Left list: Crop selector (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="glass border border-neutral-800 rounded-3xl p-5">
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-4">Commodity Ticker</div>
                
                <div className="space-y-2">
                  {data.map((c) => {
                    const isSelected = activeCrop.crop === c.crop;
                    const priceUp = c.change_percent >= 0;
                    return (
                      <button
                        key={c.crop}
                        onClick={() => selectCropByName(c.crop)}
                        className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all border text-left ${
                          isSelected
                            ? "bg-neutral-800/80 border-primary/20 text-white shadow-sm"
                            : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-850/40"
                        }`}
                      >
                        <div>
                          <div className="font-bold text-sm text-white">{c.crop}</div>
                          <div className="text-[10px] text-neutral-500 mt-0.5">Average Wholesale</div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-bold text-neutral-200">₹{c.average_price}</div>
                          <div className={`text-[10px] font-semibold mt-0.5 flex items-center gap-0.5 ${
                            priceUp ? "text-primary" : "text-red-400"
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
              <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
                
                <div className="flex items-start justify-between border-b border-neutral-800 pb-5">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-widest text-primary">Market Index</span>
                    <h2 className="text-2xl font-bold text-white mt-1">{activeCrop.crop} Price Profile</h2>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">Government MSP</span>
                    <div className="text-lg font-bold text-neutral-200 mt-1">
                      {activeCrop.msp > 0 ? `₹${activeCrop.msp} / Qtl` : "No MSP"}
                    </div>
                  </div>
                </div>

                {/* Price Gauge Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-850">
                    <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Lowest Mandi</span>
                    <span className="text-lg font-extrabold text-neutral-300 mt-1 block">₹{activeCrop.low_price}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wider block">Average Rate</span>
                    <span className="text-lg font-extrabold text-primary mt-1 block">₹{activeCrop.average_price}</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-850">
                    <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block">Highest Mandi</span>
                    <span className="text-lg font-extrabold text-neutral-300 mt-1 block">₹{activeCrop.high_price}</span>
                  </div>
                </div>

                {/* MSP comparison bar chart */}
                {activeCrop.msp > 0 && (
                  <div className="p-5 rounded-2xl bg-neutral-900/40 border border-neutral-850 space-y-3">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-neutral-400">Trading vs MSP Margin</span>
                      <span className="text-primary">
                        +₹{activeCrop.average_price - activeCrop.msp} Above Support Price
                      </span>
                    </div>

                    <div className="w-full h-3 bg-neutral-850 rounded-full overflow-hidden flex">
                      <div 
                        className="bg-neutral-700 h-full"
                        style={{ width: `${(activeCrop.msp / activeCrop.average_price) * 100}%` }}
                      ></div>
                      <div 
                        className="bg-primary h-full transition-all duration-1000"
                        style={{ width: `${(1 - (activeCrop.msp / activeCrop.average_price)) * 100}%` }}
                      ></div>
                    </div>

                    <div className="flex justify-between text-[10px] text-neutral-600 font-bold">
                      <span>MSP (₹{activeCrop.msp})</span>
                      <span>Mandi Average (₹{activeCrop.average_price})</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Mandi comparisons table */}
              <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-primary" />
                  Regional Mandi Rate Sheets
                </h3>

                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-neutral-800 text-[10px] uppercase tracking-wider font-bold text-neutral-500">
                        <th className="pb-3">Mandi Location</th>
                        <th className="pb-3 text-right">Wholesale Price (Qtl)</th>
                        <th className="pb-3 text-right">Daily Volume (Tons)</th>
                        <th className="pb-3 text-right">MSP Deviation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-900 font-semibold">
                      {activeCrop.mandis.map((m, idx) => {
                        const dev = activeCrop.msp > 0 ? m.price - activeCrop.msp : 0;
                        return (
                          <tr key={idx} className="hover:bg-neutral-900/30 transition-colors">
                            <td className="py-4 text-neutral-200">{m.name}</td>
                            <td className="py-4 text-right text-white">₹{m.price}</td>
                            <td className="py-4 text-right text-neutral-400">{m.volume_tons} T</td>
                            <td className="py-4 text-right">
                              {activeCrop.msp > 0 ? (
                                <span className={dev >= 0 ? "text-primary" : "text-red-400"}>
                                  {dev >= 0 ? "+" : ""}₹{dev}
                                </span>
                              ) : (
                                <span className="text-neutral-500">N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Weekly mock price index charts */}
              <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
                <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Scale className="h-4 w-4 text-primary" />
                  7-Day Price Trend
                </h3>
                
                <div className="h-32 flex items-end justify-between gap-2 px-4 border-b border-l border-neutral-850 pt-4">
                  {activeCrop.history_7d.map((val, idx) => {
                    const min = Math.min(...activeCrop.history_7d);
                    const max = Math.max(...activeCrop.history_7d);
                    const heightPercent = max === min ? 50 : ((val - min) / (max - min)) * 60 + 30; // Scale height between 30% and 90%
                    
                    return (
                      <div key={idx} className="flex-1 flex flex-col items-center gap-2 group cursor-pointer">
                        <span className="text-[9px] font-bold text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          ₹{val}
                        </span>
                        <div 
                          className="w-full bg-neutral-900 group-hover:bg-primary/20 border border-neutral-800 group-hover:border-primary/40 rounded-t-lg transition-all duration-500"
                          style={{ height: `${heightPercent}px` }}
                        ></div>
                        <span className="text-[10px] font-bold text-neutral-600 mb-1">
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
