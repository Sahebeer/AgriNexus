"use client";

import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
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
  Users,
  Briefcase
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
  listing_type: string;
  status: string;
  description: string;
  created_at: string;
}

interface MandiModuleProps {
  onBack?: () => void;
}

export default function MandiModule({ onBack }: MandiModuleProps) {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<"seller" | "buyer">("seller");
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchCrop, setSearchCrop] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New listing fields
  const [formCrop, setFormCrop] = useState("Wheat");
  const [formQuantity, setFormQuantity] = useState(10);
  const [formUnit, setFormUnit] = useState("Quintal");
  const [formPrice, setFormPrice] = useState(2400);
  const [formLocation, setFormLocation] = useState("Ludhiana, Punjab");
  const [formContact, setFormContact] = useState(user?.phone_number || "");
  const [formDescription, setFormDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchListings = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/v1/mandi/listings");
      setListings(res.data);
    } catch {
      showToast("Unable to refresh trade listings", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, []);

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await api.post("/api/v1/mandi/listings", {
        crop: formCrop,
        quantity: formQuantity,
        unit: formUnit,
        price_per_unit: formPrice,
        location: formLocation,
        contact_number: formContact,
        listing_type: activeTab,
        description: formDescription,
      });
      showToast("Marketplace listing published!", "success");
      setShowCreateModal(false);
      fetchListings();
    } catch {
      showToast("Failed to publish listing", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredListings = listings.filter((item) => {
    const matchesTab = item.listing_type === activeTab;
    const matchesCrop = searchCrop ? item.crop.toLowerCase().includes(searchCrop.toLowerCase()) : true;
    const matchesState = selectedState ? item.location.toLowerCase().includes(selectedState.toLowerCase()) : true;
    return matchesTab && matchesCrop && matchesState;
  });

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
              <Store className="h-5 w-5 text-emerald-600" />
              Mandi Marketplace & Trading Floor
            </h1>
            <p className="text-xs text-slate-500">Direct APMC farmer-to-buyer trade exchange with transparent price discovery</p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Post Lot for Sale</span>
        </button>
      </div>

      {/* Tabs & Search Bar */}
      <div className="clean-card p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* Toggle Switcher */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full md:w-auto">
          <button
            onClick={() => setActiveTab("seller")}
            className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "seller"
                ? "bg-white text-emerald-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Farmer Lots for Sale ({listings.filter((l) => l.listing_type === "seller").length})
          </button>
          <button
            onClick={() => setActiveTab("buyer")}
            className={`flex-1 md:flex-initial px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "buyer"
                ? "bg-white text-emerald-950 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Buyer Purchase Inquiries ({listings.filter((l) => l.listing_type === "buyer").length})
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-60">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchCrop}
              onChange={(e) => setSearchCrop(e.target.value)}
              placeholder="Search crop or variety..."
              className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none transition-colors"
            />
          </div>
          <button
            onClick={fetchListings}
            className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Listings Grid */}
      {isLoading ? (
        <div className="flex justify-center py-24"><RefreshCw className="h-8 w-8 animate-spin text-emerald-600" /></div>
      ) : filteredListings.length === 0 ? (
        <div className="clean-card p-16 text-center text-slate-400 space-y-3">
          <Store className="h-10 w-10 text-slate-300 mx-auto" />
          <h3 className="font-bold text-slate-700">No active listings matching criteria</h3>
          <p className="text-xs text-slate-400">Post a new harvest lot or inquiry to begin trade matching.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredListings.map((item) => (
            <div key={item.id} className="clean-card clean-card-hover p-5 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Crop Lot</span>
                    <h3 className="text-base font-bold text-slate-900 mt-0.5">{item.crop}</h3>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {item.quantity} {item.unit}
                  </span>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-baseline justify-between">
                  <span className="text-xs text-slate-500 font-medium">Offered Rate:</span>
                  <span className="text-base font-bold text-slate-900">₹{item.price_per_unit} / {item.unit}</span>
                </div>

                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{item.location}</span>
                  </div>
                  {item.description && <p className="text-[11px] text-slate-600 line-clamp-2 pt-1">{item.description}</p>}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <a
                  href={`tel:${item.contact_number}`}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span>Call {item.contact_number}</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Post Lot Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="border-b border-slate-100 p-6 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">Post Lot for Trading</h3>
                <p className="text-xs text-slate-500 mt-0.5">List your harvest with expected rate and pickup location.</p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateListing}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Crop Name *</label>
                    <input
                      type="text"
                      required
                      value={formCrop}
                      onChange={(e) => setFormCrop(e.target.value)}
                      placeholder="e.g. Basmati Rice"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Quantity *</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Unit</label>
                    <select
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors font-semibold"
                    >
                      <option value="Quintal">Quintal</option>
                      <option value="Ton">Ton</option>
                      <option value="Kg">Kg</option>
                      <option value="Bags">Bags (50kg)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Price Per Unit (₹) *</label>
                    <input
                      type="number"
                      required
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Location / Mandi Bed *</label>
                  <input
                    type="text"
                    required
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    placeholder="e.g. Ludhiana Mandi, Punjab"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Contact Number *</label>
                  <input
                    type="text"
                    required
                    value={formContact}
                    onChange={(e) => setFormContact(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Description (Variety, Moisture, Quality)</label>
                  <textarea
                    rows={2}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Grade A harvested lot with 12% moisture level, ready for immediate dispatch."
                    className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none transition-colors resize-none"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 p-5 bg-slate-50/50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm"
                >
                  {isSubmitting ? "Publishing..." : "Confirm & Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
