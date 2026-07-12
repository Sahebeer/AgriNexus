"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Database, Shield, Cpu, Sprout } from "lucide-react";

export default function ApiPolicyPage() {
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
              <Cpu className="h-5 w-5 text-primary" />
              API Integration Policy
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
            Developer Specifications
          </span>
          <h2 className="text-3xl font-display font-extrabold text-white tracking-tight">
            Developer Interface & Ingress Policies
          </h2>
          <p className="text-neutral-400 text-sm md:text-base leading-relaxed">
            AgriNexus AI provides programmatic gateways for IoT sensor nodes, farm management modules, and cooperative crop dashboards. Connect soil telemetry, crop scans, or weather triggers seamlessly.
          </p>
        </div>

        {/* Section 1: Auth */}
        <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            1. Gateway Authorization (JWT)
          </h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            All API endpoints require JWT authorization bearer headers. You can generate authorization tokens by registering your profile via the terminal portal.
          </p>
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-850 font-mono text-xs text-neutral-300">
            Authorization: Bearer $AGRINEXUS_JSON_WEB_TOKEN
          </div>
        </div>

        {/* Section 2: Telemetry Ingress */}
        <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Database className="h-5 w-5 text-accent-blue" />
            2. Soil & Telemetry Ingress
          </h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            Telemetry pipelines absorb soil humidity percentage, ambient temperatures, and NPK metrics. The ingress system processes fields under:
          </p>
          
          <div className="space-y-2">
            <div className="text-xs font-semibold text-neutral-300">Endpoint Routing:</div>
            <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-850 font-mono text-xs text-neutral-300">
              POST /api/v1/telemetry
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-semibold text-neutral-300">Payload JSON Schema:</div>
            <pre className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-850 font-mono text-[11px] text-neutral-300 overflow-x-auto">
{`{
  "sensor_id": "string (e.g. moisture_north_01)",
  "farm_id": "string (optional)",
  "depth_cm": "integer (soil sensor depth)",
  "soil_moisture_pct": "float (0.0 to 100.0)",
  "temperature_c": "float (ambient field reading)"
}`}
            </pre>
          </div>
        </div>

        {/* Section 3: Diagnostic Classification */}
        <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-accent-amber" />
            3. Disease Diagnostics API
          </h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            The neural network classifier accepts image formats (`png`, `jpeg`, `webp`) up to 5MB, returning pathogen reports:
          </p>
          <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-850 font-mono text-xs text-neutral-300 space-y-1">
            <div className="text-neutral-400"># Command Reference</div>
            <div>curl -X POST "http://localhost:8000/api/v1/disease/detect" \</div>
            <div>  -H "Authorization: Bearer $JWT" \</div>
            <div>  -F "file=@tomato_leaf_rust.jpg"</div>
          </div>
        </div>

        {/* Section 4: Policy Limits */}
        <div className="glass border border-neutral-800 rounded-3xl p-6 md:p-8 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Cpu className="h-5 w-5 text-red-400" />
            4. Ingress Rate Limits
          </h3>
          <p className="text-neutral-400 text-sm leading-relaxed">
            To prevent system overload and maintain optimal low-latency SLAs (24ms averages), the gateway limits telemetry updates to **60 posts per minute** per user token. Standard pricing plans apply for higher frequency sensory loads.
          </p>
        </div>

        {/* Interactive Swagger Guide Callout */}
        <div className="p-5 rounded-2xl bg-primary/5 border border-primary/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-primary">Need Interactive Specs?</h4>
            <p className="text-xs text-neutral-400 mt-1">Review live schema parameters directly inside our FastAPI interactive catalog.</p>
          </div>
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noreferrer"
            className="bg-primary hover:bg-primary-600 text-neutral-950 font-bold px-4 py-2.5 rounded-xl text-xs transition-colors shrink-0"
          >
            Access Swagger Documentation
          </a>
        </div>
      </main>
    </div>
  );
}
