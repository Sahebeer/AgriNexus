"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Scale, Lock, Compass, ShieldAlert, Sprout } from "lucide-react";

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans pb-16">
      {/* Header Banner */}
      <header className="glass sticky top-0 z-40 border-b border-b-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              href="/" 
              className="p-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent hover:border-neutral-800 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Terms of Service
            </h1>
          </div>
          <Link href="/" className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-primary" />
            <span className="font-bold text-white text-sm hidden sm:inline">AgriNexus AI</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 w-full space-y-10 text-left">
        {/* Intro */}
        <div className="space-y-4">
          <span className="text-[10px] uppercase font-bold tracking-widest text-primary px-2.5 py-1 rounded bg-primary/10 border border-primary/20 inline-block">
            Legal & Framework Agreements
          </span>
          <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">
            System Terms & Conditions
          </h2>
          <p className="text-neutral-400 text-sm md:text-base leading-relaxed">
            Welcome to AgriNexus AI. By logging into the smart farm console or using our localized leaf scanning and advisory endpoints, you agree to comply with and be bound by the following terms.
          </p>
        </div>

        {/* Section 1: Data Ownership */}
        <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            1. Farmer Data Ownership & Privacy
          </h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            AgriNexus AI strictly acts as an operating system provider. **The farmer retains 100% intellectual property, control, and ownership** over all entered crop histories, farm landholdings sizes, soil tests, and geographic coordinates. We do not sell or monetize localized field structures.
          </p>
        </div>

        {/* Section 2: AI Recommendations Disclaimer */}
        <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-accent-amber" />
            2. Agronomic Advice Liability Disclaimer
          </h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            AI disease scans and Chatbot suggestions (Gemini models) are designed for automated decision support and educational reference. Because local conditions vary, **farmers must verify chemical, fertilizer, or crop spraying schedules with certified regional agricultural university advisors** before applying commercial inputs. AgriNexus is not liable for weather-related crop losses.
          </p>
        </div>

        {/* Section 3: Geospatial Security */}
        <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Compass className="h-5 w-5 text-accent-blue" />
            3. Coordinate Recording Accuracy
          </h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            You agree to supply reasonably accurate geographic coordinates for field entries. This data is processed directly to calculate state-level machinery subsidies and localized microclimate alerts (like frost hazard indicators).
          </p>
        </div>

        {/* Section 4: General Terms */}
        <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Scale className="h-5 w-5 text-red-400" />
            4. Acceptable Usage System Policies
          </h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            You agree not to bypass gateway securities, generate artificial API loads, upload malicious scripts, or input non-agricultural parameters to the advisor chatbot interface. Violation of terms will result in credentials revocation.
          </p>
        </div>
      </main>
    </div>
  );
}
