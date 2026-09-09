"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import {
  ShieldCheck,
  Satellite,
  Radio,
  Server,
  Database,
  Cpu,
  Layers,
  Sparkles,
  MapPin,
  ExternalLink,
  LogOut,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Leaf,
  Scan,
  Send,
  MessageSquare,
  ArrowLeft,
  Eye,
  Check,
  Play,
  TrendingUp,
  Activity
} from "lucide-react";

interface SystemStatus {
  status: string;
  environment: string;
  active_models: Record<string, string>;
  providers: Record<string, string>;
  database_metrics: {
    registered_users: number;
    registered_farms: number;
    satellite_observations: number;
  };
  server_time: string;
}

interface DemoFarmPreset {
  farm_id: string;
  name: string;
  location: string;
  crop: string;
  crop_confidence?: number;
  area_hectares: number;
  area_acres: number;
  health_score: number;
  health_status: string;
  ndvi_mean: number;
  moisture_index: number;
  satellite_source: string;
  is_demo: boolean;
}

interface AdminSpecimen {
  id: string;
  name: string;
  crop: string;
  symptom: string;
  tag: string;
  color: string;
  generate: () => Promise<File>;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<"vision" | "farms" | "advisor" | "telemetry">("vision");
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [demoFarms, setDemoFarms] = useState<DemoFarmPreset[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Vision Sandbox State
  const [visionAnalyzing, setVisionAnalyzing] = useState(false);
  const [visionResult, setVisionResult] = useState<any>(null);
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string | null>(null);
  const [visionPreviewUrl, setVisionPreviewUrl] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);

  // AI Advisor Sandbox State
  const [advisorQuery, setAdvisorQuery] = useState("");
  const [advisorRunning, setAdvisorRunning] = useState(false);
  const [advisorResponse, setAdvisorResponse] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setIsLoading(true);
    try {
      const [statusRes, farmsRes] = await Promise.all([
        api.get("/api/v1/admin/system-status"),
        api.get("/api/v1/admin/demo-farms")
      ]);
      setSystemStatus(statusRes.data);
      setDemoFarms(farmsRes.data || []);
    } catch (err: any) {
      console.error("Failed to load admin data:", err);
      showToast("Failed to fetch administrative telemetry.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/admin/login");
      return;
    }

    if (user && user.role !== "admin" && !user.is_superuser) {
      showToast("Access Denied: Administrative privileges required.", "error");
      router.push("/admin/login");
      return;
    }

    fetchAdminData();
  }, [user, isAuthenticated]);

  const handleLogout = () => {
    logout();
    router.push("/admin/login");
  };

  // Helper to construct canvas specimens for instant testing
  const createSpecimenFile = (
    name: string,
    bgGreen: [number, number, number],
    spotColor?: [number, number, number],
    spotType?: "blight" | "halo" | "rust" | "healthy"
  ): Promise<File> => {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 320;
      const ctx = canvas.getContext("2d")!;

      // Leaf Background
      ctx.fillStyle = `rgb(${bgGreen[0]}, ${bgGreen[1]}, ${bgGreen[2]})`;
      ctx.beginPath();
      ctx.ellipse(160, 160, 120, 140, Math.PI / 12, 0, Math.PI * 2);
      ctx.fill();

      // Veins
      ctx.strokeStyle = `rgba(255, 255, 255, 0.28)`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(160, 30);
      ctx.lineTo(160, 290);
      ctx.stroke();

      for (let i = 60; i < 260; i += 32) {
        ctx.beginPath();
        ctx.moveTo(160, i);
        ctx.lineTo(80, i - 20);
        ctx.moveTo(160, i);
        ctx.lineTo(240, i - 20);
        ctx.stroke();
      }

      if (spotColor && spotType) {
        if (spotType === "blight") {
          ctx.fillStyle = `rgb(${spotColor[0]}, ${spotColor[1]}, ${spotColor[2]})`;
          ctx.beginPath();
          ctx.ellipse(140, 130, 48, 58, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "rgba(40, 25, 20, 0.9)";
          ctx.beginPath();
          ctx.arc(140, 130, 26, 0, Math.PI * 2);
          ctx.fill();
        } else if (spotType === "halo") {
          ctx.fillStyle = "rgba(235, 205, 30, 0.85)";
          ctx.beginPath();
          ctx.arc(120, 120, 38, 0, Math.PI * 2);
          ctx.arc(180, 170, 32, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = `rgb(${spotColor[0]}, ${spotColor[1]}, ${spotColor[2]})`;
          ctx.beginPath();
          ctx.arc(120, 120, 16, 0, Math.PI * 2);
          ctx.arc(180, 170, 14, 0, Math.PI * 2);
          ctx.fill();
        } else if (spotType === "rust") {
          ctx.fillStyle = `rgb(${spotColor[0]}, ${spotColor[1]}, ${spotColor[2]})`;
          for (let k = 0; k < 14; k++) {
            const rx = 90 + (k % 4) * 35;
            const ry = 95 + Math.floor(k / 4) * 42;
            ctx.beginPath();
            ctx.arc(rx, ry, 11, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      canvas.toBlob((blob) => {
        const file = new File([blob!], `${name}.jpg`, { type: "image/jpeg" });
        resolve(file);
      }, "image/jpeg");
    });
  };

  const ADMIN_SPECIMENS: AdminSpecimen[] = [
    {
      id: "demo_late_blight",
      name: "Tomato Late Blight",
      crop: "Tomato",
      symptom: "Water-soaked dark lesions & necrotic collapse",
      tag: "Oomycete / High Severity",
      color: "border-rose-300 bg-rose-50 text-rose-900",
      generate: () => createSpecimenFile("demo_late_blight", [60, 130, 45], [45, 30, 25], "blight")
    },
    {
      id: "demo_early_blight",
      name: "Potato Early Blight",
      crop: "Potato",
      symptom: "Alternaria solani concentric rings",
      tag: "Fungal / Medium Severity",
      color: "border-amber-300 bg-amber-50 text-amber-900",
      generate: () => createSpecimenFile("demo_early_blight", [70, 135, 50], [130, 75, 30], "blight")
    },
    {
      id: "demo_bacterial_spot",
      name: "Bell Pepper Bacterial Spot",
      crop: "Bell Pepper",
      symptom: "Xanthomonas angular spots & chlorotic halos",
      tag: "Bacterial / Medium Severity",
      color: "border-yellow-300 bg-yellow-50 text-yellow-900",
      generate: () => createSpecimenFile("demo_bacterial_spot", [65, 140, 50], [40, 30, 20], "halo")
    },
    {
      id: "demo_rust",
      name: "Maize Foliar Rust",
      crop: "Corn",
      symptom: "Puccinia reddish-orange pustules",
      tag: "Fungal / Medium Severity",
      color: "border-orange-300 bg-orange-50 text-orange-900",
      generate: () => createSpecimenFile("demo_rust", [90, 140, 40], [210, 75, 20], "rust")
    },
    {
      id: "demo_healthy",
      name: "Healthy Tomato Specimen",
      crop: "Tomato",
      symptom: "Uniform chlorophyll density & zero pathology",
      tag: "Normal / Vigorous",
      color: "border-emerald-300 bg-emerald-50 text-emerald-900",
      generate: () => createSpecimenFile("demo_healthy", [45, 160, 55], undefined, "healthy")
    }
  ];

  const handleRunSpecimenInference = async (sp: AdminSpecimen) => {
    setSelectedSpecimenId(sp.id);
    setVisionAnalyzing(true);
    setVisionResult(null);

    try {
      const file = await sp.generate();
      setVisionPreviewUrl(URL.createObjectURL(file));

      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/api/v1/disease/predict", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setVisionResult(res.data);
      showToast(`Analyzed ${sp.name} successfully`, "success");
    } catch (err: any) {
      showToast("Inference error occurred.", "error");
    } finally {
      setVisionAnalyzing(false);
    }
  };

  const handleRunAdvisorBenchmark = async (promptText: string) => {
    setAdvisorQuery(promptText);
    setAdvisorRunning(true);
    setAdvisorResponse(null);

    try {
      const res = await api.post("/api/v1/advisor/chat", {
        message: promptText
      });
      setAdvisorResponse(res.data.response);
      showToast("Agronomist response generated", "success");
    } catch (err: any) {
      setAdvisorResponse("Error contacting agronomist service. Please check connection.");
      showToast("Advisor consultation failed", "error");
    } finally {
      setAdvisorRunning(false);
    }
  };

  const getHeatmapSrc = (overlay: string) => {
    if (overlay.startsWith("data:")) return overlay;
    return `data:image/jpeg;base64,{overlay}`;
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans pb-16">
      {/* Admin Top Navigation */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
                AgriNexus Demonstration & Audience Sandbox
                <span className="text-[10px] uppercase font-extrabold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                  Admin Active
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Interactive Multi-Module Testing Console for Live Demonstration
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/?tab=overview"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Farmer Console</span>
            </Link>

            <button
              onClick={handleLogout}
              className="p-2 bg-white hover:bg-slate-100 text-slate-500 hover:text-rose-600 border border-slate-200 rounded-xl transition-colors shadow-sm"
              title="Sign Out of Admin"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 mt-6 flex-1 w-full space-y-6">
        
        {/* Navigation Tabs for Sandbox */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
          <button
            onClick={() => setActiveTab("vision")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "vision"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Scan className="h-4 w-4" />
            <span>Disease Vision Lab (Live Specimen Tests)</span>
          </button>

          <button
            onClick={() => setActiveTab("farms")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "farms"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Satellite className="h-4 w-4" />
            <span>Multi-Region Farm Satellites (India)</span>
          </button>

          <button
            onClick={() => setActiveTab("advisor")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "advisor"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>AI Agronomist Query Benchmark</span>
          </button>

          <button
            onClick={() => setActiveTab("telemetry")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === "telemetry"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>System Telemetry & Controls</span>
          </button>
        </div>

        {/* ─── TAB 1: DISEASE VISION LAB ────────────────────────────────────── */}
        {activeTab === "vision" && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="clean-card p-6 md:p-8 space-y-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Leaf className="h-5 w-5 text-emerald-600" />
                  Live Computer Vision Pathology Testing Suite
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Click any specimen card below to execute a real-time neural inference pass and inspect disease classification, active treatments, and Grad-CAM attention heatmaps.
                </p>
              </div>

              {/* Specimen Buttons Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {ADMIN_SPECIMENS.map((sp) => {
                  const isSelected = selectedSpecimenId === sp.id;
                  return (
                    <div
                      key={sp.id}
                      onClick={() => handleRunSpecimenInference(sp)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between space-y-3 ${sp.color} ${
                        isSelected ? "ring-2 ring-emerald-600 shadow-md" : "hover:shadow-sm"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider opacity-75">{sp.crop}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-emerald-700" />}
                        </div>
                        <h4 className="font-bold text-sm mt-1">{sp.name}</h4>
                        <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">{sp.symptom}</p>
                      </div>

                      <div className="pt-2 border-t border-black/5 flex items-center justify-between text-xs font-bold">
                        <span>{sp.tag}</span>
                        <Play className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Inference Results Section */}
            {(visionAnalyzing || visionResult) && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-scale-in">
                {/* Visual Preview */}
                <div className="lg:col-span-5 clean-card p-6 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-xs font-bold text-slate-700">Analyzed Specimen Frame</span>
                    {visionResult?.gradcam_overlay && (
                      <button
                        onClick={() => setShowHeatmap(!showHeatmap)}
                        className="px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>{showHeatmap ? "Grad-CAM On" : "Original"}</span>
                      </button>
                    )}
                  </div>

                  {visionAnalyzing ? (
                    <div className="h-64 flex flex-col items-center justify-center space-y-3 bg-slate-50 rounded-2xl border border-slate-200">
                      <RefreshCw className="h-6 w-6 animate-spin text-emerald-600" />
                      <span className="text-xs font-bold text-slate-600">Running Computer Vision Model...</span>
                    </div>
                  ) : (
                    visionPreviewUrl && (
                      <div className="relative rounded-2xl overflow-hidden max-h-72 border border-slate-200 bg-black/5 flex items-center justify-center p-2">
                        <img
                          src={showHeatmap && visionResult?.gradcam_overlay ? getHeatmapSrc(visionResult.gradcam_overlay) : visionPreviewUrl}
                          alt="Specimen"
                          className="max-h-64 object-contain rounded-xl"
                        />
                      </div>
                    )
                  )}
                </div>

                {/* Diagnostics Detail */}
                <div className="lg:col-span-7 clean-card p-6 md:p-8 space-y-5">
                  {visionAnalyzing ? (
                    <div className="space-y-4 animate-pulse">
                      <div className="h-6 bg-slate-200 rounded w-1/3" />
                      <div className="h-4 bg-slate-100 rounded w-1/2" />
                      <div className="h-20 bg-slate-100 rounded" />
                      <div className="h-20 bg-slate-100 rounded" />
                    </div>
                  ) : visionResult ? (
                    <>
                      <div className="flex items-start justify-between border-b border-slate-100 pb-4">
                        <div>
                          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
                            <span>{visionResult.crop || "Agricultural Crop"}</span>
                            <span>•</span>
                            <span className="text-emerald-700 font-bold">{((visionResult.disease_confidence || 0.94) * 100).toFixed(0)}% Confidence</span>
                          </div>
                          <h3 className="text-xl font-bold text-slate-900">{visionResult.disease_name || visionResult.name}</h3>
                        </div>

                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${
                          visionResult.severity === "High"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : visionResult.severity === "None"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {visionResult.severity || "Moderate"} Severity
                        </span>
                      </div>

                      <div className="space-y-3.5 text-xs leading-relaxed">
                        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                          <span className="font-bold text-slate-800 block">Pathology Mechanism:</span>
                          <p className="text-slate-600">{visionResult.description}</p>
                        </div>

                        {visionResult.treatment && (
                          <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-1">
                            <span className="font-bold text-emerald-900 block">Chemical & Bio-Treatment Dosages:</span>
                            <p className="text-emerald-950">{visionResult.treatment}</p>
                          </div>
                        )}

                        {visionResult.prevention && (
                          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-1">
                            <span className="font-bold text-blue-900 block">Preventive Field Protocol:</span>
                            <p className="text-blue-950">{visionResult.prevention}</p>
                          </div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 2: MULTI-REGION FARM PRESETS ──────────────────────────────── */}
        {activeTab === "farms" && (
          <div className="clean-card p-6 md:p-8 space-y-6 text-left animate-fade-in">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Satellite className="h-5 w-5 text-blue-600" />
                  Curated Regional Farm Telemetry Presets (India)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Synthetic multi-spectral Sentinel-2 and microwave Sentinel-1 radar telemetry across key agro-climatic zones.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {demoFarms.map((farm) => (
                <div
                  key={farm.farm_id}
                  className="p-5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 transition-all space-y-4 text-left group"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
                        <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{farm.location}</span>
                      </div>
                      <h4 className="text-base font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                        {farm.name}
                      </h4>
                    </div>
                    <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {farm.crop}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Area</div>
                      <div className="font-bold text-slate-900">{farm.area_hectares} ha</div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Health</div>
                      <div className="font-bold text-emerald-700">{farm.health_score}%</div>
                    </div>
                    <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">NDVI Index</div>
                      <div className="font-bold text-blue-700">{farm.ndvi_mean}</div>
                    </div>
                  </div>

                  <Link
                    href="/?tab=satellite"
                    className="w-full py-2 bg-white hover:bg-emerald-600 hover:text-white border border-slate-200 hover:border-emerald-600 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>Launch Satellite & Earth AI Map</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── TAB 3: AI AGRONOMIST BENCHMARK ───────────────────────────────── */}
        {activeTab === "advisor" && (
          <div className="clean-card p-6 md:p-8 space-y-6 text-left animate-fade-in">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-600" />
                AI Agronomist Query Demonstration Runner
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Test multi-lingual prompt scenarios for pest diagnostics, NPK fertilizer calculations, and spray windows.
              </p>
            </div>

            {/* Quick Prompts */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 block">Pre-configured Audience Test Prompts:</span>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  {
                    lang: "English",
                    text: "How to treat late blight on tomato after heavy monsoon rain with organic remedies?"
                  },
                  {
                    lang: "Hindi (हिंदी)",
                    text: "गेहूं की फसल में पीला रतुआ (Yellow Rust) के लक्षण और नियंत्रण के उपाय बताएं।"
                  },
                  {
                    lang: "Punjabi (ਪੰਜਾਬੀ)",
                    text: "ਕਣਕ ਵਿੱਚ ਨਾਈਟ੍ਰੋਜਨ ਖਾਦ ਦੀ ਸਹੀ ਵਰਤੋਂ ਅਤੇ ਸਿੰਚਾਈ ਦਾ ਸਮਾਂ ਕੀ ਹੈ?"
                  }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleRunAdvisorBenchmark(item.text)}
                    className="p-3.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 text-left transition-all text-xs space-y-1.5"
                  >
                    <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      {item.lang}
                    </span>
                    <p className="text-slate-700 font-medium line-clamp-2">{item.text}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Query Response Display */}
            {(advisorRunning || advisorResponse) && (
              <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-700">Agronomist Inference Output</span>
                  <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                    Live Response
                  </span>
                </div>

                {advisorRunning ? (
                  <div className="flex items-center gap-2 py-4 text-xs text-slate-500 font-medium">
                    <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                    <span>Synthesizing multi-modal agronomic advisory...</span>
                  </div>
                ) : (
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-line font-sans">
                    {advisorResponse}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── TAB 4: SYSTEM TELEMETRY & CONTROLS ───────────────────────────── */}
        {activeTab === "telemetry" && (
          <div className="space-y-6 animate-fade-in text-left">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Database Metrics */}
              <div className="clean-card p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Database className="h-5 w-5 text-emerald-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Database Telemetry</h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                    Live
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center pt-2">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-xl font-bold text-slate-900">
                      {systemStatus?.database_metrics.registered_users ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Users</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-xl font-bold text-emerald-700">
                      {systemStatus?.database_metrics.registered_farms ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Farms</div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div className="text-xl font-bold text-blue-700">
                      {systemStatus?.database_metrics.satellite_observations ?? 0}
                    </div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Radar Passes</div>
                  </div>
                </div>
              </div>

              {/* Machine Learning Models */}
              <div className="clean-card p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Cpu className="h-5 w-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Active AI/ML Engines</h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                    Operational
                  </span>
                </div>
                <div className="space-y-1.5 text-xs text-slate-700 pt-1">
                  {systemStatus?.active_models &&
                    Object.entries(systemStatus.active_models).map(([k, v], idx) => (
                      <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-100 text-xs">
                        <span className="text-slate-500 capitalize">{k.replace(/_/g, " ")}</span>
                        <span className="font-semibold text-slate-900">{v}</span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Satellite Providers */}
              <div className="clean-card p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Satellite className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-slate-900 text-sm">Satellite Telemetry</h3>
                  </div>
                  <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                    Active
                  </span>
                </div>
                <div className="space-y-2 text-xs pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Optical & Multi-Spectral</div>
                    <div className="text-xs text-slate-800 font-medium">DemoSatelliteProvider (Sentinel-2 L2A)</div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Radar Microwave</div>
                    <div className="text-xs text-slate-800 font-medium">SARFieldProcessor (Sentinel-1 SAR C-band)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
