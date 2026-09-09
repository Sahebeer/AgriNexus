"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Scale, Lock, Compass, ShieldAlert, Sprout } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans pb-16">
      {/* Header Banner */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Scale className="h-5 w-5 text-emerald-600" />
              Terms of Service
            </h1>
          </div>
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <Sprout className="h-4 w-4" />
            </div>
            <span className="font-bold text-slate-900 text-sm hidden sm:inline">AgriNexus AI</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full space-y-8 text-left">
        {/* Intro */}
        <div className="space-y-3">
          <span className="text-[11px] uppercase font-bold tracking-wider text-emerald-800 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 inline-block">
            Legal & Framework Agreements
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            System Terms & Conditions
          </h2>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            Welcome to AgriNexus AI. By logging into the smart farm console or using our localized leaf scanning and advisory endpoints, you agree to comply with and be bound by the following terms.
          </p>
        </div>

        {/* Section 1: Data Ownership */}
        <div className="clean-card p-6 md:p-8 space-y-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Lock className="h-5 w-5 text-emerald-600" />
            1. Farmer Data Ownership & Privacy
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            AgriNexus AI strictly acts as an operating system provider. <strong className="text-slate-900">The farmer retains 100% intellectual property, control, and ownership</strong> over all entered crop histories, farm landholdings sizes, soil tests, and geographic coordinates. We do not sell or monetize localized field structures.
          </p>
        </div>

        {/* Section 2: AI Recommendations Disclaimer */}
        <div className="clean-card p-6 md:p-8 space-y-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
            2. AI Diagnostic Accuracy Disclaimer
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Diagnostic reports provided by the Vision pipeline and Gemini Agronomist are generated using multi-layer deep learning models and regional agronomic knowledge graphs. While calibrated for high accuracy, users are encouraged to verify chemical dosages with local Krishi Vigyan Kendra (KVK) officers before intensive application.
          </p>
        </div>

        {/* Section 3: Sensor Ingress & Telemetry */}
        <div className="clean-card p-6 md:p-8 space-y-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Compass className="h-5 w-5 text-blue-600" />
            3. Sensor Ingress & Satellite Ground Verification
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Satellite vegetation indexes (NDVI/NDWI) and SAR radar approximations depend on cloud coverage and European Space Agency (ESA) orbit cadence. Real-time soil metrics logged by operators supersede satellite simulations in predictive risk modeling.
          </p>
        </div>
      </main>
    </div>
  );
}
