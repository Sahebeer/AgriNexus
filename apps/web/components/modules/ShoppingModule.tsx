"use client";

import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import {
  ArrowLeft,
  ShoppingCart,
  Sprout,
  Package,
  CheckSquare,
  Square,
  Trash2,
  Printer,
  Plus,
  RefreshCw,
  Calculator,
  ArrowRight
} from "lucide-react";

interface ShoppingItem {
  id: number;
  category: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  is_purchased: boolean;
  notes: string;
}

interface ShoppingList {
  id: number;
  name: string;
  crop: string;
  farm_size: number;
  soil_type: string;
  season: string;
  growth_stage: string;
  estimated_total_cost: number;
  items: ShoppingItem[];
}

interface ShoppingModuleProps {
  onBack?: () => void;
}

const CROPS = ["Wheat", "Rice", "Cotton", "Tomato", "Potato", "Sugarcane", "Mustard", "Corn"];

export default function ShoppingModule({ onBack }: ShoppingModuleProps) {
  const { showToast } = useToastStore();
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Calculator Form
  const [crop, setCrop] = useState("Wheat");
  const [farmSize, setFarmSize] = useState(2.0);
  const [soilType, setSoilType] = useState("Loamy");
  const [season, setSeason] = useState("Rabi");
  const [growthStage, setGrowthStage] = useState("Sowing");
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchLists = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/v1/shopping/");
      setLists(res.data);
      if (res.data.length > 0 && !activeList) {
        setActiveList(res.data[0]);
      }
    } catch {
      // Fallback demo list
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleGenerateList = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await api.post("/api/v1/shopping/generate", {
        name: `${crop} Seasonal Input Plan (${farmSize} Ha)`,
        crop,
        farm_size: farmSize,
        soil_type: soilType,
        season,
        growth_stage: growthStage,
      });
      showToast("Input checklist generated from NPK agronomic model!", "success");
      setActiveList(res.data);
      fetchLists();
    } catch {
      showToast("Failed to calculate input requirements", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleItem = async (itemId: number) => {
    if (!activeList) return;
    try {
      await api.patch(`/api/v1/shopping/items/${itemId}/toggle`);
      setActiveList((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          items: prev.items.map((i) => (i.id === itemId ? { ...i, is_purchased: !i.is_purchased } : i)),
        };
      });
    } catch {
      showToast("Failed to update item state", "error");
    }
  };

  const totalCalculatedCost = activeList?.items.reduce((acc, i) => acc + (i.total_cost || 0), 0) || 0;
  const purchasedCost = activeList?.items.filter((i) => i.is_purchased).reduce((acc, i) => acc + (i.total_cost || 0), 0) || 0;

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
              <Calculator className="h-5 w-5 text-emerald-600" />
              Farm Inputs Calculator & Shopping Checklist
            </h1>
            <p className="text-xs text-slate-500">Calculate fertilizer, seed and pest management quotas scaled to your acreage</p>
          </div>
        </div>

        {activeList && (
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print List</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Col: Generator Form */}
        <div className="lg:col-span-4 space-y-6">
          <div className="clean-card p-6 space-y-5">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sprout className="h-4 w-4 text-emerald-600" /> Farm Parameters
            </h3>

            <form onSubmit={handleGenerateList} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Crop Selection</label>
                <select
                  value={crop}
                  onChange={(e) => setCrop(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                >
                  {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Landholding Area (Hectares)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={farmSize}
                  onChange={(e) => setFarmSize(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Soil Type</label>
                  <select
                    value={soilType}
                    onChange={(e) => setSoilType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                  >
                    {["Loamy", "Clayey", "Sandy", "Black Soil", "Alluvial"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Season</label>
                  <select
                    value={season}
                    onChange={(e) => setSeason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                  >
                    {["Rabi", "Kharif", "Zaid (Summer)"].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Calculating NPK Quotas...</span>
                  </>
                ) : (
                  <>
                    <Calculator className="h-4 w-4" />
                    <span>Calculate Input Quotas</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Col: Active Checklist */}
        <div className="lg:col-span-8 space-y-6">
          {activeList ? (
            <div className="space-y-6">
              {/* Summary Bar */}
              <div className="clean-card p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {activeList.crop} ({activeList.farm_size} Ha)
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 mt-2">{activeList.name}</h3>
                </div>

                <div className="text-right">
                  <span className="text-xs text-slate-400 block font-medium">Estimated Expenditure</span>
                  <span className="text-2xl font-extrabold text-slate-900 block mt-0.5">
                    ₹{totalCalculatedCost.toLocaleString()}
                  </span>
                  <span className="text-[11px] text-emerald-700 font-semibold block">
                    Procured: ₹{purchasedCost.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Items List */}
              <div className="clean-card p-6 space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Required Field Inputs</h4>

                <div className="divide-y divide-slate-100">
                  {activeList.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleToggleItem(item.id)}
                      className="py-3.5 flex items-center justify-between gap-4 cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <button className="text-slate-400 group-hover:text-emerald-600 transition-colors">
                          {item.is_purchased ? (
                            <CheckSquare className="h-5 w-5 text-emerald-600" />
                          ) : (
                            <Square className="h-5 w-5 text-slate-300" />
                          )}
                        </button>
                        <div>
                          <span className={`text-xs font-bold block ${item.is_purchased ? "line-through text-slate-400" : "text-slate-900"}`}>
                            {item.name}
                          </span>
                          <span className="text-[11px] text-slate-500">{item.description}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-900 block">
                          {item.quantity} {item.unit}
                        </span>
                        <span className="text-[11px] text-slate-400 block">₹{item.total_cost}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="clean-card p-16 text-center text-slate-400 space-y-3">
              <Package className="h-10 w-10 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-700">No Checklist Generated</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Select your crop, soil type and acreage on the left to calculate recommended NPK fertilizer and pesticide quantities.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
