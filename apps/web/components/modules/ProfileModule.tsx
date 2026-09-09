"use client";

import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import {
  ArrowLeft,
  User,
  Settings,
  Map,
  MapPin,
  Plus,
  CheckCircle,
  Lock,
  Phone,
  Compass,
  AlertCircle,
  FlaskConical,
  Droplets,
  Trash2,
  Database,
  History,
  X,
  RefreshCw
} from "lucide-react";

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
  source: string;
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

interface ProfileModuleProps {
  onBack?: () => void;
}

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

function getPHStatus(val: number) {
  if (val < 5.5) return { label: "Strongly Acidic", color: "text-rose-700 border-rose-200 bg-rose-50" };
  if (val < 6.5) return { label: "Slightly Acidic", color: "text-amber-700 border-amber-200 bg-amber-50" };
  if (val <= 7.5) return { label: "Optimal", color: "text-emerald-700 border-emerald-200 bg-emerald-50" };
  return { label: "Alkaline", color: "text-blue-700 border-blue-200 bg-blue-50" };
}

function getMoistureStatus(val: number) {
  if (val < 15) return { label: "Dry Soil (Water Stress)", color: "text-rose-700 bg-rose-50 border-rose-200" };
  if (val <= 30) return { label: "Good Moisture", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  return { label: "Waterlogged", color: "text-blue-700 bg-blue-50 border-blue-200" };
}

function getNutrientStatus(val: number, low: number, high: number) {
  if (val < low) return { label: "Deficient", color: "text-rose-700 bg-rose-50 border-rose-200" };
  if (val <= high) return { label: "Optimal", color: "text-emerald-700 bg-emerald-50 border-emerald-200" };
  return { label: "High / Excessive", color: "text-amber-700 bg-amber-50 border-amber-200" };
}

export default function ProfileModule({ onBack }: ProfileModuleProps) {
  const { user, checkAuth } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<"account" | "farms">("farms");
  const [activeSubTab, setActiveSubTab] = useState<"details" | "soil" | "history" | "earth">("details");
  const [satelliteHistory, setSatelliteHistory] = useState<any[]>([]);
  const [earthForecasts, setEarthForecasts] = useState<any[]>([]);
  const [isLoadingEIE, setIsLoadingEIE] = useState(false);

  // Account form
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [locationState, setLocationState] = useState("");
  const [password, setPassword] = useState("");
  const [isUpdatingAccount, setIsUpdatingAccount] = useState(false);
  const [accountSuccess, setAccountSuccess] = useState(false);

  // Farms
  const [farms, setFarms] = useState<FarmField[]>([]);
  const [activeFarm, setActiveFarm] = useState<FarmField | null>(null);
  const [isLoadingFarms, setIsLoadingFarms] = useState(false);

  // Modals
  const [showAddFarm, setShowAddFarm] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmArea, setNewFarmArea] = useState(1.5);
  const [newFarmState, setNewFarmState] = useState("Punjab");
  const [newFarmDistrict, setNewFarmDistrict] = useState("");
  const [newFarmVillage, setNewFarmVillage] = useState("");
  const [newCrop, setNewCrop] = useState("Wheat");
  const [newSowDate, setNewSowDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [newIrrigation, setNewIrrigation] = useState("Drip Irrigation");
  const [isSubmittingFarm, setIsSubmittingFarm] = useState(false);

  // Soil modal
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
  const [isSubmittingSoil, setIsSubmittingSoil] = useState(false);

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
      const farmList = res.data || [];
      setFarms(farmList);
      if (farmList.length > 0) {
        setActiveFarm(farmList[0]);
      }
    } catch {
      // Fallback demo farm
    } finally {
      setIsLoadingFarms(false);
    }
  };

  useEffect(() => {
    fetchFarms();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingAccount(true);
    try {
      await api.put("/api/v1/auth/me", {
        full_name: fullName,
        phone_number: phoneNumber,
        state: locationState,
        ...(password ? { password } : {})
      });
      await checkAuth();
      setAccountSuccess(true);
      showToast("Profile credentials updated successfully", "success");
    } catch {
      showToast("Failed to update credentials", "error");
    } finally {
      setIsUpdatingAccount(false);
    }
  };

  const handleCreateFarm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingFarm(true);
    try {
      await api.post("/api/v1/farms/", {
        name: newFarmName,
        area: newFarmArea,
        state: newFarmState,
        district: newFarmDistrict,
        village: newFarmVillage,
        current_crop: newCrop,
        sowing_date: newSowDate,
        irrigation_method: newIrrigation,
      });
      showToast("Landholding registered successfully", "success");
      setShowAddFarm(false);
      fetchFarms();
    } catch {
      showToast("Failed to register landholding", "error");
    } finally {
      setIsSubmittingFarm(false);
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
        source: "manual",
      });
      showToast("Soil test metrics recorded!", "success");
      setShowAddSoil(false);
      fetchFarms();
    } catch {
      showToast("Failed to record soil report", "error");
    } finally {
      setIsSubmittingSoil(false);
    }
  };

  const activeLatestReport = activeFarm?.soil_reports?.[0] || null;

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
              <Compass className="h-5 w-5 text-emerald-600" />
              Farmer Profile & Soil Chemistry Console
            </h1>
            <p className="text-xs text-slate-500">Configure landholding boundaries, soil health laboratory profiles and operator security</p>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 max-w-lg">
        <button
          onClick={() => setActiveTab("farms")}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "farms" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Farm & Soil Management
        </button>
        <button
          onClick={() => setActiveTab("account")}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "account" ? "border-emerald-600 text-emerald-700" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Account Credentials
        </button>
      </div>

      {activeTab === "farms" ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Left Col: Farm Selector */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">My Landholdings</span>
              <button
                onClick={() => setShowAddFarm(true)}
                className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 transition-all"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            {farms.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">No fields registered.</div>
            ) : (
              <div className="space-y-2">
                {farms.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFarm(f)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col gap-1 ${
                      activeFarm?.id === f.id
                        ? "bg-emerald-50 border-emerald-300 text-emerald-950 shadow-sm"
                        : "clean-card hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <span className="font-bold text-sm text-slate-900 truncate w-full">{f.name}</span>
                    <span className="text-xs text-slate-500 font-medium">{f.area} Ha • {f.current_crop}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right Col: Active Farm Detail & Soil Stats */}
          <div className="lg:col-span-3 space-y-6">
            {activeFarm ? (
              <div className="space-y-6">
                <div className="clean-card p-6 flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full uppercase">
                      {activeFarm.current_crop}
                    </span>
                    <h2 className="text-2xl font-bold text-slate-900 mt-2">{activeFarm.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{activeFarm.village}, {activeFarm.district}, {activeFarm.state}</p>
                  </div>

                  <button
                    onClick={() => setShowAddSoil(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm self-start sm:self-center"
                  >
                    <Plus className="h-4 w-4" /> Log Soil Test
                  </button>
                </div>

                {/* Soil NPK Profile */}
                {activeLatestReport ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="clean-card p-6 md:col-span-3 space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                        <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                          <FlaskConical className="h-4 w-4 text-emerald-600" /> N-P-K Chemical Nutrition Profile
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                          Tested: {activeLatestReport.test_date}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-600">Nitrogen (N)</span>
                            <span className={getNutrientStatus(activeLatestReport.nitrogen, 100, 200).color}>
                              {getNutrientStatus(activeLatestReport.nitrogen, 100, 200).label}
                            </span>
                          </div>
                          <div className="text-lg font-bold text-slate-900">{activeLatestReport.nitrogen} mg/kg</div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-600" style={{ width: `${Math.min((activeLatestReport.nitrogen / 250) * 100, 100)}%` }} />
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-600">Phosphorus (P)</span>
                            <span className={getNutrientStatus(activeLatestReport.phosphorus, 20, 50).color}>
                              {getNutrientStatus(activeLatestReport.phosphorus, 20, 50).label}
                            </span>
                          </div>
                          <div className="text-lg font-bold text-slate-900">{activeLatestReport.phosphorus} mg/kg</div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600" style={{ width: `${Math.min((activeLatestReport.phosphorus / 80) * 100, 100)}%` }} />
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-slate-600">Potassium (K)</span>
                            <span className={getNutrientStatus(activeLatestReport.potassium, 120, 240).color}>
                              {getNutrientStatus(activeLatestReport.potassium, 120, 240).label}
                            </span>
                          </div>
                          <div className="text-lg font-bold text-slate-900">{activeLatestReport.potassium} mg/kg</div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-600" style={{ width: `${Math.min((activeLatestReport.potassium / 300) * 100, 100)}%` }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="clean-card p-5 space-y-2">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Soil pH Balance</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <h3 className="text-3xl font-bold text-slate-900">{activeLatestReport.ph}</h3>
                        <span className={`text-xs font-bold border px-2 py-0.5 rounded-md ${getPHStatus(activeLatestReport.ph).color}`}>
                          {getPHStatus(activeLatestReport.ph).label}
                        </span>
                      </div>
                    </div>

                    <div className="clean-card p-5 space-y-2">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Volumetric Moisture</span>
                      <div className="flex items-baseline gap-2 mt-1">
                        <h3 className="text-3xl font-bold text-slate-900">{activeLatestReport.soil_moisture}%</h3>
                        <span className={`text-xs font-bold border px-2 py-0.5 rounded-md ${getMoistureStatus(activeLatestReport.soil_moisture).color}`}>
                          {getMoistureStatus(activeLatestReport.soil_moisture).label}
                        </span>
                      </div>
                    </div>

                    <div className="clean-card p-5 space-y-2">
                      <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">Organic Carbon</span>
                      <h3 className="text-3xl font-bold text-slate-900 mt-1">{activeLatestReport.organic_carbon}%</h3>
                    </div>
                  </div>
                ) : (
                  <div className="clean-card p-12 text-center text-slate-400 text-xs">
                    No soil report recorded for this field. Click &quot;Log Soil Test&quot; to input NPK chemical profile.
                  </div>
                )}
              </div>
            ) : (
              <div className="clean-card p-16 text-center text-slate-400">
                Please select or register a landholding.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Account Credentials Tab */
        <div className="max-w-2xl mx-auto clean-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-emerald-700">
              <Settings className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Operator Profile Details</h3>
              <p className="text-xs text-slate-500 mt-0.5">Manage full name, phone number, and security password.</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Phone Number</label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">Operator State</label>
                <select
                  value={locationState}
                  onChange={(e) => setLocationState(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                >
                  {STATES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">Update Password (leave blank to keep current)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-4 py-2.5 text-xs text-slate-900 outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isUpdatingAccount}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm"
            >
              {isUpdatingAccount ? "Saving..." : "Commit Profile Changes"}
            </button>
          </form>
        </div>
      )}

      {/* Add Farm Modal */}
      {showAddFarm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="border-b border-slate-100 p-6 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">Register Field Landholding</h3>
                <p className="text-xs text-slate-500 mt-0.5">Register a landholding to configure crop & soil parameters.</p>
              </div>
              <button
                onClick={() => setShowAddFarm(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateFarm}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Field Name *</label>
                    <input
                      type="text"
                      required
                      value={newFarmName}
                      onChange={(e) => setNewFarmName(e.target.value)}
                      placeholder="e.g. West Canal Bed"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Area (Hectares) *</label>
                    <input
                      type="number"
                      required
                      step="0.1"
                      min="0.1"
                      value={newFarmArea}
                      onChange={(e) => setNewFarmArea(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none transition-colors font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Current Crop</label>
                    <select
                      value={newCrop}
                      onChange={(e) => setNewCrop(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    >
                      {CROPS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Irrigation Channel</label>
                    <select
                      value={newIrrigation}
                      onChange={(e) => setNewIrrigation(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    >
                      {IRRIGATION_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 p-5 bg-slate-50/50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddFarm(false)}
                  className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingFarm}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm"
                >
                  {isSubmittingFarm ? "Registering..." : "Confirm Registration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Soil Modal */}
      {showAddSoil && activeFarm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="border-b border-slate-100 p-6 flex justify-between items-center bg-slate-50/60">
              <div>
                <h3 className="text-base font-bold text-slate-900">Log Soil Chemistry Report</h3>
                <p className="text-xs text-slate-500 mt-0.5">Input laboratory test metrics for {activeFarm.name}.</p>
              </div>
              <button
                onClick={() => setShowAddSoil(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSoilReport}>
              <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">pH (0-14)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="14"
                      required
                      value={soilPH}
                      onChange={(e) => setSoilPH(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Nitrogen (mg/kg)</label>
                    <input
                      type="number"
                      required
                      value={soilN}
                      onChange={(e) => setSoilN(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Phosphorus</label>
                    <input
                      type="number"
                      required
                      value={soilP}
                      onChange={(e) => setSoilP(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Potassium (K)</label>
                    <input
                      type="number"
                      required
                      value={soilK}
                      onChange={(e) => setSoilK(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Moisture %</label>
                    <input
                      type="number"
                      step="0.1"
                      value={soilMoisture}
                      onChange={(e) => setSoilMoisture(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">Organic Carbon %</label>
                    <input
                      type="number"
                      step="0.01"
                      value={soilCarbon}
                      onChange={(e) => setSoilCarbon(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl px-3 py-2 text-xs text-slate-900 outline-none font-semibold transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 p-5 bg-slate-50/50 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddSoil(false)}
                  className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSoil}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm"
                >
                  {isSubmittingSoil ? "Committing..." : "Save Soil Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
