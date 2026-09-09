"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import {
  ArrowLeft,
  ShoppingCart,
  Sprout,
  Beaker,
  Bug,
  Wrench,
  Leaf,
  FlaskConical,
  Package,
  CheckSquare,
  Square,
  Trash2,
  Printer,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
  IndianRupee,
  ClipboardList,
  Sparkles,
  ArrowRight,
  Check,
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

interface ListSummary {
  id: number;
  name: string;
  crop: string;
  farm_size: number;
  season: string;
  estimated_total_cost: number;
}

const CROPS = [
  "Rice", "Wheat", "Corn", "Mustard", "Soybean", "Groundnut", "Cotton",
  "Sugarcane", "Tomato", "Potato", "Onion", "Chickpeas (Gram)",
  "Apple", "Mango", "Banana", "Orange", "Guava", "Grapes",
  "Lentils (Masoor)", "Pigeon Peas (Tur)", "Mung Beans",
  "Garlic", "Ginger", "Chilli", "Brinjal", "Okra (Bhindi)", "Cabbage", "Cauliflower",
];

const SOIL_TYPES = ["Loam", "Clay", "Sandy", "Clay Loam", "Sandy Loam", "Silt Loam", "Peat"];
const SEASONS = ["Kharif", "Rabi", "Zaid"];
const GROWTH_STAGES = [
  "Pre-Sowing / Land Preparation",
  "Sowing / Transplanting",
  "Vegetative Growth",
  "Flowering",
  "Fruiting / Grain Fill",
  "Pre-Harvest",
  "Post-Harvest",
];

const CATEGORY_META: Record<string, { icon: React.FC<any>; color: string }> = {
  "Seeds":           { icon: Sprout,       color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  "Fertilizers":     { icon: Beaker,       color: "text-blue-700 bg-blue-50 border-blue-200" },
  "Micronutrients":  { icon: FlaskConical, color: "text-purple-700 bg-purple-50 border-purple-200" },
  "Pesticides":      { icon: Bug,          color: "text-rose-700 bg-rose-50 border-rose-200" },
  "Tools":           { icon: Wrench,       color: "text-amber-700 bg-amber-50 border-amber-200" },
  "Soil Amendments": { icon: Leaf,         color: "text-teal-700 bg-teal-50 border-teal-200" },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { icon: Package, color: "text-slate-700 bg-slate-100 border-slate-200" };
}

export default function ShoppingListPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [view, setView] = useState<"wizard" | "list" | "history">("wizard");
  const [wizardStep, setWizardStep] = useState(0);

  // Wizard fields
  const [crop, setCrop] = useState("Wheat");
  const [farmSize, setFarmSize] = useState(2.0);
  const [soilType, setSoilType] = useState("Loam");
  const [season, setSeason] = useState("Rabi");
  const [growthStage, setGrowthStage] = useState("Pre-Sowing / Land Preparation");

  // Output list state
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [history, setHistory] = useState<ListSummary[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const printRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await api.post("/api/v1/shopping/generate", {
        crop,
        farm_size: farmSize,
        soil_type: soilType,
        season,
        growth_stage: growthStage,
      });
      setActiveList(res.data);
      setView("list");
      showToast("Smart shopping list generated!", "success");
    } catch {
      showToast("Failed to generate shopping list", "error");
    } finally {
      setIsGenerating(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get("/api/v1/shopping/history");
      setHistory(res.data);
    } catch {
      showToast("Failed to load list history", "error");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadList = async (id: number) => {
    try {
      const res = await api.get(`/api/v1/shopping/${id}`);
      setActiveList(res.data);
      setView("list");
    } catch {
      showToast("Failed to load list", "error");
    }
  };

  const toggleItem = async (item: ShoppingItem) => {
    if (!activeList) return;
    try {
      await api.patch(`/api/v1/shopping/${activeList.id}/items/${item.id}`, {
        is_purchased: !item.is_purchased,
      });
      setActiveList(prev => {
        if (!prev) return prev;
        const updatedItems = prev.items.map(i =>
          i.id === item.id ? { ...i, is_purchased: !i.is_purchased } : i
        );
        return { ...prev, items: updatedItems };
      });
    } catch {
      showToast("Update failed", "error");
    }
  };

  const toggleCategory = (cat: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const handlePrint = () => window.print();

  const grouped = activeList
    ? activeList.items.reduce((acc, item) => {
        (acc[item.category] = acc[item.category] ?? []).push(item);
        return acc;
      }, {} as Record<string, ShoppingItem[]>)
    : {};

  const purchasedCount = activeList?.items.filter(i => i.is_purchased).length ?? 0;
  const totalItems = activeList?.items.length ?? 0;
  const purchasedCost = activeList?.items
    .filter(i => i.is_purchased)
    .reduce((s, i) => s + i.total_cost, 0) ?? 0;

  const wizardSteps = [
    { label: "Crop", icon: Sprout },
    { label: "Farm Scale", icon: Leaf },
    { label: "Season & Stage", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-16 print:bg-white">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 print:hidden">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => view !== "wizard" ? setView("wizard") : router.push("/dashboard")}
              className="text-slate-500 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-teal-50 text-teal-600 p-2 rounded-xl border border-teal-100">
                <ShoppingCart className="h-5 w-5" />
              </div>
              <div>
                <span className="font-display font-bold text-slate-900 text-base">Farm Inputs & Shopping List</span>
                <p className="text-xs text-slate-500">Scaled Input Calculator & Checklist</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { loadHistory(); setView("history"); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-all shadow-sm"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              Saved Lists
            </button>
            {view === "list" && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-all"
              >
                <Printer className="h-3.5 w-3.5" />
                Print / Export
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full">

        {/* ─── WIZARD VIEW ──────────────────────────────────────────────── */}
        {view === "wizard" && (
          <div className="max-w-2xl mx-auto">
            {/* Step indicators */}
            <div className="flex items-center justify-center gap-0 mb-8">
              {wizardSteps.map((s, i) => {
                const Icon = s.icon;
                const active = wizardStep === i;
                const done = wizardStep > i;
                return (
                  <React.Fragment key={i}>
                    <button
                      onClick={() => i <= wizardStep && setWizardStep(i)}
                      className="flex flex-col items-center gap-1 group"
                    >
                      <div className={`h-9 w-9 rounded-full border flex items-center justify-center transition-all ${
                        done ? "bg-emerald-600 border-emerald-600 text-white" :
                        active ? "bg-emerald-50 border-emerald-600 text-emerald-700 font-bold" :
                        "bg-white border-slate-200 text-slate-400"
                      }`}>
                        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${active || done ? "text-slate-800" : "text-slate-400"}`}>{s.label}</span>
                    </button>
                    {i < wizardSteps.length - 1 && (
                      <div className={`h-0.5 w-16 mx-2 mb-4 rounded-full ${wizardStep > i ? "bg-emerald-600" : "bg-slate-200"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="clean-card p-8 bg-white shadow-sm">
              {/* Step 0 — Crop */}
              {wizardStep === 0 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 mb-1">Target Crop Selection</h2>
                    <p className="text-xs text-slate-500">Select your crop to generate input requirements.</p>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {CROPS.map(c => (
                      <button
                        key={c}
                        onClick={() => setCrop(c)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all text-left ${
                          crop === c
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                            : "border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { if (crop) setWizardStep(1); else showToast("Select a crop", "error"); }}
                    disabled={!crop}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all shadow-sm"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Step 1 — Farm Details */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 mb-1">Farm Scale & Soil Profile</h2>
                    <p className="text-xs text-slate-500">Calculations scale seed and fertilizer dosage to your field acreage.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                          Acreage
                        </label>
                        <span className="text-xs font-bold text-emerald-700">{farmSize} Hectares</span>
                      </div>
                      <input
                        type="range" min={0.5} max={50} step={0.5}
                        value={farmSize}
                        onChange={e => setFarmSize(parseFloat(e.target.value))}
                        className="w-full accent-emerald-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                        <span>0.5 Ha</span><span>50 Ha</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Soil Classification</label>
                      <div className="grid grid-cols-3 gap-2">
                        {SOIL_TYPES.map(s => (
                          <button key={s} onClick={() => setSoilType(s)}
                            className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                              soilType === s ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setWizardStep(0)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all">Back</button>
                    <button onClick={() => setWizardStep(2)} className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-all shadow-sm">
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — Season & Stage */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 mb-1">Season & Current Phase</h2>
                    <p className="text-xs text-slate-500">Aligns input recommendations to your crop phenology.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Season</label>
                      <div className="grid grid-cols-3 gap-2">
                        {SEASONS.map(s => (
                          <button key={s} onClick={() => setSeason(s)}
                            className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                              season === s ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Current Stage</label>
                      <div className="space-y-1.5">
                        {GROWTH_STAGES.map(g => (
                          <button key={g} onClick={() => setGrowthStage(g)}
                            className={`w-full flex items-center gap-2.5 py-2.5 px-3.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                              growthStage === g ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {growthStage === g ? <CheckSquare className="h-4 w-4 text-emerald-600 flex-shrink-0" /> : <Square className="h-4 w-4 text-slate-400 flex-shrink-0" />}
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Summary card */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                    <div className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-2">Input Criteria Summary</div>
                    {[
                      ["Crop", crop], ["Acreage", `${farmSize} Hectares`],
                      ["Soil", soilType], ["Season", season], ["Phase", growthStage],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-slate-500">{k}</span>
                        <span className="text-slate-900 font-semibold">{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setWizardStep(1)} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-all">Back</button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 text-xs transition-all shadow-sm"
                    >
                      {isGenerating ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Calculating...</> : <><Sparkles className="h-3.5 w-3.5" />Generate Shopping List</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── LIST VIEW ────────────────────────────────────────────────── */}
        {view === "list" && activeList && (
          <div ref={printRef} className="space-y-6">
            {/* List header */}
            <div className="clean-card p-6 md:p-8 bg-white shadow-sm">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {activeList.season || "All Seasons"}
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {activeList.growth_stage || "General"}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-slate-900">{activeList.name}</h1>
                  <p className="text-slate-500 text-xs mt-1">{activeList.soil_type} soil · {activeList.farm_size} Hectares</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Items</div>
                    <div className="text-lg font-bold text-slate-900">{totalItems}</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[10px] text-emerald-800 uppercase tracking-wider font-bold mb-0.5">Purchased</div>
                    <div className="text-lg font-bold text-emerald-800">{purchasedCount}</div>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-bold mb-0.5">Est. Cost</div>
                    <div className="text-lg font-bold text-emerald-700">₹{activeList.estimated_total_cost.toLocaleString("en-IN")}</div>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
                  <span>Shopping Progress</span>
                  <span>{purchasedCount}/{totalItems} items · ₹{purchasedCost.toLocaleString("en-IN")} spent</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                    style={{ width: totalItems > 0 ? `${(purchasedCount / totalItems) * 100}%` : "0%" }}
                  />
                </div>
              </div>
            </div>

            {/* Category sections */}
            {Object.entries(grouped).map(([cat, items]) => {
              const { icon: Icon, color } = getCategoryMeta(cat);
              const collapsed = collapsedCategories.has(cat);
              const catTotal = items.reduce((s, i) => s + i.total_cost, 0);
              const catPurchased = items.filter(i => i.is_purchased).length;

              return (
                <div key={cat} className="clean-card bg-white overflow-hidden shadow-sm">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-all text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{cat}</div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {catPurchased}/{items.length} items · ₹{catTotal.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                    {collapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                  </button>

                  {/* Items */}
                  {!collapsed && (
                    <div className="border-t border-slate-100 divide-y divide-slate-100">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-3 p-4 transition-all ${item.is_purchased ? "bg-slate-50/60 opacity-60" : "hover:bg-slate-50/40"}`}
                        >
                          <button
                            onClick={() => toggleItem(item)}
                            className="mt-0.5 flex-shrink-0"
                          >
                            {item.is_purchased
                              ? <CheckSquare className="h-4 w-4 text-emerald-600" />
                              : <Square className="h-4 w-4 text-slate-400 hover:text-slate-600" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-xs ${item.is_purchased ? "line-through text-slate-400" : "text-slate-900"}`}>
                              {item.name}
                            </div>
                            {item.description && (
                              <div className="text-[11px] text-slate-500 mt-0.5">{item.description}</div>
                            )}
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-600">
                              <span className="font-semibold">{item.quantity} {item.unit}</span>
                              <span className="text-slate-300">×</span>
                              <span className="text-slate-500">₹{item.unit_cost}/{item.unit}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs font-bold text-emerald-700">
                              ₹{item.total_cost.toLocaleString("en-IN")}
                            </div>
                            {item.is_purchased && (
                              <div className="text-[10px] text-emerald-700 font-bold mt-0.5">✓ Purchased</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Total footer */}
            <div className="clean-card p-5 bg-emerald-50/50 border border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <IndianRupee className="h-5 w-5 text-emerald-700" />
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Estimated Total Budget</div>
                    <div className="font-display text-xl font-bold text-emerald-800">
                      ₹{activeList.estimated_total_cost.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setWizardStep(0); setView("wizard"); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold shadow-sm transition-all"
                >
                  <Plus className="h-3.5 w-3.5" /> New Calculation
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── HISTORY VIEW ─────────────────────────────────────────────── */}
        {view === "history" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-900">Saved Shopping Lists</h2>
                <p className="text-xs text-slate-500 mt-0.5">Previously generated agricultural input budgets</p>
              </div>
              <button
                onClick={() => { setWizardStep(0); setView("wizard"); }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-all shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" /> New List
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="flex justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
              </div>
            ) : history.length === 0 ? (
              <div className="clean-card p-16 text-center bg-white shadow-sm">
                <ShoppingCart className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                <h3 className="font-bold text-slate-800 text-sm mb-1">No Lists Saved</h3>
                <p className="text-xs text-slate-500">Generate your first shopping list above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {history.map(l => (
                  <button
                    key={l.id}
                    onClick={() => loadList(l.id)}
                    className="clean-card clean-card-hover p-5 text-left bg-white shadow-sm group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {l.season || "General"}
                      </span>
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors mb-0.5">{l.name}</h3>
                    <p className="text-xs text-slate-500">{l.farm_size} Ha</p>
                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-400">Est. Total</span>
                      <span className="text-sm font-bold text-emerald-700">₹{l.estimated_total_cost.toLocaleString("en-IN")}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Print styles */}
      <style>{`
        @media print {
          header, .print\\:hidden { display: none !important; }
          body { background: white !important; color: black !important; }
          .clean-card { background: white !important; border-color: #e2e8f0 !important; }
        }
      `}</style>
    </div>
  );
}
