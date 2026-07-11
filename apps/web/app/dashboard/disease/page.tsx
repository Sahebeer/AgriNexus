"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import api from "../../../lib/api";
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
  RefreshCw
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
}

export default function DiseaseDetectionPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<DiagnosisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Inference failed. Check network or server connection.");
      setIsAnalyzing(false);
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
                    src={previewUrl}
                    alt="Leaf sample"
                    className="w-full h-full object-cover"
                  />
                  
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
                  <h3 className="text-2xl font-bold text-white mb-2">{result.name}</h3>
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
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Pathogen Profile</div>
                      <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">{result.description}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-start gap-4">
                    <Activity className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Recommended Treatment</div>
                      <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">{result.treatment}</p>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-850 flex items-start gap-4">
                    <BookOpen className="h-5 w-5 text-accent-blue flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1">Prevention & Cultural Habits</div>
                      <p className="text-xs md:text-sm text-neutral-300 leading-relaxed">{result.prevention}</p>
                    </div>
                  </div>
                </div>

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
