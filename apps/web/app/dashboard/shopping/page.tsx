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

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

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
  "Seeds":           { icon: Sprout,       color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  "Fertilizers":     { icon: Beaker,       color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  "Micronutrients":  { icon: FlaskConical, color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  "Pesticides":      { icon: Bug,          color: "text-red-400 bg-red-500/10 border-red-500/20" },
  "Tools":           { icon: Wrench,       color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  "Soil Amendments": { icon: Leaf,         color: "text-lime-400 bg-lime-500/10 border-lime-500/20" },
};

function getCategoryMeta(cat: string) {
  return CATEGORY_META[cat] ?? { icon: Package, color: "text-neutral-400 bg-neutral-800/40 border-neutral-700" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShoppingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  // View
  const [view, setView] = useState<"wizard" | "list" | "history">("wizard");

  // Wizard
  const [wizardStep, setWizardStep] = useState(0);
  const [crop, setCrop] = useState("");
  const [farmSize, setFarmSize] = useState(1.5);
  const [soilType, setSoilType] = useState("Loam");
  const [season, setSeason] = useState("Kharif");
  const [growthStage, setGrowthStage] = useState(GROWTH_STAGES[0]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Active list
  const [activeList, setActiveList] = useState<ShoppingList | null>(null);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  // History
  const [history, setHistory] = useState<ListSummary[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  // Pre-fill parameters from central database fields registry
  useEffect(() => {
    const prefillFromFarms = async () => {
      try {
        const res = await api.get("/api/v1/farms/");
        if (res.data && res.data.length > 0) {
          const f = res.data[0];
          if (f.current_crop) setCrop(f.current_crop);
          if (f.area) setFarmSize(f.area);
          if (f.soil_reports?.[0]?.soil_texture) {
            setSoilType(f.soil_reports[0].soil_texture);
          }
        }
      } catch (err) {
        console.error("Failed to prefill shopping parameters from database:", err);
      }
    };
    if (user) {
      prefillFromFarms();
    }
  }, [user]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await api.get("/api/v1/shopping/");
      setHistory(res.data);
    } catch {
      showToast("Failed to load history", "error");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleGenerate = async () => {
    if (!crop) { showToast("Please select a crop first", "error"); return; }
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
      showToast("Shopping list generated!", "success");
    } catch {
      showToast("Generation failed. Please try again.", "error");
    } finally {
      setIsGenerating(false);
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

  // Group items by category
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

  // ─── Wizard render ──────────────────────────────────────────────────────────
  const wizardSteps = [
    { label: "Crop", icon: Sprout },
    { label: "Farm Details", icon: Leaf },
    { label: "Season & Stage", icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col print:bg-white">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-neutral-800 print:hidden">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => view !== "wizard" ? setView("wizard") : router.push("/dashboard")}
              className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-neutral-800 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-display font-bold text-white text-lg">Smart Shopping List</span>
                <p className="text-[10px] text-neutral-500 -mt-0.5 font-semibold uppercase tracking-wider">AI-Powered Farm Inputs Generator</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { loadHistory(); setView("history"); }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 text-xs font-semibold transition-all"
            >
              <ClipboardList className="h-4 w-4" />
              My Lists
            </button>
            {view === "list" && (
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-all"
              >
                <Printer className="h-4 w-4" />
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
            <div className="flex items-center justify-center gap-0 mb-10">
              {wizardSteps.map((s, i) => {
                const Icon = s.icon;
                const active = wizardStep === i;
                const done = wizardStep > i;
                return (
                  <React.Fragment key={i}>
                    <button
                      onClick={() => i <= wizardStep && setWizardStep(i)}
                      className={`flex flex-col items-center gap-1.5 group`}
                    >
                      <div className={`h-10 w-10 rounded-full border-2 flex items-center justify-center transition-all ${
                        done ? "bg-primary border-primary" :
                        active ? "bg-primary/10 border-primary" :
                        "bg-neutral-900 border-neutral-700"
                      }`}>
                        {done ? <Check className="h-5 w-5 text-neutral-950" /> : <Icon className={`h-4 w-4 ${active ? "text-primary" : "text-neutral-500"}`} />}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${active || done ? "text-neutral-200" : "text-neutral-600"}`}>{s.label}</span>
                    </button>
                    {i < wizardSteps.length - 1 && (
                      <div className={`h-0.5 w-16 mx-2 mb-5 rounded-full ${wizardStep > i ? "bg-primary" : "bg-neutral-800"}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            <div className="glass border border-neutral-800 rounded-3xl p-8 animate-fade-in">
              {/* Step 0 — Crop */}
              {wizardStep === 0 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white mb-1">Which crop are you growing?</h2>
                    <p className="text-sm text-neutral-400">Select the primary crop to generate a tailored shopping list.</p>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {CROPS.map(c => (
                      <button
                        key={c}
                        onClick={() => setCrop(c)}
                        className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition-all text-left ${
                          crop === c
                            ? "bg-primary/10 border-primary text-primary"
                            : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
                        }`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { if (crop) setWizardStep(1); else showToast("Select a crop", "error"); }}
                    disabled={!crop}
                    className="w-full bg-primary hover:bg-primary-600 disabled:opacity-40 text-neutral-950 font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-all"
                  >
                    Continue <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Step 1 — Farm Details */}
              {wizardStep === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white mb-1">Farm Details</h2>
                    <p className="text-sm text-neutral-400">Quantities will be automatically scaled to your farm size.</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
                        Farm Size — <span className="text-primary">{farmSize} Hectares</span>
                      </label>
                      <input
                        type="range" min={0.5} max={50} step={0.5}
                        value={farmSize}
                        onChange={e => setFarmSize(parseFloat(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-neutral-600 mt-1 font-semibold">
                        <span>0.5 Ha</span><span>50 Ha</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Soil Type</label>
                      <div className="grid grid-cols-3 gap-2">
                        {SOIL_TYPES.map(s => (
                          <button key={s} onClick={() => setSoilType(s)}
                            className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                              soilType === s ? "bg-primary/10 border-primary text-primary" : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                            }`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setWizardStep(0)} className="flex-1 py-3 rounded-xl border border-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-900 transition-all">Back</button>
                    <button onClick={() => setWizardStep(2)} className="flex-[2] bg-primary hover:bg-primary-600 text-neutral-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-xs transition-all">
                      Continue <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — Season & Stage */}
              {wizardStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white mb-1">Season & Growth Stage</h2>
                    <p className="text-sm text-neutral-400">This helps tailor inputs to your current farming phase.</p>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Growing Season</label>
                      <div className="grid grid-cols-3 gap-3">
                        {SEASONS.map(s => (
                          <button key={s} onClick={() => setSeason(s)}
                            className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                              season === s ? "bg-primary/10 border-primary text-primary" : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                            }`}
                          >{s}</button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Current Growth Stage</label>
                      <div className="space-y-2">
                        {GROWTH_STAGES.map(g => (
                          <button key={g} onClick={() => setGrowthStage(g)}
                            className={`w-full flex items-center gap-3 py-3 px-4 rounded-xl border text-xs font-semibold text-left transition-all ${
                              growthStage === g ? "bg-primary/10 border-primary text-primary" : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200"
                            }`}
                          >
                            {growthStage === g ? <CheckSquare className="h-4 w-4 flex-shrink-0" /> : <Square className="h-4 w-4 flex-shrink-0" />}
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Summary card */}
                  <div className="p-4 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2 text-xs">
                    <div className="text-neutral-500 font-bold uppercase tracking-widest text-[10px] mb-3">Generation Summary</div>
                    {[
                      ["Crop", crop], ["Farm Size", `${farmSize} Hectares`],
                      ["Soil Type", soilType], ["Season", season], ["Stage", growthStage],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="text-neutral-500">{k}</span>
                        <span className="text-neutral-200 font-semibold">{v}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setWizardStep(1)} className="flex-1 py-3 rounded-xl border border-neutral-800 text-neutral-300 text-xs font-semibold hover:bg-neutral-900 transition-all">Back</button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="flex-[2] bg-primary hover:bg-primary-600 disabled:opacity-50 text-neutral-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all shadow-[0_0_20px_rgba(0,200,117,0.2)]"
                    >
                      {isGenerating ? <><RefreshCw className="h-4 w-4 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4" />Generate Shopping List</>}
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
            <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8">
              <div className="flex flex-col md:flex-row justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {activeList.season || "All Seasons"}
                    </span>
                    <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                      {activeList.growth_stage || "All Stages"}
                    </span>
                  </div>
                  <h1 className="font-display text-2xl font-bold text-white">{activeList.name}</h1>
                  <p className="text-neutral-400 text-sm mt-1">{activeList.soil_type} soil · {activeList.farm_size} Hectares</p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-3 rounded-2xl bg-neutral-900/60 border border-neutral-800">
                    <div className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-1">Total Items</div>
                    <div className="text-xl font-bold text-white">{totalItems}</div>
                  </div>
                  <div className="text-center p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="text-[10px] text-emerald-400 uppercase tracking-widest font-bold mb-1">Purchased</div>
                    <div className="text-xl font-bold text-emerald-400">{purchasedCount}</div>
                  </div>
                  <div className="text-center p-3 rounded-2xl bg-primary/5 border border-primary/15">
                    <div className="text-[10px] text-primary uppercase tracking-widest font-bold mb-1">Est. Cost</div>
                    <div className="text-lg font-bold text-primary">₹{activeList.estimated_total_cost.toLocaleString("en-IN")}</div>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-6">
                <div className="flex justify-between text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">
                  <span>Progress</span>
                  <span>{purchasedCount}/{totalItems} items · ₹{purchasedCost.toLocaleString("en-IN")} spent</span>
                </div>
                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
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
                <div key={cat} className="glass border border-neutral-800 rounded-3xl overflow-hidden">
                  {/* Category header */}
                  <button
                    onClick={() => toggleCategory(cat)}
                    className="w-full flex items-center justify-between p-5 hover:bg-neutral-900/40 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl border ${color}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-white text-sm">{cat}</div>
                        <div className="text-[10px] text-neutral-500 font-semibold mt-0.5">
                          {catPurchased}/{items.length} items · ₹{catTotal.toLocaleString("en-IN")}
                        </div>
                      </div>
                    </div>
                    {collapsed ? <ChevronRight className="h-4 w-4 text-neutral-500" /> : <ChevronDown className="h-4 w-4 text-neutral-500" />}
                  </button>

                  {/* Items */}
                  {!collapsed && (
                    <div className="border-t border-neutral-800/60 divide-y divide-neutral-800/40">
                      {items.map(item => (
                        <div
                          key={item.id}
                          className={`flex items-start gap-4 p-5 transition-all ${item.is_purchased ? "opacity-50" : "hover:bg-neutral-900/20"}`}
                        >
                          <button
                            onClick={() => toggleItem(item)}
                            className="mt-0.5 flex-shrink-0"
                          >
                            {item.is_purchased
                              ? <CheckSquare className="h-5 w-5 text-primary" />
                              : <Square className="h-5 w-5 text-neutral-600 hover:text-neutral-300 transition-colors" />
                            }
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={`font-semibold text-sm ${item.is_purchased ? "line-through text-neutral-500" : "text-white"}`}>
                              {item.name}
                            </div>
                            {item.description && (
                              <div className="text-[11px] text-neutral-500 mt-0.5">{item.description}</div>
                            )}
                            <div className="flex items-center gap-3 mt-2">
                              <span className="text-xs font-bold text-neutral-300">
                                {item.quantity} {item.unit}
                              </span>
                              <span className="text-[10px] text-neutral-600">×</span>
                              <span className="text-xs text-neutral-400">₹{item.unit_cost}/{item.unit}</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-primary">
                              ₹{item.total_cost.toLocaleString("en-IN")}
                            </div>
                            {item.is_purchased && (
                              <div className="text-[10px] text-emerald-400 font-bold mt-0.5">✓ Purchased</div>
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
            <div className="glass border border-primary/20 rounded-3xl p-6 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <IndianRupee className="h-6 w-6 text-primary" />
                  <div>
                    <div className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">Estimated Total Investment</div>
                    <div className="font-display text-2xl font-bold text-primary">
                      ₹{activeList.estimated_total_cost.toLocaleString("en-IN")}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setWizardStep(0); setView("wizard"); }}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-white text-xs font-semibold transition-all"
                >
                  <Plus className="h-4 w-4" /> New List
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
                <h2 className="font-display text-2xl font-bold text-white">My Shopping Lists</h2>
                <p className="text-sm text-neutral-400 mt-1">Previously generated farming input lists</p>
              </div>
              <button
                onClick={() => { setWizardStep(0); setView("wizard"); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-neutral-950 text-xs font-bold hover:bg-primary-600 transition-all"
              >
                <Plus className="h-4 w-4" /> New List
              </button>
            </div>

            {isLoadingHistory ? (
              <div className="flex justify-center py-20">
                <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : history.length === 0 ? (
              <div className="glass border border-neutral-800 rounded-3xl p-16 text-center">
                <ShoppingCart className="h-10 w-10 text-neutral-700 mx-auto mb-4" />
                <h3 className="font-bold text-neutral-300 mb-2">No Lists Yet</h3>
                <p className="text-xs text-neutral-500">Generate your first smart shopping list above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {history.map(l => (
                  <button
                    key={l.id}
                    onClick={() => loadList(l.id)}
                    className="glass border border-neutral-800 rounded-2xl p-6 text-left hover:border-neutral-600 hover:bg-neutral-900/20 transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                        {l.season || "General"}
                      </span>
                    </div>
                    <h3 className="font-bold text-white text-sm group-hover:text-primary transition-colors mb-1">{l.name}</h3>
                    <p className="text-xs text-neutral-500">{l.farm_size} Ha</p>
                    <div className="mt-4 pt-4 border-t border-neutral-800 flex items-center justify-between">
                      <span className="text-xs text-neutral-400 font-semibold">Est. Total</span>
                      <span className="text-sm font-bold text-primary">₹{l.estimated_total_cost.toLocaleString("en-IN")}</span>
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
          body { background: white !important; }
          .glass { background: white !important; border-color: #e5e7eb !important; }
          * { color: black !important; }
        }
      `}</style>
    </div>
  );
}
