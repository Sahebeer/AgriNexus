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
  CheckCircle,
  X,
  Sparkles,
  Info,
  Scale,
  Users,
  Briefcase,
  AlertTriangle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const CROPS = [
  "Rice", "Wheat", "Cotton", "Tomato", "Potato", "Sugarcane", "Mustard", "Corn",
  "Soybean", "Chickpeas (Gram)", "Groundnut", "Onion", "Apple", "Mango",
];

const LOCATIONS = [
  "Khanna, Punjab", "Karnal, Haryana", "Hapur, Uttar Pradesh", "Mathura, Uttar Pradesh",
  "Indore, Madhya Pradesh", "Kolar, Karnataka", "Pune, Maharashtra", "Kota, Rajasthan",
  "Azadpur, Delhi", "Gulabbagh, Bihar", "Sopore, Jammu & Kashmir",
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function MandiMarketplacePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<"marketplace" | "analytics">("marketplace");

  // Listings state
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [isLoadingListings, setIsLoadingListings] = useState(false);
  const [filterCrop, setFilterCrop] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterLoc, setFilterLoc] = useState("");

  // Price indices & recommendations state
  const [marketPrices, setMarketPrices] = useState<CropPriceData[]>([]);
  const [activePriceCrop, setActivePriceCrop] = useState<CropPriceData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Listing Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newCrop, setNewCrop] = useState("Rice");
  const [newQty, setNewQty] = useState("");
  const [newUnit, setNewUnit] = useState("qtl");
  const [newPrice, setNewPrice] = useState("");
  const [newLoc, setNewLoc] = useState("Khanna, Punjab");
  const [newPhone, setNewPhone] = useState("");
  const [newType, setNewType] = useState("seller");
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
      showToast("Failed to load listings", "error");
    } finally {
      setIsLoadingListings(false);
    }
  };

  const fetchMyListings = async () => {
    try {
      const res = await api.get("/api/v1/mandi/listings/my");
      setMyListings(res.data);
    } catch {
      // Ignore background errors
    }
  };

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const pricesRes = await api.get("/api/v1/prices/market");
      setMarketPrices(pricesRes.data);
      if (pricesRes.data && pricesRes.data.length > 0) {
        setActivePriceCrop(pricesRes.data[0]);
      }
      const analyticsRes = await api.get("/api/v1/mandi/analytics");
      setAnalytics(analyticsRes.data);
    } catch {
      showToast("Failed to fetch analytics", "error");
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

  useEffect(() => {
    if (user?.phone_number) {
      setNewPhone(user.phone_number);
    }
    if (user?.state) {
      const matchedLoc = LOCATIONS.find(l => l.includes(user.state));
      if (matchedLoc) setNewLoc(matchedLoc);
    }
  }, [user]);

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
      // Reset form
      setNewQty("");
      setNewPrice("");
      setNewDesc("");
      // Refresh listings
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
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      {/* Header */}
      <header className="glass sticky top-0 z-40 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-neutral-400 hover:text-white p-2 rounded-xl hover:bg-neutral-800 transition-all"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div>
                <span className="font-display font-bold text-white text-lg">Mandi Marketplace</span>
                <p className="text-[10px] text-neutral-500 -mt-0.5 font-semibold uppercase tracking-wider">Trading Platform & Price Analytics</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-neutral-900 border border-neutral-800 rounded-xl p-1 gap-1">
              <button
                onClick={() => setActiveTab("marketplace")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "marketplace" ? "bg-primary text-neutral-950" : "text-neutral-400 hover:text-white"}`}
              >
                Marketplace Listings
              </button>
              <button
                onClick={() => setActiveTab("analytics")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === "analytics" ? "bg-primary text-neutral-950" : "text-neutral-400 hover:text-white"}`}
              >
                Price Analytics
              </button>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-primary hover:bg-primary-600 text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs transition-all"
            >
              <Plus className="h-4 w-4" />
              Post Listing
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full space-y-6">

        {/* ─── TAB 1: MARKETPLACE LISTINGS ──────────────────────────────── */}
        {activeTab === "marketplace" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Filter Sidebar */}
            <div className="space-y-6">
              <div className="glass border border-neutral-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-xs font-bold text-neutral-300 border-b border-neutral-900 pb-3 flex items-center gap-2">
                  <Search className="h-4 w-4 text-primary" /> Filter Board
                </h3>
                
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Crop</label>
                  <select
                    value={filterCrop}
                    onChange={e => setFilterCrop(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary transition-colors"
                  >
                    <option value="">All Crops</option>
                    {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Listing Type</label>
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary transition-colors"
                  >
                    <option value="">All Listings</option>
                    <option value="seller">Sellers (Farmers)</option>
                    <option value="buyer">Buyers (Traders)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">Location / Regional Mandi</label>
                  <select
                    value={filterLoc}
                    onChange={e => setFilterLoc(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-primary transition-colors"
                  >
                    <option value="">All Mandis</option>
                    {LOCATIONS.map(loc => <option key={loc} value={loc.split(",")[0]}>{loc}</option>)}
                  </select>
                </div>
              </div>

              {/* My active listing sub-panel */}
              {myListings.length > 0 && (
                <div className="glass border border-neutral-800 rounded-3xl p-6 space-y-4">
                  <h3 className="text-xs font-bold text-neutral-300 border-b border-neutral-900 pb-3">My Listings</h3>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {myListings.map(l => (
                      <div key={l.id} className="p-3 bg-neutral-900/60 border border-neutral-850 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs font-semibold">
                          <span className="text-white truncate max-w-[120px]">{l.crop}</span>
                          <span className={l.status === "active" ? "text-primary" : "text-neutral-500"}>
                            {l.status}
                          </span>
                        </div>
                        <div className="text-[10px] text-neutral-500">{l.quantity} {l.unit} @ ₹{l.price_per_unit}</div>
                        
                        {l.status === "active" && (
                          <div className="flex gap-2 pt-1">
                            <button
                              onClick={() => handleCompleteListing(l.id)}
                              className="flex-1 bg-primary/10 text-primary border border-primary/20 text-[9px] font-bold py-1 rounded hover:bg-primary/20"
                            >
                              Complete
                            </button>
                            <button
                              onClick={() => handleDeleteListing(l.id)}
                              className="p-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded hover:bg-red-500/20"
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

            {/* Marketplace Ads Grid */}
            <div className="lg:col-span-3">
              {isLoadingListings ? (
                <div className="flex flex-col items-center justify-center py-20 text-neutral-500 gap-3">
                  <RefreshCw className="h-6 w-6 text-primary animate-spin" />
                  <span className="text-xs font-semibold">Loading marketplace board...</span>
                </div>
              ) : listings.length === 0 ? (
                <div className="glass border border-neutral-800 rounded-3xl p-16 text-center">
                  <Store className="h-10 w-10 text-neutral-700 mx-auto mb-4" />
                  <h3 className="font-bold text-neutral-300 mb-2">No Active Listings</h3>
                  <p className="text-xs text-neutral-500">Be the first to post a buying or selling listing in this mandi context.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {listings.map(l => (
                    <div key={l.id} className="glass border border-neutral-800 hover:border-neutral-750 transition-all rounded-3xl p-6 flex flex-col justify-between">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                            l.listing_type === "seller"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-400"
                          }`}>
                            {l.listing_type === "seller" ? "Seller (Farmer)" : "Buyer (Trader)"}
                          </span>
                          <span className="text-neutral-500 text-[10px] font-semibold">
                            {new Date(l.created_at).toLocaleDateString("en-IN")}
                          </span>
                        </div>

                        <div>
                          <h3 className="text-lg font-bold text-white mb-1">{l.crop}</h3>
                          <div className="text-sm font-bold text-primary">
                            ₹{l.price_per_unit.toLocaleString("en-IN")}/{l.unit}
                          </div>
                          <div className="text-xs text-neutral-300 mt-1">Quantity: {l.quantity} {l.unit}</div>
                        </div>

                        {l.description && (
                          <p className="text-xs text-neutral-400 leading-relaxed line-clamp-2">{l.description}</p>
                        )}
                      </div>

                      <div className="border-t border-neutral-900/60 pt-4 mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-semibold">
                          <MapPin className="h-4 w-4 text-neutral-500" />
                          <span>{l.location}</span>
                        </div>
                        <a
                          href={`tel:${l.contact_number}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-all w-full sm:w-auto justify-center"
                        >
                          <Phone className="h-3.5 w-3.5" /> Call Trader
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
            
            {/* Top Insight Grid: Recommendations + Demand Indices */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Selling Recommendations */}
              <div className="glass border border-primary/10 rounded-3xl p-6 lg:col-span-2 space-y-4 bg-primary/[0.01]">
                <div className="flex items-center gap-2 border-b border-neutral-900 pb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-bold text-white">Recommended Selling Windows</h3>
                </div>
                
                {isLoadingAnalytics ? (
                  <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {analytics?.selling_recommendations.map((rec, i) => (
                      <div key={i} className="glass border border-neutral-800 p-4 rounded-xl space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold text-white">
                          <span>{rec.crop}</span>
                          <span className="text-emerald-400">+{rec.premium_percent}%</span>
                        </div>
                        <div className="text-[10px] text-neutral-500 font-medium">{rec.best_mandi}</div>
                        <p className="text-[10px] text-neutral-400 leading-normal pt-1.5 border-t border-neutral-900">{rec.best_time_to_sell}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Demand ratios */}
              <div className="glass border border-neutral-800 rounded-3xl p-6 space-y-4">
                <h3 className="text-sm font-bold text-neutral-300 border-b border-neutral-900 pb-3">Demand vs Supply Index</h3>
                
                {isLoadingAnalytics ? (
                  <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></div>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {analytics?.demand_index.map((d, i) => (
                      <div key={i} className="flex justify-between items-center text-xs font-semibold">
                        <span className="text-neutral-400">{d.crop}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            d.status === "High Demand" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                            d.status.includes("Oversupply") ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                            "bg-neutral-900 text-neutral-400 border border-neutral-850"
                          }`}>{d.status}</span>
                          <span className="text-white font-bold">{d.demand_ratio.toFixed(2)}x</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Commodity prices comparative table */}
            <div className="glass border border-neutral-800 rounded-3xl p-6">
              <h3 className="text-sm font-bold text-neutral-300 border-b border-neutral-900 pb-3 mb-6">Regional Mandi Pricing</h3>
              
              {isLoadingAnalytics ? (
                <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                  {/* Crop selection sidebar */}
                  <div className="space-y-2 lg:border-r lg:border-neutral-900 lg:pr-6 max-h-96 overflow-y-auto pr-1">
                    {marketPrices.map(c => (
                      <button
                        key={c.crop}
                        onClick={() => setActivePriceCrop(c)}
                        className={`w-full text-left p-3 rounded-xl border transition-all text-xs font-bold flex justify-between items-center ${
                          activePriceCrop?.crop === c.crop ? "bg-primary/10 border-primary text-primary" : "border-neutral-850 text-neutral-400 hover:border-neutral-750"
                        }`}
                      >
                        <span>{c.crop}</span>
                        <span className={c.change_percent >= 0 ? "text-emerald-400" : "text-red-400"}>
                          {c.change_percent >= 0 ? "+" : ""}{c.change_percent}%
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Mandis rates details */}
                  <div className="lg:col-span-3 space-y-6">
                    {activePriceCrop && (
                      <>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-2xl">
                            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Government MSP</span>
                            <div className="text-lg font-bold text-white mt-1">
                              {activePriceCrop.msp > 0 ? `₹${activePriceCrop.msp.toLocaleString("en-IN")}/qtl` : "No MSP set"}
                            </div>
                          </div>
                          <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-2xl">
                            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Mandi High</span>
                            <div className="text-lg font-bold text-white mt-1">
                              ₹{activePriceCrop.high_price.toLocaleString("en-IN")}/qtl
                            </div>
                          </div>
                          <div className="p-4 bg-primary/5 border border-primary/15 rounded-2xl">
                            <span className="text-[10px] text-primary uppercase tracking-widest font-bold">Modal Average</span>
                            <div className="text-lg font-bold text-primary mt-1">
                              ₹{activePriceCrop.average_price.toLocaleString("en-IN")}/qtl
                            </div>
                          </div>
                        </div>

                        {/* Mandi comparison list */}
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest">Regional Comparisons</div>
                          {activePriceCrop.mandis.map((m, i) => (
                            <div key={i} className="flex justify-between items-center p-4 bg-neutral-900/40 border border-neutral-850 rounded-xl text-xs">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-neutral-500" />
                                <span className="font-bold text-white">{m.name}</span>
                              </div>
                              <div className="flex items-center gap-6">
                                <span className="text-neutral-500">Vol: {m.volume_tons} tons</span>
                                <span className="font-bold text-primary">₹{m.price.toLocaleString("en-IN")}/qtl</span>
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="glass border border-neutral-800 rounded-3xl w-full max-w-lg overflow-hidden relative animate-slide-up">
            
            {/* Header */}
            <div className="border-b border-neutral-800 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Post Marketplace Listing</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Post crop sales or buying inquiries.</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateListing}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Listing Type</label>
                    <select
                      value={newType}
                      onChange={e => setNewType(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-medium"
                    >
                      <option value="seller">Seller (Farmer listing crop)</option>
                      <option value="buyer">Buyer (Trader looking to buy)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Crop</label>
                    <select
                      value={newCrop}
                      onChange={e => setNewCrop(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-medium"
                    >
                      {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Quantity</label>
                    <input
                      type="number"
                      value={newQty}
                      onChange={e => setNewQty(e.target.value)}
                      placeholder="e.g. 50"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Unit</label>
                    <select
                      value={newUnit}
                      onChange={e => setNewUnit(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                    >
                      <option value="qtl">Quintals (qtl)</option>
                      <option value="kg">kg</option>
                      <option value="tonnes">Tonnes</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Target Price (INR per unit)</label>
                    <input
                      type="number"
                      value={newPrice}
                      onChange={e => setNewPrice(e.target.value)}
                      placeholder="e.g. 2350"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Contact Phone</label>
                    <input
                      type="text"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      placeholder="Phone number"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Mandi / Location</label>
                  <select
                    value={newLoc}
                    onChange={e => setNewLoc(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                  >
                    {LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Listing Description (optional)</label>
                  <textarea
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="Details about quality, crop age, packaging preferences, moisture content, etc."
                    rows={3}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>

              </div>

              {/* Footer */}
              <div className="border-t border-neutral-800 p-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-200 font-semibold py-3 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-primary hover:bg-primary-600 disabled:opacity-50 text-neutral-950 font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,200,117,0.15)]"
                >
                  {isSubmitting ? <><RefreshCw className="h-4 w-4 animate-spin" />Posting...</> : "Publish Ad"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
