"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import { 
  ArrowLeft, 
  Coins, 
  Search, 
  MapPin, 
  Layers, 
  Sprout, 
  ChevronRight, 
  CheckCircle2, 
  X, 
  FileText, 
  TrendingUp, 
  Sliders,
  CheckSquare,
  Square,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Phone
} from "lucide-react";

interface CriterionMatch {
  criterion: string;
  value: string;
  status: string;
}

interface SchemeRecommendation {
  id: string;
  name: string;
  agency: string;
  category: string;
  scope: string;
  description: string;
  benefits: string;
  documents: string[];
  helpline: string;
  portal_url: string;
  checklist: CriterionMatch[];
  match_score: number;
}

export default function SchemesPage() {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  
  // Filter states
  const [farmSize, setFarmSize] = useState<number>(1.5);
  const [selectedCrops, setSelectedCrops] = useState<string[]>([]);
  const [selectedState, setSelectedState] = useState<string>("");
  
  // View states
  const [activeTab, setActiveTab] = useState<"recommendations" | "catalog">("recommendations");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [recommendations, setRecommendations] = useState<SchemeRecommendation[]>([]);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<any | null>(null);
  
  // Status states
  const [appliedSchemes, setAppliedSchemes] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", 
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", 
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
  ];

  const availableCrops = [
    "Rice", "Wheat", "Corn", "Barley", "Millet", "Sorghum", "Oats",
    "Chickpeas (Gram)", "Lentils (Masoor)", "Pigeon Peas (Tur)", "Mung Beans",
    "Tomato", "Potato", "Onion", "Garlic", "Ginger", "Chilli", "Cabbage", "Cauliflower", "Okra (Bhindi)", "Brinjal",
    "Apple", "Mango", "Banana", "Guava", "Orange", "Pomegranate", "Grapes", "Papaya",
    "Cotton", "Sugarcane", "Tea", "Coffee", "Rubber", "Tobacco",
    "Mustard", "Soybean", "Groundnut", "Sunflower", "Sesame", "Oil Palm"
  ];

  // Default pre-population from profile and localStorage active fields on mount
  useEffect(() => {
    if (user?.state) {
      setSelectedState(user.state);
    }
    
    if (user?.email) {
      try {
        const stored = localStorage.getItem(`agrinexus_farms_${user.email}`);
        if (stored) {
          const farms = JSON.parse(stored);
          if (farms && farms.length > 0) {
            let totalHa = 0;
            const cropsFound: string[] = [];
            for (const f of farms) {
              if (f.area_hectares) totalHa += Number(f.area_hectares);
              if (f.current_crop && !cropsFound.includes(f.current_crop)) {
                cropsFound.push(f.current_crop);
              }
            }
            if (totalHa > 0) setFarmSize(Math.min(Math.max(Number(totalHa.toFixed(1)), 0.5), 10.0));
            if (cropsFound.length > 0) setSelectedCrops(cropsFound);
          }
        }
      } catch (e) {
        console.error("Local storage farm parsing error inside schemes:", e);
      }
    }
  }, [user]);

  // Fetch tailored recommendations
  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload = {
        state: selectedState || undefined,
        land_size_ha: farmSize,
        crops: selectedCrops.length > 0 ? selectedCrops : undefined
      };
      const res = await api.post("/api/v1/schemes/recommend", payload);
      setRecommendations(res.data.recommendations || []);
    } catch (err: any) {
      setError("Failed to calculate scheme eligibility. Please check backend connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch full catalog
  const fetchCatalog = async () => {
    try {
      const res = await api.get("/api/v1/schemes/catalog", {
        params: {
          search: searchQuery || undefined,
          state: selectedState || undefined
        }
      });
      setCatalog(res.data.schemes || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === "recommendations") {
      fetchRecommendations();
    } else {
      fetchCatalog();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, farmSize, selectedCrops, activeTab, searchQuery]);

  const toggleCropSelection = (crop: string) => {
    if (selectedCrops.includes(crop)) {
      setSelectedCrops(selectedCrops.filter(c => c !== crop));
    } else {
      setSelectedCrops([...selectedCrops, crop]);
    }
  };

  const handleApplyScheme = (schemeId: string) => {
    setAppliedSchemes((prev) => ({
      ...prev,
      [schemeId]: "Application recorded"
    }));
    showToast("Scheme bookmarked to operator profile.", "success");
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
              <Coins className="h-5 w-5 text-amber-600" />
              Government Schemes & Subsidies
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-8 w-full">
        {/* Intro */}
        <div className="mb-6">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-slate-900 mb-1.5">Subsidy Eligibility Engine</h2>
          <p className="text-slate-600 text-sm">
            Discover central and state government programs, PM-KISAN, crop insurance, and fertilizer subsidies matched to your farm profile.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mb-8">
          <button
            onClick={() => setActiveTab("recommendations")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "recommendations"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Matched Subsidies
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-6 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "catalog"
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            Complete Directory
          </button>
        </div>

        {activeTab === "recommendations" ? (
          /* Tailored Subsidies Tab */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Filter Panel (Left) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="clean-card p-6 bg-white shadow-sm">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-5 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-emerald-600" />
                  Eligibility Criteria
                </h3>

                <div className="space-y-5">
                  {/* Location State */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                      State / Region
                    </label>
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl py-2.5 px-3 text-xs text-slate-900 outline-none transition-all"
                    >
                      <option value="">Select Location</option>
                      {states.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {/* Land Size */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Total Landholding
                      </label>
                      <span className="text-xs font-bold text-emerald-700">{farmSize} Hectares</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="10.0"
                      step="0.5"
                      value={farmSize}
                      onChange={(e) => setFarmSize(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-medium">
                      <span>0.5 Ha</span>
                      <span>5.0 Ha</span>
                      <span>10.0 Ha</span>
                    </div>
                  </div>

                  {/* Cultivated Crops */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      Target Crops
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1">
                      {availableCrops.map((crop) => {
                        const selected = selectedCrops.includes(crop);
                        return (
                          <button
                            key={crop}
                            onClick={() => toggleCropSelection(crop)}
                            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                              selected
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800 font-semibold"
                                : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
                            }`}
                          >
                            {crop}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations List (Right) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin" />
                  <span className="text-xs font-semibold">Matching agricultural schemes...</span>
                </div>
              ) : error ? (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-5 rounded-2xl text-xs flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5 text-rose-600" />
                  <span>{error}</span>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="clean-card p-12 text-center flex flex-col items-center justify-center min-h-[280px] bg-white shadow-sm">
                  <Coins className="h-8 w-8 text-slate-400 mb-3" />
                  <h3 className="font-bold text-slate-800 text-sm mb-1">No Matching Schemes Found</h3>
                  <p className="text-xs text-slate-500 max-w-xs leading-relaxed">
                    Try adjusting your crop filters or state location to search broader agricultural categories.
                  </p>
                </div>
              ) : (
                recommendations.map((rec) => (
                  <div 
                    key={rec.id}
                    className="clean-card clean-card-hover p-6 flex flex-col md:flex-row justify-between gap-6 bg-white shadow-sm"
                  >
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
                          {rec.category}
                        </span>
                        <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                          rec.scope === "State"
                            ? "bg-amber-50 border-amber-200 text-amber-800"
                            : "bg-blue-50 border-blue-200 text-blue-800"
                        }`}>
                          {rec.scope === "State" ? "State Scheme" : "Central Scheme"}
                        </span>
                        <span className="text-xs text-slate-400">{rec.agency}</span>
                      </div>
                      
                      <div>
                        <h3 className="text-base font-bold text-slate-900 mb-1">{rec.name}</h3>
                        <p className="text-slate-600 text-xs leading-relaxed max-w-2xl">{rec.description}</p>
                      </div>

                      {/* Matching parameters checklist */}
                      <div className="pt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-slate-100">
                        {rec.checklist.map((c, idx) => (
                          <div key={idx} className="flex items-center gap-1.5 text-xs">
                            {c.status === "matches" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <AlertCircle className="h-3.5 w-3.5 text-rose-500" />
                            )}
                            <span className="text-slate-500">{c.criterion}:</span>
                            <span className="text-slate-800 font-medium">{c.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col justify-between items-end gap-3 min-w-[150px] border-t md:border-t-0 border-slate-100 pt-3 md:pt-0">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Match Score</div>
                        <div className="text-base font-bold text-emerald-700">{rec.match_score}% Match</div>
                      </div>

                      <div className="w-full space-y-2">
                        {rec.portal_url && (
                          <a
                            href={rec.portal_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
                          >
                            Official Portal
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <button
                          onClick={() => setSelectedScheme(rec)}
                          className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
                        >
                          Requirements
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                        
                        <button
                          onClick={() => handleApplyScheme(rec.id)}
                          className={`w-full font-semibold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1 ${
                            appliedSchemes[rec.id]
                              ? "bg-emerald-100 border border-emerald-300 text-emerald-800"
                              : "bg-white border border-slate-200 hover:bg-slate-50 text-slate-700"
                          }`}
                          disabled={!!appliedSchemes[rec.id]}
                        >
                          {appliedSchemes[rec.id] ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Saved
                            </>
                          ) : (
                            "Save to Profile"
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          /* Catalog Tab */
          <div className="space-y-6">
            {/* Search inputs */}
            <div className="clean-card p-3 flex items-center gap-3 bg-white max-w-md shadow-sm">
              <Search className="h-4 w-4 text-slate-400 ml-1" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subsidies by name, agency, or crop..."
                className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
              />
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {catalog.map((scheme) => (
                <div 
                  key={scheme.id}
                  className="clean-card clean-card-hover p-6 flex flex-col justify-between bg-white shadow-sm group"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${
                        scheme.scope === "State"
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-slate-100 border-slate-200 text-slate-600"
                      }`}>
                        {scheme.scope === "State" ? "State" : "Central"}
                      </span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-500">
                        {scheme.category}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {scheme.name}
                    </h3>
                    <p className="text-slate-600 text-xs leading-relaxed line-clamp-3">
                      {scheme.description}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-4 mt-5 flex gap-2">
                    <button
                      onClick={() => setSelectedScheme(scheme)}
                      className="flex-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2 rounded-xl text-xs transition-colors"
                    >
                      Details
                    </button>
                    <button
                      onClick={() => handleApplyScheme(scheme.id)}
                      className={`flex-1 font-semibold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1 ${
                        appliedSchemes[scheme.id]
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      }`}
                      disabled={!!appliedSchemes[scheme.id]}
                    >
                      {appliedSchemes[scheme.id] ? "Saved" : "Save"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Details Modal Overlay */}
      {selectedScheme && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="clean-card bg-white rounded-2xl w-full max-w-2xl overflow-hidden relative shadow-2xl">
            
            {/* Header */}
            <div className="border-b border-slate-100 p-6 flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 mb-2 inline-block">
                  {selectedScheme.category}
                </span>
                <h3 className="text-lg font-bold text-slate-900">{selectedScheme.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedScheme.agency}</p>
              </div>
              <button 
                onClick={() => setSelectedScheme(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-5">
              
              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">Description</h4>
                <p className="text-xs text-slate-700 leading-relaxed">{selectedScheme.description}</p>
              </div>

              {/* Benefits */}
              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-100 flex gap-3">
                <TrendingUp className="h-5 w-5 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-1">Financial & Support Benefits</h4>
                  <p className="text-xs text-emerald-800 leading-relaxed font-semibold">{selectedScheme.benefits}</p>
                </div>
              </div>

              {/* Helpline & Portal */}
              {(selectedScheme.helpline || selectedScheme.portal_url) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedScheme.helpline && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5">
                      <Phone className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Helpline</div>
                        <div className="text-xs text-slate-800 font-semibold">{selectedScheme.helpline}</div>
                      </div>
                    </div>
                  )}
                  {selectedScheme.portal_url && (
                    <a
                      href={selectedScheme.portal_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200 flex items-center gap-2.5 hover:bg-emerald-50 transition-all group"
                    >
                      <ExternalLink className="h-4 w-4 text-emerald-700 flex-shrink-0" />
                      <div>
                        <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-0.5">Official Portal</div>
                        <div className="text-xs text-emerald-900 font-semibold group-hover:underline truncate max-w-[160px]">{selectedScheme.portal_url.replace(/https?:\/\//, "")}</div>
                      </div>
                    </a>
                  )}
                </div>
              )}

              {/* Required Documents */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Required Documents</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedScheme.documents?.map((doc: string, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                      <span className="text-xs text-slate-700 font-medium">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 p-4 flex gap-3 bg-slate-50">
              <button
                onClick={() => setSelectedScheme(null)}
                className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
              >
                Close
              </button>
              {selectedScheme.portal_url && (
                <a
                  href={selectedScheme.portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  Apply on Official Portal
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
