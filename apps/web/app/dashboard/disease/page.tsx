"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import api from "../../../lib/api";
import { useToastStore } from "../../../store/toastStore";
import { 
  ArrowLeft, 
  UploadCloud, 
  ShieldAlert, 
  CheckCircle, 
  Activity, 
  Info,
  Clock,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  BookOpen,
  MapPin,
  RefreshCw,
  Layers
} from "lucide-react";

interface DiagnosisResult {
  disease_id: string;
  name: string;
  type: string;
  severity: string;
  description: string;
  treatment: string;
  prevention: string;
  confidence: number;
  scan_log_id?: number;
  gradcam_overlay?: string | null;
}

export default function DiseaseDetectionPage() {
  const { showToast } = useToastStore();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [hasSentFeedback, setHasSentFeedback] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const submitScanFeedback = async (scanLogId: number, isCorrect: boolean) => {
    try {
      await api.post(`/api/v1/disease/feedback/${scanLogId}`, {
        user_feedback_correct: isCorrect
      });
      setHasSentFeedback(true);
      showToast("Thank you for your feedback!", "success");
    } catch (e) {
      console.error("Failed to submit scan feedback:", e);
      showToast("Could not submit feedback.", "error");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      processFile(droppedFiles[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      processFile(selectedFiles[0]);
    }
  };

  const processFile = (selectedFile: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Unsupported file format. Please upload a JPG, JPEG, or PNG image.");
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError("File is too large. Maximum size allowed is 5MB.");
      return;
    }
    setFile(selectedFile);
    setPreviewUrl(URL.createObjectURL(selectedFile));
    setResult(null);
  };

  const runDiagnosis = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await api.post("/api/v1/disease/detect", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      // Simulate scan delay for smooth micro-animations
      setTimeout(() => {
        setResult(res.data);
        setIsAnalyzing(false);
        showToast("Diagnosis completed successfully!", "success");
      }, 2000);
    } catch (err: any) {
      const errMsg = err.response?.data?.detail || "Inference failed. Check network or server connection.";
      setError(errMsg);
      setIsAnalyzing(false);
      showToast(errMsg, "error");
    }
  };

  const resetScanner = () => {
    setFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setResult(null);
    setError(null);
    setShowHeatmap(false);
    setHasSentFeedback(false);
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans pb-16">
      {/* Top Banner Navigation */}
      <header className="glass sticky top-0 z-40 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-4">
          <Link 
            href="/dashboard" 
            className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-800 transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              AI Disease Detection
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-10 w-full">
        {/* Intro */}
        <div className="mb-8">
          <h2 className="text-3xl font-display font-bold text-white mb-2">Leaf Pathogen Scanner</h2>
          <p className="text-neutral-400 text-sm md:text-base">
            Upload high-resolution photographs of diseased crop leaves. The PyTorch deep model will resolve symptoms to localized treatment protocols.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Scanner column */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="glass border border-neutral-800 rounded-3xl p-6 relative overflow-hidden">
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-4">Input Console</div>
              
              {!previewUrl ? (
                /* Drag Drop Box */
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileSelect}
                  className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[300px] ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-neutral-800 hover:border-neutral-600 bg-neutral-900/20"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept="image/jpeg,image/png,image/jpg"
                  />
                  <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-full mb-4 text-neutral-400 group-hover:scale-105 transition-transform">
                    <UploadCloud className="h-8 w-8" />
                  </div>
                  <span className="font-semibold text-sm text-neutral-200 mb-1">
                    Drag and drop leaf image
                  </span>
                  <span className="text-xs text-neutral-500 max-w-[200px]">
                    Supports JPEG, JPG or PNG up to 5MB
                  </span>
                </div>
              ) : (
                /* Preview Screen with optional scanner sweep */
                <div className="relative rounded-2xl overflow-hidden aspect-square border border-neutral-800 bg-neutral-900/60 max-w-full">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={showHeatmap && result?.gradcam_overlay ? result.gradcam_overlay : previewUrl || ""}
                    alt="Leaf sample"
                    className="w-full h-full object-cover"
                  />

                  {result && result.gradcam_overlay && (
                    <div className="absolute top-4 right-4 z-30">
                      <button
                        onClick={() => setShowHeatmap(!showHeatmap)}
                        className="bg-neutral-950/80 hover:bg-neutral-950 text-white border border-neutral-800 px-3 py-1.5 rounded-xl text-[10px] font-bold backdrop-blur transition-all flex items-center gap-1.5 shadow-md"
                      >
                        <Layers className="h-3.5 w-3.5 text-primary" />
                        {showHeatmap ? "Show Original" : "Show AI Heatmap"}
                      </button>
                    </div>
                  )}
                  
                  {isAnalyzing && (
                    /* Scanner green sweeping laser bar */
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-20">
                      <div className="w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse shadow-[0_0_15px_#00C875] relative"
                           style={{
                             animation: "scanSweep 2s ease-in-out infinite",
                             top: "0%"
                           }}
                      ></div>
                      {/* Scan Overlay Shade */}
                      <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                    </div>
                  )}
                </div>
              )}

              {/* Status controls */}
              {previewUrl && !isAnalyzing && !result && (
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={resetScanner}
                    className="flex-1 glass glass-hover text-neutral-400 hover:text-white font-semibold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset
                  </button>
                  <button
                    onClick={runDiagnosis}
                    className="flex-[2] bg-primary hover:bg-primary-600 text-neutral-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-[0_0_20px_rgba(0,200,117,0.2)]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Analyze Image
                  </button>
                </div>
              )}

              {isAnalyzing && (
                <div className="mt-6 p-4 rounded-xl bg-neutral-900 border border-neutral-850 flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                  <span className="text-xs font-semibold text-neutral-300">
                    Running model tensor pass...
                  </span>
                </div>
              )}

              {error && (
                <div className="mt-6 bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs flex items-start gap-2 animate-fade-in">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Results column */}
          <div className="lg:col-span-7">
            {result ? (
              result.status === "IQA_Failed" ? (
                /* IQA Validation Failure Card */
                <div className="glass border border-red-500/20 rounded-3xl p-6 md:p-8 animate-fade-in space-y-6">
                  <div className="flex items-center gap-3 border-b border-neutral-800/80 pb-4">
                    <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-2xl text-red-400">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-0.5">Image Quality Assessment</div>
                      <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2.5 py-0.5 rounded border border-red-500/20">
                        {result.name}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 space-y-3">
                      <div className="text-xs font-bold text-red-400 uppercase tracking-wider text-left">Quality Issues Checked</div>
                      <ul className="space-y-2">
                        {result.iqa_reasons?.map((reason, idx) => (
                          <li key={idx} className="text-xs text-neutral-300 flex items-start gap-2 text-left">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400 mt-1.5 flex-shrink-0"></span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900 flex flex-col justify-between">
                        <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider block mb-1 text-left">Blur Variance</span>
                        <span className={`text-sm font-bold text-left ${result.iqa_metrics?.blur_variance! >= 80 ? "text-primary" : "text-red-400"}`}>
                          {result.iqa_metrics?.blur_variance} <span className="text-[9px] text-neutral-600">/ 80.0 limit</span>
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900 flex flex-col justify-between">
                        <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider block mb-1 text-left">Mean Brightness</span>
                        <span className={`text-sm font-bold text-left ${result.iqa_metrics?.brightness_mean! >= 45 && result.iqa_metrics?.brightness_mean! <= 225 ? "text-primary" : "text-red-400"}`}>
                          {result.iqa_metrics?.brightness_mean} <span className="text-[9px] text-neutral-600">/ 45-225 range</span>
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900 flex flex-col justify-between">
                        <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider block mb-1 text-left">Contrast Deviation</span>
                        <span className={`text-sm font-bold text-left ${result.iqa_metrics?.contrast_std! >= 15 ? "text-primary" : "text-red-400"}`}>
                          {result.iqa_metrics?.contrast_std} <span className="text-[9px] text-neutral-600">/ 15.0 limit</span>
                        </span>
                      </div>
                      <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-900 flex flex-col justify-between">
                        <span className="text-[10px] text-neutral-500 font-semibold uppercase tracking-wider block mb-1 text-left">Leaf Coverage</span>
                        <span className={`text-sm font-bold text-left ${result.iqa_metrics?.leaf_coverage_pct! >= 12 ? "text-primary" : "text-red-400"}`}>
                          {result.iqa_metrics?.leaf_coverage_pct}% <span className="text-[9px] text-neutral-600">/ 12% limit</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-neutral-800/80 pt-6">
                    <button 
                      onClick={resetScanner}
                      className="w-full bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 hover:border-neutral-700 text-neutral-200 font-semibold py-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Try Scanning Again
                    </button>
                  </div>
                </div>
              ) : result.status === "Uncertain" || result.status === "Inconclusive" ? (
                /* Low-confidence or Uncertain display card with Top 3 disease list */
                <div className="glass border border-amber-500/20 rounded-3xl p-6 md:p-8 animate-fade-in space-y-6">
                  <div className="flex items-gap-3 border-b border-neutral-800/80 pb-4">
                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-2xl text-amber-400 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div className="ml-3">
                      <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-0.5">Moderate Confidence Warning</div>
                      <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20">
                        {result.name}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 space-y-2">
                      <div className="text-xs font-bold text-amber-400 uppercase tracking-wider text-left">Uncertainty Statement</div>
                      <p className="text-xs md:text-sm text-neutral-300 leading-relaxed text-left">{result.description}</p>
                    </div>

                    {/* Render Top 3 disease predictions list */}
                    <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 space-y-3">
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider text-left">Top 3 Predicted Pathogens</div>
                      <div className="space-y-2.5">
                        {result.top3_predictions?.map((pred, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between text-xs text-neutral-300 font-medium">
                              <span>{pred.name}</span>
                              <span className="font-bold text-primary">{Math.round(pred.confidence * 100)}%</span>
                            </div>
                            <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-primary h-full rounded-full" style={{ width: `${pred.confidence * 100}%` }}></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 space-y-2">
                      <div className="text-xs font-bold text-primary uppercase tracking-wider text-left">Recommended Action</div>
                      <p className="text-xs md:text-sm text-neutral-300 leading-relaxed text-left">{result.treatment}</p>
                    </div>
                  </div>

                  {/* Feedback rating block */}
                  {result.scan_log_id && !hasSentFeedback && (
                    <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-850 flex items-center justify-between">
                      <span className="text-xs text-neutral-400 font-medium">Was this assessment helpful?</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitScanFeedback(result.scan_log_id!, true)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-850 bg-neutral-900 hover:bg-neutral-850 text-primary font-bold text-[10px] transition-colors"
                        >
                          Yes, Helpful
                        </button>
                        <button
                          onClick={() => submitScanFeedback(result.scan_log_id!, false)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-850 bg-neutral-900 hover:bg-neutral-850 text-red-400 font-bold text-[10px] transition-colors"
                        >
                          No, Unhelpful
                        </button>
                      </div>
                    </div>
                  )}

                  {hasSentFeedback && (
                    <div className="text-[10px] text-primary font-semibold flex items-center gap-1.5 text-center justify-center p-2.5 bg-primary/5 border border-primary/10 rounded-xl">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Thank you for help validating our diagnostic models!
                    </div>
                  )}

                  <div className="border-t border-neutral-800/80 pt-6 flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={resetScanner}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 hover:border-neutral-700 text-neutral-200 font-semibold py-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Try Scanning Another
                    </button>
                    <Link 
                      href="/dashboard/centers"
                      className="flex-1 bg-primary hover:bg-primary-600 text-neutral-950 font-bold py-3 rounded-xl text-xs text-center flex items-center justify-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(0,200,117,0.15)]"
                    >
                      <MapPin className="h-4 w-4" />
                      Find Local Agronomy Centers
                    </Link>
                  </div>
                </div>
              ) : (
                /* Standard Disease Result Card (High Confidence) */
                <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 animate-fade-in space-y-6">
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
                    <div>
                      <div className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-1">Diagnosis Result</div>
                      <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                        {result.type}
                      </span>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs font-semibold text-neutral-400 mb-1">Severity Rating</div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                        result.severity === "High"
                          ? "text-red-400 bg-red-500/10 border-red-500/20"
                          : result.severity === "Medium"
                          ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                          : "text-primary bg-primary/10 border-primary/20"
                      }`}>
                        {result.severity}
                      </span>
                    </div>
                  </div>

                  {/* Pathogen heading and confidence */}
                  <div>
                    <h3 className="text-2xl font-bold text-white mb-2 text-left">{result.name}</h3>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 bg-neutral-900 border border-neutral-850 h-3 rounded-full overflow-hidden">
                        <div 
                          className="bg-primary h-full rounded-full transition-all duration-1000"
                          style={{ width: `${result.confidence * 100}%` }}
                        ></div>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        {roundPercent(result.confidence)}% Confidence
                      </span>
                    </div>
                  </div>

                  {/* Info panels */}
                  <div className="space-y-4">
                    <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-start gap-4">
                      <Info className="h-5 w-5 text-neutral-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1 text-left">Pathogen Profile</div>
                        <p className="text-xs md:text-sm text-neutral-300 leading-relaxed text-left">{result.description}</p>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-start gap-4">
                      <Activity className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1 text-left">Recommended Treatment</div>
                        <p className="text-xs md:text-sm text-neutral-300 leading-relaxed text-left">{result.treatment}</p>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-start gap-4">
                      <BookOpen className="h-5 w-5 text-accent-blue flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1 text-left">Prevention & Cultural Habits</div>
                        <p className="text-xs md:text-sm text-neutral-300 leading-relaxed text-left">{result.prevention}</p>
                      </div>
                    </div>
                  </div>

                  {/* Feedback rating block */}
                  {result.scan_log_id && !hasSentFeedback && (
                    <div className="p-4 rounded-xl bg-neutral-900/40 border border-neutral-850 flex items-center justify-between">
                      <span className="text-xs text-neutral-400 font-medium">Was this diagnosis accurate?</span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => submitScanFeedback(result.scan_log_id!, true)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-850 bg-neutral-900 hover:bg-neutral-850 text-primary font-bold text-[10px] transition-colors"
                        >
                          Yes, Correct
                        </button>
                        <button
                          onClick={() => submitScanFeedback(result.scan_log_id!, false)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-850 bg-neutral-900 hover:bg-neutral-850 text-red-400 font-bold text-[10px] transition-colors"
                        >
                          No, Incorrect
                        </button>
                      </div>
                    </div>
                  )}

                  {hasSentFeedback && (
                    <div className="text-[10px] text-primary font-semibold flex items-center gap-1.5 text-center justify-center p-2.5 bg-primary/5 border border-primary/10 rounded-xl">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Thank you for help validating our diagnostic models!
                    </div>
                  )}

                  {/* Quick actions post-diagnosis */}
                  <div className="border-t border-neutral-800/80 pt-6 flex flex-col sm:flex-row gap-4">
                    <button 
                      onClick={resetScanner}
                      className="flex-1 bg-neutral-900 hover:bg-neutral-850 border border-neutral-850 hover:border-neutral-700 text-neutral-200 font-semibold py-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Scan Another Leaf
                    </button>
                    <Link 
                      href="/dashboard/centers"
                      className="flex-1 bg-primary hover:bg-primary-600 text-neutral-950 font-bold py-3 rounded-xl text-xs text-center flex items-center justify-center gap-1.5 transition-colors shadow-[0_0_15px_rgba(0,200,117,0.15)]"
                    >
                      <MapPin className="h-4 w-4" />
                      Find Local Agronomy Centers
                    </Link>
                  </div>
                </div>
              )
            ) : isAnalyzing ? (
              /* High-fidelity Skeletal Loader Card during active scanning */
              <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-6 animate-pulse">
                <div className="flex items-center justify-between border-b border-neutral-800/80 pb-4">
                  <div className="space-y-2 w-1/3">
                    <div className="h-2 bg-neutral-800 rounded w-1/2"></div>
                    <div className="h-4 bg-neutral-800 rounded"></div>
                  </div>
                  <div className="space-y-2 w-1/4">
                    <div className="h-2 bg-neutral-800 rounded ml-auto w-1/2"></div>
                    <div className="h-5 bg-neutral-800 rounded"></div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="h-5 bg-neutral-800 rounded w-2/3"></div>
                  <div className="h-2 bg-neutral-850 rounded w-full"></div>
                  <div className="h-2 bg-neutral-850 rounded w-3/4"></div>
                </div>

                <div className="space-y-4 pt-4">
                  <div className="h-20 bg-neutral-900/60 border border-neutral-850 rounded-2xl p-4 flex gap-4">
                    <div className="h-5 w-5 bg-neutral-800 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-2 bg-neutral-800 rounded w-1/4"></div>
                      <div className="h-3 bg-neutral-800 rounded w-full"></div>
                    </div>
                  </div>
                  <div className="h-20 bg-neutral-900/60 border border-neutral-850 rounded-2xl p-4 flex gap-4">
                    <div className="h-5 w-5 bg-neutral-800 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-2 bg-neutral-800 rounded w-1/4"></div>
                      <div className="h-3 bg-neutral-800 rounded w-full"></div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Waiting Screen */
              <div className="glass border border-neutral-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px] text-neutral-500">
                <div className="bg-neutral-900 border border-neutral-850 p-4 rounded-full mb-4 text-neutral-600">
                  <ShieldAlert className="h-10 w-10 animate-pulse-slow" />
                </div>
                <h3 className="font-bold text-neutral-300 mb-2">No Diagnoses Logged</h3>
                <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
                  Upload an image on the input console and trigger the analysis pass. The AI diagnosis report will display here dynamically.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Embedded scanning style animation in raw CSS */}
      <style jsx global>{`
        @keyframes scanSweep {
          0%, 100% { top: 0%; }
          50% { top: 100%; }
        }
      `}</style>
    </div>
  );
}

function roundPercent(val: number): number {
  return Math.round(val * 1000) / 10;
}
