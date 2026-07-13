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
  AlertCircle,
  TrendingUp,
  FlaskConical,
  Droplets,
  Thermometer,
  Calendar,
  Trash2,
  Database,
  History,
  X,
  RefreshCw,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SoilReport {
  id: number;
  farm_id: number;
  ph: number;
  nitrogen: number;
  phosphorus: number;
  potassium: number;
  organic_carbon: number;
  soil_moisture: number;
  electrical_conductivity: number;
  temperature: number;
  humidity: number;
  soil_texture: string;
  test_date: string;
  source: string; // "manual" | "sensor" | "lab" | "api"
  created_at: string;
}

interface FarmField {
  id: number;
  name: string;
  area: number;
  area_unit: string;
  state: string;
  district: string;
  village: string;
  gps_coordinates: string;
  current_crop: string;
  sowing_date: string;
  irrigation_method: string;
  soil_reports: SoilReport[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CROPS = [
  "Rice", "Wheat", "Cotton", "Tomato", "Potato", "Sugarcane", "Mustard", "Corn",
  "Soybean", "Chickpeas (Gram)", "Groundnut", "Onion", "Apple", "Mango",
];

const STATES = [
  "Punjab", "Haryana", "Uttar Pradesh", "Madhya Pradesh", "Rajasthan", "Maharashtra",
  "Karnataka", "Tamil Nadu", "Gujarat", "Bihar", "West Bengal", "Andhra Pradesh",
];

const IRRIGATION_METHODS = ["Drip Irrigation", "Sprinkler", "Flood / Manual", "Rainfed"];
const SOIL_TEXTURES = ["Sandy", "Clayey", "Loamy", "Silt", "Sandy Loam", "Clay Loam"];

// ─── Helper Functions ──────────────────────────────────────────────────────────

function getPHStatus(val: number) {
  if (val < 5.5) return { label: "Strongly Acidic", color: "text-red-400 border-red-500/20 bg-red-500/10" };
  if (val < 6.5) return { label: "Slightly Acidic", color: "text-yellow-400 border-yellow-500/20 bg-yellow-500/10" };
  if (val <= 7.5) return { label: "Optimal", color: "text-emerald-400 border-emerald-500/20 bg-emerald-500/10" };
  return { label: "Alkaline", color: "text-blue-400 border-blue-500/20 bg-blue-500/10" };
}

function getMoistureStatus(val: number) {
  if (val < 15) return { label: "Dry Soil (Water Stress)", color: "text-red-400 bg-red-500/10 border-red-500/20" };
  if (val <= 30) return { label: "Good Moisture", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  return { label: "Waterlogged", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" };
}

function getNutrientStatus(val: number, low: number, high: number) {
  if (val < low) return { label: "Deficient", color: "text-red-400 bg-red-500/10 border-red-500/20" };
  if (val <= high) return { label: "Optimal", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" };
  return { label: "High / Excessive", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { user, checkAuth } = useAuthStore();
  const { showToast } = useToastStore();

  // Tab Control
  const [activeTab, setActiveTab] = useState<"account" | "farms">("account");
  const [activeSubTab, setActiveSubTab] = useState<"details" | "soil" | "history">("details");

  // Account form states
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [locationState, setLocationState] = useState("");
  const [password, setPassword] = useState("");
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  // Farms state
  const [farms, setFarms] = useState<FarmField[]>([]);
  const [activeFarm, setActiveFarm] = useState<FarmField | null>(null);
  const [isLoadingFarms, setIsLoadingFarms] = useState(false);

  // New Farm form state
  const [showAddFarm, setShowAddFarm] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmArea, setNewFarmArea] = useState(1.5);
  const [newFarmState, setNewFarmState] = useState("Punjab");
  const [newFarmDistrict, setNewFarmDistrict] = useState("");
  const [newFarmVillage, setNewFarmVillage] = useState("");
  const [newGPS, setNewGPS] = useState("");
  const [newCrop, setNewCrop] = useState("Rice");
  const [newSowDate, setNewSowDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newIrrigation, setNewIrrigation] = useState("Drip Irrigation");
  const [isSubmittingFarm, setIsSubmittingFarm] = useState(false);

  // New Soil report form state
  const [showAddSoil, setShowAddSoil] = useState(false);
  const [soilPH, setSoilPH] = useState(6.5);
  const [soilN, setSoilN] = useState(120);
  const [soilP, setSoilP] = useState(30);
  const [soilK, setSoilK] = useState(150);
  const [soilCarbon, setSoilCarbon] = useState(0.5);
  const [soilMoisture, setSoilMoisture] = useState(25);
  const [soilEC, setSoilEC] = useState(1.2);
  const [soilTemp, setSoilTemp] = useState(25);
  const [soilHumidity, setSoilHumidity] = useState(60);
  const [soilTexture, setSoilTexture] = useState("Loamy");
  const [soilDate, setSoilDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [soilSource, setSoilSource] = useState("manual"); // "manual" | "sensor" | "lab"
  const [isSubmittingSoil, setIsSubmittingSoil] = useState(false);

  // Load profile state
  useEffect(() => {
    if (user) {
      setFullName(user.full_name || "");
      setPhoneNumber(user.phone_number || "");
      setLocationState(user.state || "");
    }
  }, [user]);

  const fetchFarms = async () => {
    setIsLoadingFarms(true);
    try {
      const res = await api.get("/api/v1/farms/");
      setFarms(res.data);
      if (res.data.length > 0) {
        // Keep active farm updated if already selected, or default to first
        setActiveFarm(prev => {
          const matched = res.data.find((f: FarmField) => f.id === prev?.id);
          return matched || res.data[0];
        });
      } else {
        setActiveFarm(null);
      }
    } catch {
      showToast("Failed to fetch registered farms", "error");
    } finally {
      setIsLoadingFarms(false);
    }
  };

  useEffect(() => {
    if (activeTab === "farms") {
      fetchFarms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
      await checkAuth();
      setAccountSuccess(true);
      setPassword("");
      showToast("Profile credentials updated successfully!", "success");
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Failed to update profile settings.";
      setAccountError(errMsg);
      showToast(errMsg, "error");
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFarmName.trim()) {
      showToast("Please enter a field name", "error");
      return;
    }
    setIsSubmittingFarm(true);
    try {
      const res = await api.post("/api/v1/farms/", {
        name: newFarmName,
        area: newFarmArea,
        state: newFarmState,
        district: newFarmDistrict,
        village: newFarmVillage,
        gps_coordinates: newGPS || undefined,
        current_crop: newCrop,
        sowing_date: newSowDate,
        irrigation_method: newIrrigation,
      });
      showToast("Crop field registered successfully!", "success");
      setNewFarmName("");
      setNewFarmDistrict("");
      setNewFarmVillage("");
      setNewGPS("");
      setShowAddFarm(false);
      fetchFarms();
    } catch {
      showToast("Failed to register crop field", "error");
    } finally {
      setIsSubmittingFarm(false);
    }
  };

  const handleDeleteFarm = async (id: number) => {
    if (!confirm("Are you sure you want to delete this farm? This will permanently erase all historical soil health reports.")) return;
    try {
      await api.delete(`/api/v1/farms/${id}`);
      showToast("Farm field deleted", "info");
      fetchFarms();
    } catch {
      showToast("Failed to delete farm field", "error");
    }
  };

  const handleCreateSoilReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFarm) return;
    setIsSubmittingSoil(true);
    try {
      await api.post(`/api/v1/farms/${activeFarm.id}/soil`, {
        ph: soilPH,
        nitrogen: soilN,
        phosphorus: soilP,
        potassium: soilK,
        organic_carbon: soilCarbon,
        soil_moisture: soilMoisture,
        electrical_conductivity: soilEC,
        temperature: soilTemp,
        humidity: soilHumidity,
        soil_texture: soilTexture,
        test_date: soilDate,
        source: soilSource,
      });
      showToast("Soil report logged successfully", "success");
      setShowAddSoil(false);
      fetchFarms();
    } catch {
      showToast("Failed to log soil report", "error");
    } finally {
      setIsSubmittingSoil(false);
    }
  };

  const activeLatestReport = activeFarm?.soil_reports?.[0] || null;

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col text-neutral-100 font-sans pb-16">
      {/* Header */}
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
            Farmer & Farm Console
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-6 py-8 w-full">
        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 mb-8 max-w-lg">
          <button
            onClick={() => setActiveTab("account")}
            className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "account"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Account Details
          </button>
          <button
            onClick={() => setActiveTab("farms")}
            className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
              activeTab === "farms"
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-300"
            }`}
          >
            Farm & Soil Management
          </button>
        </div>

        {/* ─── TAB 1: ACCOUNT DETAILS ───────────────────────────────────── */}
        {activeTab === "account" && (
          <div className="max-w-2xl mx-auto glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6">
            <div className="flex items-center gap-3 border-b border-neutral-900 pb-5">
              <div className="bg-primary/10 border border-primary/20 p-2.5 rounded-xl text-primary">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Update Credentials</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Edit operator name, location parameters, and security credentials.</p>
              </div>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all font-semibold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <input
                      type="text"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Operator State</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <select
                      value={locationState}
                      onChange={(e) => setLocationState(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all appearance-none font-semibold"
                    >
                      <option value="">Select State</option>
                      {STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-wider mb-2">Update Password (leave blank to keep current)</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-900 border border-neutral-800 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white outline-none transition-all"
                  />
                </div>
              </div>

              {accountSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" /> Credentials committed successfully.
                </div>
              )}

              {accountError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" /> {accountError}
                </div>
              )}

              <button
                type="submit"
                disabled={isUpdatingAccount}
                className="w-full bg-primary hover:bg-primary-600 disabled:opacity-50 text-neutral-950 font-bold py-3 rounded-xl text-xs transition-all shadow-[0_0_15px_rgba(0,200,117,0.1)]"
              >
                {isUpdatingAccount ? "Saving details..." : "Commit Credentials Changes"}
              </button>
            </form>
          </div>
        )}

        {/* ─── TAB 2: FARM & SOIL MANAGEMENT ─────────────────────────────── */}
        {activeTab === "farms" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            
            {/* Left Column: Farm Selector / List */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">My Landholdings</span>
                <button
                  onClick={() => setShowAddFarm(true)}
                  className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all"
                  title="Add Field"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {isLoadingFarms ? (
                <div className="flex justify-center py-10"><RefreshCw className="h-5 w-5 animate-spin text-primary" /></div>
              ) : farms.length === 0 ? (
                <div className="text-center py-8 text-xs text-neutral-600">No fields registered.</div>
              ) : (
                <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                  {farms.map(f => (
                    <button
                      key={f.id}
                      onClick={() => { setActiveFarm(f); setActiveSubTab("details"); }}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex flex-col gap-1 ${
                        activeFarm?.id === f.id
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "glass border-neutral-850 text-neutral-400 hover:border-neutral-750"
                      }`}
                    >
                      <span className="font-bold text-sm text-white truncate w-full">{f.name}</span>
                      <span className="text-[10px] text-neutral-500 font-semibold">{f.area} Ha · {f.current_crop}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Active Farm Dashboard */}
            <div className="lg:col-span-3">
              {activeFarm ? (
                <div className="space-y-6">
                  {/* Dashboard Header Banner */}
                  <div className="glass border border-neutral-800 rounded-3xl p-6 flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full uppercase">
                          {activeFarm.current_crop}
                        </span>
                        {activeLatestReport && (
                          <span className="text-[10px] font-bold text-neutral-500 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded-full">
                            Texture: {activeLatestReport.soil_texture}
                          </span>
                        )}
                      </div>
                      <h2 className="font-display text-2xl font-bold text-white">{activeFarm.name}</h2>
                      <p className="text-xs text-neutral-400 mt-1">{activeFarm.village}, {activeFarm.district}, {activeFarm.state}</p>
                    </div>

                    <div className="flex gap-2 self-start sm:self-center">
                      <button
                        onClick={() => setShowAddSoil(true)}
                        className="bg-primary hover:bg-primary-600 text-neutral-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(0,200,117,0.1)]"
                      >
                        <Plus className="h-4 w-4" /> Log Soil Test
                      </button>
                      <button
                        onClick={() => handleDeleteFarm(activeFarm.id)}
                        className="p-2 border border-neutral-800 text-neutral-600 hover:text-red-400 hover:border-red-500/20 rounded-xl transition-all"
                        title="Delete farm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sub tabs: Details, Soil metrics gauges, Soil History chart */}
                  <div className="flex border-b border-neutral-900 max-w-sm">
                    {["details", "soil", "history"].map(tab => (
                      <button
                        key={tab}
                        onClick={() => setActiveSubTab(tab as any)}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                          activeSubTab === tab ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-300"
                        }`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>

                  {/* SUB TAB 1: FIELD DETAILS */}
                  {activeSubTab === "details" && (
                    <div className="glass border border-neutral-800 rounded-3xl p-6 space-y-6">
                      <h3 className="text-sm font-bold text-neutral-300 border-b border-neutral-900 pb-3 flex items-center gap-2">
                        <Map className="h-4 w-4 text-primary" /> Parameters Registry
                      </h3>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-xs font-semibold">
                        <div>
                          <span className="text-neutral-500 block">Total Area</span>
                          <span className="text-neutral-200 block mt-1">{activeFarm.area} {activeFarm.area_unit}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Sowing Date</span>
                          <span className="text-neutral-200 block mt-1">
                            {new Date(activeFarm.sowing_date + "T00:00:00").toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "long",
                              year: "numeric"
                            })}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Irrigation Channel</span>
                          <span className="text-neutral-200 block mt-1">{activeFarm.irrigation_method}</span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">GPS Tag coordinates</span>
                          <span className="text-neutral-200 mt-1 flex items-center gap-1">
                            <Compass className="h-3.5 w-3.5 text-primary" />
                            {activeFarm.gps_coordinates || "None logged"}
                          </span>
                        </div>
                        <div>
                          <span className="text-neutral-500 block">Location Node</span>
                          <span className="text-neutral-200 block mt-1">{activeFarm.village}, {activeFarm.district}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB TAB 2: SOIL HEALTH METRICS */}
                  {activeSubTab === "soil" && (
                    <div className="space-y-6 animate-fade-in">
                      {!activeLatestReport ? (
                        <div className="glass border border-neutral-800 rounded-3xl p-12 text-center text-xs text-neutral-600">
                          No soil report registered. Record a test above to view stats.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          
                          {/* NPK Chemical Health Card */}
                          <div className="glass border border-neutral-800 rounded-3xl p-6 md:col-span-3 space-y-4">
                            <div className="flex justify-between items-center border-b border-neutral-900 pb-3">
                              <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                                <FlaskConical className="h-4 w-4 text-primary" /> N-P-K Chemical Nutrition Profile
                              </span>
                              <span className="text-[10px] text-neutral-500 font-semibold">
                                Tested: {new Date(activeLatestReport.test_date + "T00:00:00").toLocaleDateString("en-IN")}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Nitrogen */}
                              <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-2xl space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-neutral-400">Nitrogen (N)</span>
                                  <span className={getNutrientStatus(activeLatestReport.nitrogen, 100, 200).color}>
                                    {getNutrientStatus(activeLatestReport.nitrogen, 100, 200).label}
                                  </span>
                                </div>
                                <div className="text-lg font-bold text-white">{activeLatestReport.nitrogen} mg/kg</div>
                                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: `${Math.min((activeLatestReport.nitrogen / 250) * 100, 100)}%` }} />
                                </div>
                              </div>

                              {/* Phosphorus */}
                              <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-2xl space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-neutral-400">Phosphorus (P)</span>
                                  <span className={getNutrientStatus(activeLatestReport.phosphorus, 20, 50).color}>
                                    {getNutrientStatus(activeLatestReport.phosphorus, 20, 50).label}
                                  </span>
                                </div>
                                <div className="text-lg font-bold text-white">{activeLatestReport.phosphorus} mg/kg</div>
                                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500" style={{ width: `${Math.min((activeLatestReport.phosphorus / 80) * 100, 100)}%` }} />
                                </div>
                              </div>

                              {/* Potassium */}
                              <div className="p-4 bg-neutral-900/60 border border-neutral-850 rounded-2xl space-y-2">
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-neutral-400">Potassium (K)</span>
                                  <span className={getNutrientStatus(activeLatestReport.potassium, 120, 240).color}>
                                    {getNutrientStatus(activeLatestReport.potassium, 120, 240).label}
                                  </span>
                                </div>
                                <div className="text-lg font-bold text-white">{activeLatestReport.potassium} mg/kg</div>
                                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-purple-500" style={{ width: `${Math.min((activeLatestReport.potassium / 300) * 100, 100)}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Gauge: Soil pH */}
                          <div className="glass border border-neutral-800 rounded-3xl p-5 space-y-3 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Soil pH Balance</span>
                              <div className="flex items-baseline gap-2 mt-2">
                                <h3 className="text-3xl font-bold text-white">{activeLatestReport.ph}</h3>
                                <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${getPHStatus(activeLatestReport.ph).color}`}>
                                  {getPHStatus(activeLatestReport.ph).label}
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] text-neutral-600 font-semibold leading-relaxed">
                              Optimal ph level for cereals (6.0 - 7.2) allows complete mineral absorption.
                            </div>
                          </div>

                          {/* Gauge: Moisture */}
                          <div className="glass border border-neutral-800 rounded-3xl p-5 space-y-3 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Soil Moisture</span>
                              <div className="flex items-baseline gap-2 mt-2">
                                <h3 className="text-3xl font-bold text-white">{activeLatestReport.soil_moisture}%</h3>
                                <span className={`text-[10px] font-bold border px-2 py-0.5 rounded-full ${getMoistureStatus(activeLatestReport.soil_moisture).color}`}>
                                  {getMoistureStatus(activeLatestReport.soil_moisture).label}
                                </span>
                              </div>
                            </div>
                            <div className="text-[10px] text-neutral-600 font-semibold leading-relaxed">
                              Active telemetry feed matching irrigation schedules.
                            </div>
                          </div>

                          {/* Physical Metrics */}
                          <div className="glass border border-neutral-800 rounded-3xl p-5 space-y-3 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Organic Carbon</span>
                              <h3 className="text-2xl font-bold text-white mt-1">{activeLatestReport.organic_carbon}%</h3>
                            </div>
                            <div className="border-t border-neutral-900 pt-2 flex justify-between text-[10px] text-neutral-600 font-semibold">
                              <span>EC: {activeLatestReport.electrical_conductivity} dS/m</span>
                              <span>Temp: {activeLatestReport.temperature}°C</span>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>
                  )}

                  {/* SUB TAB 3: SOIL REPORTS HISTORY & TRENDS */}
                  {activeSubTab === "history" && (
                    <div className="space-y-6 animate-fade-in">
                      {activeFarm.soil_reports.length <= 1 ? (
                        <div className="glass border border-neutral-800 rounded-3xl p-12 text-center text-xs text-neutral-600">
                          Need at least 2 soil reports logged to show trend comparison charts.
                        </div>
                      ) : (
                        <div className="glass border border-neutral-800 rounded-3xl p-6 space-y-6">
                          <h3 className="text-sm font-bold text-neutral-300 border-b border-neutral-900 pb-3 flex items-center gap-2">
                            <History className="h-4 w-4 text-primary" /> Nutrient Trends & pH Changes
                          </h3>

                          {/* Simplified dynamic SVG Line Chart for Soil pH trend */}
                          <div className="space-y-2">
                            <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest">Historical pH Profile</span>
                            <div className="h-40 w-full relative border-b border-l border-neutral-800 pt-4 pl-4 pr-4">
                              <svg className="w-full h-full" viewBox="0 0 100 30" preserveAspectRatio="none">
                                <path
                                  d={activeFarm.soil_reports
                                    .slice()
                                    .reverse()
                                    .map((rep, idx, arr) => {
                                      const x = (idx / (arr.length - 1)) * 100;
                                      // Scale pH (4.0 to 9.0 range scaled to 30px height)
                                      const y = 30 - ((rep.ph - 4) / 5) * 30;
                                      return `${idx === 0 ? "M" : "L"} ${x} ${y}`;
                                    })
                                    .join(" ")}
                                  fill="none"
                                  stroke="#00C875"
                                  strokeWidth="1.5"
                                />
                                {activeFarm.soil_reports
                                  .slice()
                                  .reverse()
                                  .map((rep, idx, arr) => {
                                    const x = (idx / (arr.length - 1)) * 100;
                                    const y = 30 - ((rep.ph - 4) / 5) * 30;
                                    return (
                                      <circle key={idx} cx={x} cy={y} r="1.5" fill="#ffffff" stroke="#00C875" strokeWidth="1" />
                                    );
                                  })}
                              </svg>
                              <div className="flex justify-between text-[8px] text-neutral-600 mt-2 font-semibold">
                                {activeFarm.soil_reports.slice().reverse().map((rep, idx) => (
                                  <span key={idx}>{new Date(rep.test_date + "T00:00:00").toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Comparison Report Log list */}
                          <div className="space-y-3">
                            <span className="text-xs font-bold text-neutral-400 uppercase tracking-widest block">Audit Log</span>
                            <div className="divide-y divide-neutral-900/60">
                              {activeFarm.soil_reports.map(rep => (
                                <div key={rep.id} className="py-3 flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-2">
                                    <Database className="h-4 w-4 text-neutral-500" />
                                    <div>
                                      <div className="font-bold text-white">Report #{rep.id} ({rep.source.toUpperCase()})</div>
                                      <div className="text-[10px] text-neutral-500">Texture: {rep.soil_texture}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-6 text-right">
                                    <div>
                                      <div className="font-bold text-primary">pH: {rep.ph}</div>
                                      <div className="text-[10px] text-neutral-500">N:{rep.nitrogen} P:{rep.phosphorus} K:{rep.potassium}</div>
                                    </div>
                                    <span className="text-[10px] text-neutral-400 font-semibold">
                                      {new Date(rep.test_date + "T00:00:00").toLocaleDateString("en-IN")}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              ) : (
                <div className="glass border border-neutral-800 rounded-3xl p-16 text-center">
                  <Map className="h-10 w-10 text-neutral-700 mx-auto mb-4" />
                  <h3 className="font-bold text-neutral-300 mb-2">No Active Farm Field</h3>
                  <p className="text-xs text-neutral-500">Please select an active field or register a new one.</p>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Register Farm Modal */}
      {showAddFarm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="glass border border-neutral-800 rounded-3xl w-full max-w-lg overflow-hidden relative animate-slide-up">
            <div className="border-b border-neutral-800 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Register Crop Field</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Register a landholding to config crop & soil parameters.</p>
              </div>
              <button
                onClick={() => setShowAddFarm(false)}
                className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFarm}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Field Name *</label>
                    <input
                      type="text"
                      value={newFarmName}
                      onChange={e => setNewFarmName(e.target.value)}
                      placeholder="e.g. West Canal Bed"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Land Area (Acres/Ha) *</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={newFarmArea}
                      onChange={e => setNewFarmArea(parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">State</label>
                    <select
                      value={newFarmState}
                      onChange={e => setNewFarmState(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                    >
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">District *</label>
                    <input
                      type="text"
                      value={newFarmDistrict}
                      onChange={e => setNewFarmDistrict(e.target.value)}
                      placeholder="e.g. Ludhiana"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Village *</label>
                    <input
                      type="text"
                      value={newFarmVillage}
                      onChange={e => setNewFarmVillage(e.target.value)}
                      placeholder="e.g. Khanna"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Current Crop *</label>
                    <select
                      value={newCrop}
                      onChange={e => setNewCrop(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                    >
                      {CROPS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Sowing Date *</label>
                    <input
                      type="date"
                      value={newSowDate}
                      onChange={e => setNewSowDate(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Irrigation Method *</label>
                    <select
                      value={newIrrigation}
                      onChange={e => setNewIrrigation(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                    >
                      {IRRIGATION_METHODS.map(irr => <option key={irr} value={irr}>{irr}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">GPS Tag (optional)</label>
                    <input
                      type="text"
                      value={newGPS}
                      onChange={e => setNewGPS(e.target.value)}
                      placeholder="e.g. 30.9015° N, 75.8569° E"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs placeholder-neutral-600 outline-none focus:border-primary transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-neutral-800 p-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowAddFarm(false)}
                  className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-200 font-semibold py-3 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFarm}
                  className="flex-[2] bg-primary hover:bg-primary-600 disabled:opacity-50 text-neutral-950 font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,200,117,0.15)]"
                >
                  {isSubmittingFarm ? <><RefreshCw className="h-4 w-4 animate-spin" />Registering...</> : "Confirm Registration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Soil Report Modal */}
      {showAddSoil && activeFarm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
          <div className="glass border border-neutral-800 rounded-3xl w-full max-w-lg overflow-hidden relative animate-slide-up">
            <div className="border-b border-neutral-800 p-6 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-white">Log Soil Chemistry Report</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Input laboratory or diagnostic test metrics for {activeFarm.name}.</p>
              </div>
              <button
                onClick={() => setShowAddSoil(false)}
                className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-neutral-900 border border-transparent hover:border-neutral-800 transition-all"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSoilReport}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Data Input Source</label>
                    <select
                      value={soilSource}
                      onChange={e => setSoilSource(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                    >
                      <option value="manual">Manual Entry (Operator)</option>
                      <option value="sensor">IoT Ground Probe Sensor</option>
                      <option value="lab">Soil Lab Report Profile</option>
                      <option value="api">External Regional Weather API</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Test Date</label>
                    <input
                      type="date"
                      value={soilDate}
                      onChange={e => setSoilDate(e.target.value)}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">pH (0.0 - 14.0)</label>
                    <input
                      type="number" step="0.1" min="0" max="14"
                      value={soilPH}
                      onChange={e => setSoilPH(parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Nitrogen (mg/kg)</label>
                    <input
                      type="number" step="1" min="0"
                      value={soilN}
                      onChange={e => setSoilN(parseInt(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Phosphorus</label>
                    <input
                      type="number" step="1" min="0"
                      value={soilP}
                      onChange={e => setSoilP(parseInt(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Potassium (K)</label>
                    <input
                      type="number" step="1" min="0"
                      value={soilK}
                      onChange={e => setSoilK(parseInt(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Organic Carbon %</label>
                    <input
                      type="number" step="0.01" min="0" max="100"
                      value={soilCarbon}
                      onChange={e => setSoilCarbon(parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Soil Moisture %</label>
                    <input
                      type="number" step="0.1" min="0" max="100"
                      value={soilMoisture}
                      onChange={e => setSoilMoisture(parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">EC (dS/m)</label>
                    <input
                      type="number" step="0.1" min="0"
                      value={soilEC}
                      onChange={e => setSoilEC(parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Temp (°C)</label>
                    <input
                      type="number" step="0.5"
                      value={soilTemp}
                      onChange={e => setSoilTemp(parseFloat(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Relative Humid %</label>
                    <input
                      type="number" step="1" min="0" max="100"
                      value={soilHumidity}
                      onChange={e => setSoilHumidity(parseInt(e.target.value))}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">Soil Texture</label>
                  <select
                    value={soilTexture}
                    onChange={e => setSoilTexture(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary transition-colors font-semibold"
                  >
                    {SOIL_TEXTURES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>

              <div className="border-t border-neutral-800 p-6 flex gap-4">
                <button
                  type="button"
                  onClick={() => setShowAddSoil(false)}
                  className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 text-neutral-200 font-semibold py-3 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSoil}
                  className="flex-[2] bg-primary hover:bg-primary-600 disabled:opacity-50 text-neutral-950 font-bold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-[0_0_15px_rgba(0,200,117,0.15)]"
                >
                  {isSubmittingSoil ? <><RefreshCw className="h-4 w-4 animate-spin" />Commiting...</> : "Commit Soil Test"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
