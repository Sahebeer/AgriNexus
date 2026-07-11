"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { 
  ArrowLeft, 
  Coins, 
  Search, 
  MapPin, 
  Layers, 
  Sprout, 
  ChevronRight, 
  CheckCircle, 
  X, 
  FileText, 
  TrendingUp, 
  Sliders,
  CheckSquare,
  Square,
  AlertCircle,
  RefreshCw
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
  description: string;
  benefits: string;
  documents: string[];
  checklist: CriterionMatch[];
  match_score: number;
}

export default function SchemesPage() {
  const { user } = useAuthStore();
  
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

  const availableCrops = ["Rice", "Wheat", "Tomato", "Potato", "Corn", "Apple"];

  // Default pre-population from profile on mount
  useEffect(() => {
    if (user?.state) {
      setSelectedState(user.state);
    }
  }, [user]);

  // Fetch recommendations
  const fetchRecommendations = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const cropsParam = selectedCrops.join(",");
      const res = await api.get("/api/v1/schemes/recommend", {
        params: {
          farm_size: farmSize,
          crops: cropsParam
        }
      });
      setRecommendations(res.data);
    } catch (err: any) {
      setError("Failed to fetch recommended subsidies. Please check connectivity.");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch catalog
  const fetchCatalog = async () => {
    try {
      const res = await api.get("/api/v1/schemes/all", {
        params: { search: searchQuery || undefined }
      });
      setCatalog(res.data);
    } catch (err) {
      console.error("Failed to load catalog:", err);
    }
  };

  // Trigger recommendation search on mount and filter changes
  useEffect(() => {
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState, farmSize, selectedCrops]);

  // Trigger catalog search when query changes
  useEffect(() => {
    fetchCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const toggleCropSelection = (crop: string) => {
    setSelectedCrops((prev) =>
      prev.includes(crop) ? prev.filter((c) => c !== crop) : [...prev, crop]
    );
  };

  const handleApplyScheme = (schemeId: string) => {
    setAppliedSchemes((prev) => ({
      ...prev,
      [schemeId]: "Applied"
    }));
    // Close modal on click
    setSelectedScheme((prev: any) => prev ? { ...prev, isApplied: true } : null);
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
            <Coins className="h-5 w-5 text-amber-400" />
            Government Subsidies & Schemes
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-6 py-10 w-full">
        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 mb-8">
          <button
            onClick={() => setActiveTab("recommendations")}
            className={`px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "recommendations"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Tailored Subsidies
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "catalog"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            All Subsidies Catalog
          </button>
        </div>

        {activeTab === "recommendations" ? (
          /* Tailored Subsidies Tab */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Filter Panel (Left) */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              <div className="glass border border-neutral-800 rounded-3xl p-6">
                <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-primary" />
                  Eligibility Filters
                </h3>

                <div className="space-y-6">
                  {/* Location State */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                      Location State
                    </label>
                    <select
                      value={selectedState}
                      onChange={(e) => setSelectedState(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-sm text-white outline-none transition-all appearance-none"
                    >
                      <option value="" className="text-neutral-500">Select Location</option>
                      {states.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  {/* Land Size */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Farm Size
                      </label>
                      <span className="text-xs font-bold text-primary">{farmSize} Hectares</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="10.0"
                      step="0.5"
                      value={farmSize}
                      onChange={(e) => setFarmSize(parseFloat(e.target.value))}
                      className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none"
                    />
                    <div className="flex justify-between text-[10px] text-neutral-600 mt-1 font-semibold">
                      <span>0.5 Ha</span>
                      <span>5.0 Ha</span>
                      <span>10.0 Ha</span>
                    </div>
                  </div>

                  {/* Cultivated Crops */}
                  <div>
                    <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-3">
                      Crops Cultivated
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {availableCrops.map((crop) => {
                        const selected = selectedCrops.includes(crop);
                        return (
                          <button
                            key={crop}
                            onClick={() => toggleCropSelection(crop)}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                              selected
                                ? "bg-primary/10 border-primary text-primary"
                                : "border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200"
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
            <div className="lg:col-span-8 flex flex-col gap-6">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
                  <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                  <span className="text-xs font-semibold">Running matching rules...</span>
                </div>
              ) : error ? (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-6 rounded-3xl text-sm flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              ) : recommendations.length === 0 ? (
                <div className="glass border border-neutral-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[300px] text-neutral-500">
                  <Coins className="h-10 w-10 text-neutral-700 mb-4" />
                  <h3 className="font-bold text-neutral-300 mb-2">No Matching Subsidies</h3>
                  <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
                    Try adjusting your filters (e.g. select different crops or expand your land holding size) to search different guidelines.
                  </p>
                </div>
              ) : (
                recommendations.map((rec) => (
                  <div 
                    key={rec.id}
                    className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row justify-between gap-6 transition-all duration-300 hover:border-neutral-700"
                  >
                    <div className="flex-1 space-y-4">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">
                          {rec.category}
                        </span>
                        <span className="text-xs text-neutral-500">{rec.agency}</span>
                      </div>
                      
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2">{rec.name}</h3>
                        <p className="text-neutral-400 text-sm leading-relaxed max-w-2xl">{rec.description}</p>
                      </div>

                      {/* Matching parameters checklist */}
                      <div className="pt-2 flex flex-wrap gap-x-6 gap-y-2 border-t border-neutral-900">
                        {rec.checklist.map((c, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs font-semibold">
                            {c.status === "matches" ? (
                              <CheckCircle className="h-4 w-4 text-primary" />
                            ) : (
                              <AlertCircle className="h-4 w-4 text-red-400" />
                            )}
                            <span className="text-neutral-400">{c.criterion}:</span>
                            <span className="text-neutral-200">{c.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick apply buttons */}
                    <div className="flex flex-col justify-between items-end gap-4 min-w-[150px] border-t md:border-t-0 border-neutral-900 pt-4 md:pt-0">
                      <div className="text-right">
                        <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Match Score</div>
                        <div className="text-xl font-bold text-primary">{rec.match_score}% Match</div>
                      </div>

                      <div className="w-full space-y-2">
                        <button
                          onClick={() => setSelectedScheme(rec)}
                          className="w-full bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1 transition-all"
                        >
                          View Requirements
                          <ChevronRight className="h-4 w-4" />
                        </button>
                        
                        <button
                          onClick={() => handleApplyScheme(rec.id)}
                          className={`w-full font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 ${
                            appliedSchemes[rec.id]
                              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                              : "bg-primary hover:bg-primary-600 text-neutral-950 shadow-[0_0_10px_rgba(0,200,117,0.1)]"
                          }`}
                          disabled={!!appliedSchemes[rec.id]}
                        >
                          {appliedSchemes[rec.id] ? (
                            <>
                              <CheckCircle className="h-4 w-4" />
                              Applied Online
                            </>
                          ) : (
                            "Apply Online"
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
            <div className="glass border border-neutral-800 rounded-2xl p-4 flex items-center gap-3 relative max-w-xl">
              <Search className="h-5 w-5 text-neutral-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subsidies by name, agency, or crop keywords..."
                className="w-full bg-transparent text-sm text-white placeholder-neutral-500 outline-none"
              />
            </div>

            {/* Catalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {catalog.map((scheme) => (
                <div 
                  key={scheme.id}
                  className="glass border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between hover:border-neutral-700 transition-all group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-neutral-900 border border-neutral-850 text-neutral-400">
                        {scheme.category}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white group-hover:text-primary transition-colors">
                      {scheme.name}
                    </h3>
                    <p className="text-neutral-400 text-xs leading-relaxed line-clamp-3">
                      {scheme.description}
                    </p>
                  </div>

                  <div className="border-t border-neutral-900/60 pt-4 mt-6 flex gap-2">
                    <button
                      onClick={() => setSelectedScheme(scheme)}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-200 font-semibold py-2 rounded-xl text-xs transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleApplyScheme(scheme.id)}
                      className={`flex-1 font-bold py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-1 ${
                        appliedSchemes[scheme.id]
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          : "bg-primary hover:bg-primary-600 text-neutral-950"
                      }`}
                      disabled={!!appliedSchemes[scheme.id]}
                    >
                      {appliedSchemes[scheme.id] ? "Applied" : "Apply"}
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="glass border border-neutral-800 rounded-3xl w-full max-w-2xl overflow-hidden relative animate-slide-up">
            
            {/* Header */}
            <div className="border-b border-neutral-800 p-6 flex justify-between items-start">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary mb-2 inline-block">
                  {selectedScheme.category}
                </span>
                <h3 className="text-xl font-bold text-white">{selectedScheme.name}</h3>
                <p className="text-xs text-neutral-500 mt-1">{selectedScheme.agency}</p>
              </div>
              <button 
                onClick={() => setSelectedScheme(null)}
                className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable details */}
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
              
              {/* Description */}
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Description</h4>
                <p className="text-sm text-neutral-300 leading-relaxed">{selectedScheme.description}</p>
              </div>

              {/* Benefits */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/10 flex gap-3">
                <TrendingUp className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Financial & Support Benefits</h4>
                  <p className="text-xs md:text-sm text-neutral-300 leading-relaxed font-semibold">{selectedScheme.benefits}</p>
                </div>
              </div>

              {/* Required Documents */}
              <div>
                <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Required Application Documents</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {selectedScheme.documents.map((doc: string, idx: number) => (
                    <div key={idx} className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-850 flex items-center gap-2.5">
                      <FileText className="h-4 w-4 text-neutral-500 flex-shrink-0" />
                      <span className="text-xs text-neutral-300 font-medium">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer triggers */}
            <div className="border-t border-neutral-800 p-6 flex gap-4">
              <button
                onClick={() => setSelectedScheme(null)}
                className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-200 font-semibold py-3 rounded-xl text-xs transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleApplyScheme(selectedScheme.id)}
                className={`flex-[2] font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 ${
                  appliedSchemes[selectedScheme.id] || selectedScheme.isApplied
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                    : "bg-primary hover:bg-primary-600 text-neutral-950 shadow-[0_0_15px_rgba(0,200,117,0.15)]"
                }`}
                disabled={!!appliedSchemes[selectedScheme.id] || selectedScheme.isApplied}
              >
                {appliedSchemes[selectedScheme.id] || selectedScheme.isApplied ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Applied Successfully
                  </>
                ) : (
                  "Confirm Application & Submit"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
