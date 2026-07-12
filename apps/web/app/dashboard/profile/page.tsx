"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import api from "../../../lib/api";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import { 
  ArrowLeft, 
  User, 
  Settings, 
  Map, 
  MapPin, 
  Plus, 
  Save, 
  CheckCircle, 
  Lock, 
  Phone, 
  Activity,
  Layers,
  Sprout,
  Compass,
  AlertCircle
} from "lucide-react";

interface FarmField {
  id: string;
  name: string;
  size: number;
  soil_type: string;
  irrigation_method: string;
  coordinates: string;
  crop: string;
  crop_history: string;
}

export default function ProfilePage() {
  const { user, checkAuth } = useAuthStore();
  const { showToast } = useToastStore();
  
  // Tab control
  const [activeTab, setActiveTab] = useState<"account" | "farms">("account");
  
  // Account Form states
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [locationState, setLocationState] = useState("");
  const [password, setPassword] = useState("");
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Farms states (persisted locally on client for immediate MVP demonstration)
  const [farms, setFarms] = useState<FarmField[]>([]);
  
  // New Farm form state
  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmSize, setNewFarmSize] = useState(1.0);
  const [newSoilType, setNewSoilType] = useState("Loam");
  const [newIrrigation, setNewIrrigation] = useState("Drip Irrigation");
  const [newCoordinates, setNewCoordinates] = useState("");
  const [newCrop, setNewCrop] = useState("Rice");
  const [newCropHistory, setNewCropHistory] = useState("");
  const [showAddFarm, setShowAddFarm] = useState(false);

  const cropsList = [
    "Rice", "Wheat", "Corn", "Barley", "Millet", "Sorghum", "Oats",
    "Chickpeas (Gram)", "Lentils (Masoor)", "Pigeon Peas (Tur)", "Mung Beans",
    "Tomato", "Potato", "Onion", "Garlic", "Ginger", "Chilli", "Cabbage", "Cauliflower", "Okra (Bhindi)", "Brinjal",
    "Apple", "Mango", "Banana", "Guava", "Orange", "Pomegranate", "Grapes", "Papaya",
    "Cotton", "Sugarcane", "Tea", "Coffee", "Rubber", "Tobacco",
    "Mustard", "Soybean", "Groundnut", "Sunflower", "Sesame", "Oil Palm"
  ];

  const statesList = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", 
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", 
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
  ];

  const soilTypesList = ["Loam", "Clay", "Sandy", "Clay Loam", "Sandy Loam", "Silt Loam", "Peat"];
  const irrigationList = ["Drip Irrigation", "Sprinkler", "Flood / Manual", "Rainfed", "Micro-sprinkler"];

  // Populate account states from user context
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhoneNumber(user.phone_number || "");
      setLocationState(user.state || "");
    }
  }, [user]);

  // Load farms from localstorage keyed by user email
  useEffect(() => {
    if (!user?.email) return;
    
    const key = `agrinexus_farms_${user.email}`;
    const saved = localStorage.getItem(key);
    
    if (saved) {
      try {
        setFarms(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse farms", e);
      }
    } else {
      // Default dummy farms ONLY if user name or email contains "rajesh"
      const nameMatch = user.full_name?.toLowerCase().includes("rajesh");
      const emailMatch = user.email.toLowerCase().includes("rajesh");
      
      if (nameMatch || emailMatch) {
        const dummyFarms = [
          {
            id: "f1",
            name: "North Canal Field",
            size: 2.5,
            soil_type: "Clay Loam",
            irrigation_method: "Drip Irrigation",
            coordinates: "30.9012° N, 75.8568° E",
            crop_history: "Paddy (Rice) -> Wheat"
          },
          {
            id: "f2",
            name: "Hill Orchard",
            size: 1.2,
            soil_type: "Sandy Loam",
            irrigation_method: "Micro-sprinkler",
            coordinates: "31.1048° N, 77.1734° E",
            crop_history: "Apple Trees"
          }
        ];
        setFarms(dummyFarms);
        localStorage.setItem(key, JSON.stringify(dummyFarms));
      } else {
        setFarms([]);
      }
    }
  }, [user]);

  const saveFarms = (updatedFarms: FarmField[]) => {
    setFarms(updatedFarms);
    if (user?.email) {
      localStorage.setItem(`agrinexus_farms_${user.email}`, JSON.stringify(updatedFarms));
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingAccount(true);
    setAccountSuccess(false);
    setAccountError(null);

    try {
      const payload: any = {
        full_name: fullName,
        phone_number: phoneNumber,
        state: locationState
      };
      if (password) {
        payload.password = password;
      }

      await api.put("/api/v1/auth/me", payload);
      await checkAuth(); // Reload user context in Zustand
      setAccountSuccess(true);
      setPassword("");
      showToast("Credentials updated successfully!", "success");
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Failed to update profile settings.";
      setAccountError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const handleAddFarm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmName) return;

    const newField: FarmField = {
      id: "f" + Date.now(),
      name: newFarmName,
      size: newFarmSize,
      soil_type: newSoilType,
      irrigation_method: newIrrigation,
      coordinates: newCoordinates || "Not recorded",
      crop: newCrop,
      crop_history: newCropHistory || "None logged"
    };

    const updated = [...farms, newField];
    saveFarms(updated);

    // Reset form
    setNewFarmName("");
    setNewFarmSize(1.0);
    setNewSoilType("Loam");
    setNewIrrigation("Drip Irrigation");
    setNewCoordinates("");
    setNewCrop("Rice");
    setNewCropHistory("");
    setShowAddFarm(false);
    showToast("New field registered successfully!", "success");
  };

  const handleDeleteFarm = (id: string) => {
    const updated = farms.filter((f) => f.id !== id);
    saveFarms(updated);
    showToast("Field profile deleted.", "info");
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
            <User className="h-5 w-5 text-primary" />
            Operator Profile Console
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">
        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 mb-8">
          <button
            onClick={() => setActiveTab("account")}
            className={`px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "account"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Credentials & Account
          </button>
          <button
            onClick={() => setActiveTab("farms")}
            className={`px-6 py-3.5 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "farms"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Farm Fields & Soil Profiles
          </button>
        </div>

        {activeTab === "account" ? (
          /* Tab 1: Account / Credentials */
          <div className="max-w-2xl mx-auto glass border border-neutral-800 rounded-3xl p-6 md:p-8">
            <div className="flex items-center gap-3 border-b border-neutral-900 pb-5 mb-6">
              <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl text-primary">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Update Credentials</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Edit contact details and update terminal password keys.</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Operator Name"
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+91 XXXXX XXXXX"
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all"
                    />
                  </div>
                </div>

                {/* State */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Location State
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <select
                      value={locationState}
                      onChange={(e) => setLocationState(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all appearance-none"
                    >
                      <option value="" className="text-neutral-500">Select State</option>
                      {statesList.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Update Password (Leave blank to keep current)
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="New Password Key"
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all"
                  />
                </div>
              </div>

              {/* Success / Error overlays */}
              {accountSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm flex items-center gap-3 animate-fade-in">
                  <CheckCircle className="h-5 w-5 flex-shrink-0" />
                  <span>Profile updated successfully!</span>
                </div>
              )}

              {accountError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-start gap-3 animate-fade-in">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                  <span>{accountError}</span>
                </div>
              )}

              {/* Action Save Button */}
              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-600 text-neutral-950 font-bold py-3.5 rounded-xl text-sm transition-all duration-300 shadow-[0_0_15px_rgba(0,200,117,0.15)] flex items-center justify-center gap-2 group disabled:opacity-50"
                disabled={isUpdatingAccount}
              >
                {isUpdatingAccount ? (
                  <span className="h-5 w-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Commit Credentials Changes
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* Tab 2: Farm Fields & Soil Profiles */
          <div className="space-y-6">
            
            {/* Header list panel */}
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">Registered Landholdings</h3>
                <p className="text-xs text-neutral-500 mt-1">Manage multiple crop fields, configure soil structures, and edit GPS tags.</p>
              </div>

              <button
                onClick={() => setShowAddFarm(!showAddFarm)}
                className="bg-primary hover:bg-primary-600 text-neutral-950 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,200,117,0.1)]"
              >
                <Plus className="h-4 w-4" />
                Add Field
              </button>
            </div>

            {/* Inline Add Farm Form */}
            {showAddFarm && (
              <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 animate-fade-in">
                <div className="flex items-center gap-2 border-b border-neutral-900 pb-4 mb-6">
                  <h4 className="font-bold text-white">Register New Crop Field</h4>
                </div>

                <form onSubmit={handleAddFarm} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Field Name */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        Field Name *
                      </label>
                      <input
                        type="text"
                        value={newFarmName}
                        onChange={(e) => setNewFarmName(e.target.value)}
                        placeholder="e.g. West Canal Bed"
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-sm text-white outline-none"
                        required
                      />
                    </div>

                    {/* Land Size */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        Land Size (Hectares) *
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        value={newFarmSize}
                        onChange={(e) => setNewFarmSize(parseFloat(e.target.value))}
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-sm text-white outline-none"
                        required
                      />
                    </div>

                    {/* GPS Coordinates */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        GPS Coordinates
                      </label>
                      <input
                        type="text"
                        value={newCoordinates}
                        onChange={(e) => setNewCoordinates(e.target.value)}
                        placeholder="e.g. 30.9015° N, 75.8569° E"
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-sm text-white outline-none"
                      />
                    </div>

                    {/* Soil Type */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        Soil Type
                      </label>
                      <select
                        value={newSoilType}
                        onChange={(e) => setNewSoilType(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none"
                      >
                        {soilTypesList.map((soil) => (
                          <option key={soil} value={soil}>{soil}</option>
                        ))}
                      </select>
                    </div>

                    {/* Irrigation Method */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        Irrigation Method
                      </label>
                      <select
                        value={newIrrigation}
                        onChange={(e) => setNewIrrigation(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none"
                      >
                        {irrigationList.map((irr) => (
                          <option key={irr} value={irr}>{irr}</option>
                        ))}
                      </select>
                    </div>

                    {/* Primary Crop */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        Primary Crop *
                      </label>
                      <select
                        value={newCrop}
                        onChange={(e) => setNewCrop(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-sm text-white outline-none appearance-none"
                        required
                      >
                        {cropsList.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>

                    {/* Crop History */}
                    <div>
                      <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                        Crop Rotation History
                      </label>
                      <input
                        type="text"
                        value={newCropHistory}
                        onChange={(e) => setNewCropHistory(e.target.value)}
                        placeholder="e.g. Wheat → Rice → Fallow"
                        className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 px-4 text-sm text-white outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button
                      type="button"
                      onClick={() => setShowAddFarm(false)}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-200 font-semibold py-3 rounded-xl text-xs transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-primary hover:bg-primary-600 text-neutral-950 font-bold py-3 rounded-xl text-xs transition-colors"
                    >
                      Confirm Registration
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Farms Grid list */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {farms.map((farm) => (
                <div 
                  key={farm.id}
                  className="glass border border-neutral-800 rounded-3xl p-6 flex flex-col justify-between hover:border-neutral-700 transition-all duration-300 relative group"
                >
                  <button
                    onClick={() => handleDeleteFarm(farm.id)}
                    className="absolute top-4 right-4 text-neutral-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </button>

                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 border border-primary/20 p-2 rounded-lg text-primary">
                        <Map className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-base">{farm.name}</h4>
                          {farm.crop && (
                            <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                              {farm.crop}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-neutral-500 font-semibold">{farm.size} Hectares</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 border-t border-neutral-900/60 pt-4 text-xs font-semibold">
                      <div>
                        <span className="text-neutral-500 block">Soil Profile</span>
                        <span className="text-neutral-200 block mt-0.5">{farm.soil_type}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Irrigation Channel</span>
                        <span className="text-neutral-200 block mt-0.5">{farm.irrigation_method}</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">GPS Coordinates</span>
                        <span className="text-neutral-200 block mt-0.5 flex items-center gap-1">
                          <Compass className="h-3 w-3 text-primary flex-shrink-0" />
                          {farm.coordinates}
                        </span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Primary Crop</span>
                        <span className="text-primary block mt-0.5 font-bold">{farm.crop || "Not set"}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-neutral-500 block">Crop Rotation History</span>
                        <span className="text-neutral-200 block mt-0.5">{farm.crop_history}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}

function Trash2Icon({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M3 6h18"/>
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    </svg>
  );
}
