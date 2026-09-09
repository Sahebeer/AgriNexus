"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Database, Shield, Cpu, Sprout } from "lucide-react";

export default function ApiPolicyPage() {
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
              <Cpu className="h-5 w-5 text-emerald-600" />
              API Integration Policy
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
            Developer Specifications
          </span>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            Developer Interface & Ingress Policies
          </h2>
          <p className="text-slate-600 text-sm md:text-base leading-relaxed">
            AgriNexus AI provides programmatic gateways for IoT sensor nodes, farm management modules, and cooperative crop dashboards. Connect soil telemetry, crop scans, or weather triggers seamlessly.
          </p>
        </div>

        {/* Section 1: Auth */}
        <div className="clean-card p-6 md:p-8 space-y-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-emerald-600" />
            1. Gateway Authorization (JWT)
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            All API endpoints require JWT authorization bearer headers. You can generate authorization tokens by registering your profile via the terminal portal.
          </p>
          <div className="p-4 rounded-xl bg-slate-900 font-mono text-xs text-slate-200 shadow-inner">
            Authorization: Bearer $AGRINEXUS_JSON_WEB_TOKEN
          </div>
        </div>

        {/* Section 2: Telemetry Ingress */}
        <div className="clean-card p-6 md:p-8 space-y-3">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            2. Real-Time Telemetry & Sensor Ingress
          </h3>
          <p className="text-slate-600 text-sm leading-relaxed">
            Hardware soil probes (ESP32/Raspberry Pi) can transmit NPK, pH, and volumetric moisture telemetry to the ingestion endpoint at 15-minute intervals.
          </p>
          <div className="p-4 rounded-xl bg-slate-900 font-mono text-xs text-emerald-400 shadow-inner overflow-x-auto">
            POST /api/v1/farms/&#123;farm_id&#125;/soil
          </div>
        </div>
      </main>
    </div>
  );
}
