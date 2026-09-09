"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import {
  ArrowLeft,
  Store,
  TrendingUp,
  MapPin,
  Phone,
  Plus,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  X,
  Sparkles,
  Info,
  Scale,
  Users,
  Briefcase,
  AlertTriangle,
} from "lucide-react";

interface Listing {
  id: number;
  user_id: number;
  crop: string;
  quantity: number;
  unit: string;
  price_per_unit: number;
  location: string;
  contact_number: string;
  listing_type: string; // seller | buyer
  status: string;
  description: string;
  created_at: string;
}

interface PriceMandi {
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
  mandis: PriceMandi[];
  history_7d: number[];
}

interface DemandIndex {
  crop: string;
  demand_ratio: number;
  status: string;
}

interface SellingRecommendation {
  crop: string;
  best_mandi: string;
  premium_percent: number;
  best_time_to_sell: string;
}

interface AnalyticsData {
  demand_index: DemandIndex[];
  selling_recommendations: SellingRecommendation[];
}

const CROPS = [
  "Rice", "Wheat", "Cotton", "Tomato", "Potato", "Sugarcane", "Mustard", "Corn",
  "Soybean", "Chickpeas (Gram)", "Groundnut", "Onion", "Apple", "Mango",
];

const LOCATIONS = [
  "Khanna, Punjab", "Karnal, Haryana", "Hapur, Uttar Pradesh", "Mathura, Uttar Pradesh",
  "Indore, Madhya Pradesh", "Kolar, Karnataka", "Pune, Maharashtra", "Kota, Rajasthan",
  "Azadpur, Delhi", "Gulabbagh, Bihar", "Sopore, Jammu & Kashmir",
];

export default function MandiMarketplacePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<"marketplace" | "analytics">("marketplace");

  // Tab 1: Marketplace States
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [filterCrop, setFilterCrop] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterLoc, setFilterLoc] = useState("");
  const [isLoadingListings, setIsLoadingListings] = useState(false);

  // Tab 2: Analytics States
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [marketPrices, setMarketPrices] = useState<CropPriceData[]>([]);
  const [activePriceCrop, setActivePriceCrop] = useState<CropPriceData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Compose Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newType, setNewType] = useState("seller");
  const [newCrop, setNewCrop] = useState("Wheat");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("qtl");
  const [newPrice, setNewPrice] = useState("");
  const [newLoc, setNewLoc] = useState(LOCATIONS[0]);
  const [newPhone, setNewPhone] = useState(user?.phone_number || "");
  const [newDesc, setNewDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchListings = async () => {
    setIsLoadingListings(true);
    try {
      const res = await api.get("/api/v1/mandi/listings", {
        params: {
          crop: filterCrop || undefined,
          listing_type: filterType || undefined,
          location: filterLoc || undefined,
        },
      });
      setListings(res.data);
    } catch {
      showToast("Failed to fetch marketplace listings", "error");
    } finally {
      setIsLoadingListings(false);
    }
  };

  const fetchMyListings = async () => {
    try {
      const res = await api.get("/api/v1/mandi/listings/me");
      setMyListings(res.data);
    } catch {
      // Ignore silently
    }
  };

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const [analyticsRes, pricesRes] = await Promise.all([
        api.get("/api/v1/mandi/analytics"),
        api.get("/api/v1/prices/market"),
      ]);
      setAnalytics(analyticsRes.data);
      setMarketPrices(pricesRes.data);
      if (pricesRes.data.length > 0 && !activePriceCrop) {
        setActivePriceCrop(pricesRes.data[0]);
      }
    } catch {
      showToast("Failed to load price intelligence", "error");
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    fetchListings();
    fetchMyListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCrop, filterType, filterLoc]);

  useEffect(() => {
    if (activeTab === "analytics") {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQty || parseFloat(newQty) <= 0) {
      showToast("Please enter a valid quantity", "error");
      return;
    }
    if (!newPrice || parseFloat(newPrice) <= 0) {
      showToast("Please enter a valid target price", "error");
      return;
    }
    if (!newPhone.trim()) {
      showToast("Please enter contact phone number", "error");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post("/api/v1/mandi/listings", {
        crop: newCrop,
        quantity: parseFloat(newQty),
        unit: newUnit,
        price_per_unit: parseFloat(newPrice),
        location: newLoc,
        contact_number: newPhone,
        listing_type: newType,
        description: newDesc,
      });
      showToast("Marketplace listing posted!", "success");
      setIsModalOpen(false);
      setNewQty("");
      setNewPrice("");
      setNewDesc("");
      fetchListings();
      fetchMyListings();
    } catch {
      showToast("Failed to submit listing", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteListing = async (id: number) => {
    try {
      await api.patch(`/api/v1/mandi/listings/${id}`, { status: "completed" });
      showToast("Listing marked as completed", "success");
      fetchListings();
      fetchMyListings();
    } catch {
      showToast("Failed to update status", "error");
    }
  };

  const handleDeleteListing = async (id: number) => {
    if (!confirm("Are you sure you want to delete this listing?")) return;
    try {
      await api.delete(`/api/v1/mandi/listings/${id}`);
      showToast("Listing deleted", "success");
      fetchListings();
      fetchMyListings();
    } catch {
      showToast("Failed to delete listing", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans pb-16">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-slate-500 hover:text-slate-900 p-2 rounded-xl hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-purple-50 text-purple-600 p-2 rounded-xl border border-purple-100">
                <Store className="h-5 w-5" />
              </div>
              <div>
                <span className="font-display font-bold text-slate-900 text-base">Mandi Marketplace</span>
                <p className="text-xs text-slate-500">Trading Platform & Price Intelligence</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-100 rounded-xl p-1 gap-1 border border-slate-200">
              <button
                onClick={() => setActiveTab("marketplace")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "marketplace" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                Marketplace
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "analytics" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-900"}`}
              >
                Price Analytics
              </button>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              Post Listing
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full space-y-6">

        {/* ─── TAB 1: MARKETPLACE LISTINGS ──────────────────────────────── */}
        {activeTab === "marketplace" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            
            {/* Filter Sidebar */}
            <div className="space-y-6">
              <div className="clean-card p-6 space-y-4 bg-white shadow-sm">
                <h3 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-emerald-600" /> Filter Listings
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Crop</label>
                    <select
                      value={filterCrop}
                      onChange={e => setFilterCrop(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      <option value="">All Crops</option>
                      {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Listing Type</label>
                    <select
                      value={filterType}
                      onChange={e => setFilterType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      <option value="">All Listings</option>
                      <option value="seller">Sellers (Farmers)</option>
                      <option value="buyer">Buyers (Traders)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location / Mandi</label>
                    <select
                      value={filterLoc}
                      onChange={e => setFilterLoc(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      <option value="">All Mandis</option>
                      {LOCATIONS.map(loc => <option key={loc} value={loc.split(",")[0]}>{loc}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* My active listing sub-panel */}
              {myListings.length > 0 && (
                <div className="clean-card p-6 space-y-4 bg-white shadow-sm">
                  <h3 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-3">My Listings</h3>
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {myListings.map(l => (
                      <div key={l.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-slate-900 truncate max-w-[120px]">{l.crop}</span>
                          <span className={l.status === "active" ? "text-emerald-700 font-bold" : "text-slate-400"}>
                            {l.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">{l.quantity} {l.unit} @ ₹{l.price_per_unit}</div>
                        
                        {l.status === "active" && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleCompleteListing(l.id)}
                              className="flex-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold py-1 rounded hover:bg-emerald-100"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => handleDeleteListing(l.id)}
                              className="p-1 bg-rose-50 text-rose-600 border border-rose-200 rounded hover:bg-rose-100"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Marketplace Grid */}
            <div className="lg:col-span-3">
              {isLoadingListings ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                  <RefreshCw className="h-6 w-6 text-emerald-600 animate-spin" />
                  <span className="text-xs font-semibold">Loading marketplace board...</span>
                </div>
              ) : listings.length === 0 ? (
                <div className="clean-card p-16 text-center bg-white shadow-sm">
                  <Store className="h-8 w-8 text-slate-400 mx-auto mb-3" />
                  <h3 className="font-bold text-slate-800 text-sm mb-1">No Active Listings</h3>
                  <p className="text-xs text-slate-500">Post a buying or selling listing in this mandi context.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {listings.map(l => (
                    <div key={l.id} className="clean-card clean-card-hover p-5 flex flex-col justify-between bg-white shadow-sm">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            l.listing_type === "seller"
                              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                              : "bg-blue-50 border-blue-200 text-blue-800"
                          }`}>
                            {l.listing_type === "seller" ? "Seller (Farmer)" : "Buyer (Trader)"}
                          </span>
                          <span className="text-slate-400 text-[10px]">
                            {new Date(l.created_at).toLocaleDateString("en-IN")}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-base font-bold text-slate-900 mb-0.5">{l.crop}</h3>
                          <div className="text-sm font-bold text-emerald-700">
                            ₹{l.price_per_unit.toLocaleString("en-IN")}/{l.unit}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">Quantity: {l.quantity} {l.unit}</div>
                        </div>

                        {l.description && (
                          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{l.description}</p>
                        )}
                      </div>

                      <div className="border-t border-slate-100 pt-3.5 mt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>{l.location}</span>
                        </div>
                        <a
                          href={`tel:${l.contact_number}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-all w-full sm:w-auto justify-center"
                        >
                          <Phone className="h-3 w-3" /> Call Contact
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ─── TAB 2: PRICE ANALYTICS ───────────────────────────────────── */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            
            {/* Top Insight Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Selling Recommendations */}
              <div className="clean-card p-6 lg:col-span-2 space-y-4 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">Recommended Selling Windows</h3>
                </div>
                
                {isLoadingAnalytics ? (
                  <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-emerald-600" /></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {analytics?.selling_recommendations.map((rec, i) => (
                      <div key={i} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center text-xs font-bold text-slate-900">
                          <span>{rec.crop}</span>
                          <span className="text-emerald-700 font-bold">+{rec.premium_percent}%</span>
                        </div>
                        <div className="text-[11px] text-slate-500">{rec.best_mandi}</div>
                        <p className="text-[11px] text-slate-600 leading-snug pt-1 border-t border-slate-200">{rec.best_time_to_sell}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Demand ratios */}
              <div className="clean-card p-6 space-y-4 bg-white shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Demand vs Supply Index</h3>
                
                {isLoadingAnalytics ? (
                  <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-emerald-600" /></div>
                ) : (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {analytics?.demand_index.map((d, i) => (
                      <div key={i} className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-slate-600">{d.crop}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            d.status === "High Demand" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" :
                            d.status.includes("Oversupply") ? "bg-rose-50 text-rose-700 border border-rose-200" :
                            "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}>{d.status}</span>
                          <span className="text-slate-900 font-bold">{d.demand_ratio.toFixed(2)}x</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Commodity prices comparative table */}
            <div className="clean-card p-6 bg-white shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 mb-5">Regional Mandi Pricing</h3>
              
              {isLoadingAnalytics ? (
                <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-emerald-600" /></div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                  {/* Crop selection */}
                  <div className="space-y-1.5 lg:border-r lg:border-slate-100 lg:pr-4 max-h-80 overflow-y-auto pr-1">
                    {marketPrices.map(c => (
                      <button
                        key={c.crop}
                        onClick={() => setActivePriceCrop(c)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs font-semibold flex justify-between items-center ${
                          activePriceCrop?.crop === c.crop ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span>{c.crop}</span>
                        <span className={c.change_percent >= 0 ? "text-emerald-700" : "text-rose-600"}>
                          {c.change_percent >= 0 ? "+" : ""}{c.change_percent}%
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Details */}
                  <div className="lg:col-span-3 space-y-5">
                    {activePriceCrop && (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">MSP</span>
                            <div className="text-base font-bold text-slate-900 mt-0.5">
                              {activePriceCrop.msp > 0 ? `₹${activePriceCrop.msp.toLocaleString("en-IN")}/qtl` : "No MSP set"}
                            </div>
                          </div>
                          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Mandi High</span>
                            <div className="text-base font-bold text-slate-900 mt-0.5">
                              ₹{activePriceCrop.high_price.toLocaleString("en-IN")}/qtl
                            </div>
                          </div>
                          <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl">
                            <span className="text-[10px] text-emerald-800 uppercase tracking-wider font-bold">Modal Average</span>
                            <div className="text-base font-bold text-emerald-800 mt-0.5">
                              ₹{activePriceCrop.average_price.toLocaleString("en-IN")}/qtl
                            </div>
                          </div>
                        </div>

                        {/* Comparisons */}
                        <div className="space-y-2">
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Regional Comparisons</div>
                          {activePriceCrop.mandis.map((m, i) => (
                            <div key={i} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-semibold text-slate-900">{m.name}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-slate-400">Vol: {m.volume_tons} tons</span>
                                <span className="font-bold text-emerald-700">₹{m.price.toLocaleString("en-IN")}/qtl</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Post Listing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="clean-card bg-white rounded-2xl w-full max-w-lg overflow-hidden relative shadow-2xl">
            
            {/* Header */}
            <div className="border-b border-slate-100 p-5 flex justify-between items-center">
              <div>
                <h3 className="text-base font-bold text-slate-900">Post Marketplace Listing</h3>
                <p className="text-xs text-slate-500">List crops for sale or post buying requirements.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateListing}>
              <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Listing Type</label>
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      <option value="seller">Seller (Farmer listing crop)</option>
                      <option value="buyer">Buyer (Trader looking to buy)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Crop</label>
                    <select
                      value={newCrop}
                      onChange={e => setNewCrop(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Quantity</label>
                    <input
                      type="number"
                      value={newQty}
                      onChange={e => setNewQty(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Unit</label>
                    <select
                      value={newUnit}
                      onChange={e => setNewUnit(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                    >
                      <option value="qtl">Quintals (qtl)</option>
                      <option value="kg">kg</option>
                      <option value="tonnes">Tonnes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Price (₹ per unit)</label>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      placeholder="e.g. 2350"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Phone</label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Location / Mandi</label>
                  <select
                    value={newLoc}
                    onChange={e => setNewLoc(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs outline-none focus:bg-white focus:border-emerald-600 transition-colors"
                  >
                    {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">Description (optional)</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Details about quality, moisture content, packaging..."
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs placeholder-slate-400 outline-none focus:bg-white focus:border-emerald-600 transition-colors resize-none"
                  />
                </div>

              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 p-4 flex gap-3 bg-slate-50">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isSubmitting ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" />Publishing...</> : "Publish Listing"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
