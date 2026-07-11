"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Sprout, 
  ShieldAlert, 
  CloudSun, 
  TrendingUp, 
  Compass, 
  Coins, 
  Bot, 
  ArrowRight, 
  Activity,
  CheckCircle,
  Database,
  Layers,
  Map
} from "lucide-react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("disease");

  const modules = [
    {
      id: "disease",
      title: "Disease Detection",
      icon: ShieldAlert,
      desc: "Instant leaf analysis using PyTorch deep neural networks. Detects pathogens, evaluates severity, and outlines customized treatments.",
      stat: "98.7% Model Accuracy"
    },
    {
      id: "recommendation",
      title: "Smart Crop Optimizer",
      icon: Sprout,
      desc: "XGBoost classifier analyzing soil structure, pH, historical yield metrics, and long-range weather data to recommend optimal crops.",
      stat: "15% Yield Increase Avg"
    },
    {
      id: "schemes",
      title: "Government Schemes",
      icon: Coins,
      desc: "Algorithmic eligibility matching engine evaluating landholding limits, crop selections, and geography to secure central and state subsidies.",
      stat: "45+ Active Schemes"
    },
    {
      id: "weather",
      title: "Weather Intelligence",
      icon: CloudSun,
      desc: "Microclimate forecasts integrated with warning triggers for frost, localized storms, soil saturation thresholds, and extreme heat cycles.",
      stat: "Hour-by-hour Alerts"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header */}
      <header className="glass fixed top-0 w-full z-50 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
              <Sprout className="h-6 w-6 text-primary" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
              AgriNexus <span className="text-primary">AI</span>
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
            <a href="#features" className="hover:text-primary transition-colors">OS Modules</a>
            <a href="#platform" className="hover:text-primary transition-colors">AI Core</a>
            <a href="#schemes" className="hover:text-primary transition-colors">Schemes</a>
            <a href="#docs" className="hover:text-primary transition-colors">System Docs</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-neutral-300 hover:text-white transition-colors">
              Sign In
            </Link>
            <Link href="/dashboard" className="bg-primary hover:bg-primary-600 text-neutral-950 font-semibold px-4 py-2 rounded-xl text-sm transition-all duration-300 shadow-[0_0_20px_rgba(0,200,117,0.2)] hover:shadow-[0_0_25px_rgba(0,200,117,0.35)] flex items-center gap-1.5 group">
              Launch Farm Console
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 pt-32">
        <div className="max-w-7xl mx-auto px-6 text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-neutral-800 text-xs font-semibold text-neutral-300 mb-8 animate-fade-in">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
            </span>
            AgriNexus AI v1.0.0 Production Release
          </div>

          {/* Heading */}
          <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.1] mb-6 animate-slide-up">
            The Smart Farm Operating System <span className="bg-gradient-to-r from-primary to-emerald-400 bg-clip-text text-transparent">Powered by AI</span>
          </h1>

          {/* Subtitle */}
          <p className="text-neutral-400 text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: "100ms" }}>
            Unifying precision agriculture, real-time disease detection, localized microclimate analysis, and government subsidy routing in a secure, production-grade farm engine.
          </p>

          {/* Call to Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20 animate-slide-up" style={{ animationDelay: "200ms" }}>
            <Link href="/register" className="w-full sm:w-auto bg-primary hover:bg-primary-600 text-neutral-950 font-bold px-8 py-4 rounded-2xl transition-all duration-300 shadow-[0_0_30px_rgba(0,200,117,0.25)] flex items-center justify-center gap-2 group">
              Start Free Trial
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link href="/register" className="w-full sm:w-auto glass glass-hover text-neutral-200 font-semibold px-8 py-4 rounded-2xl transition-all flex items-center justify-center gap-2">
              Book Architecture Demo
            </Link>
          </div>

          {/* Mockup Showcase Panel */}
          <div className="relative glass rounded-3xl p-2 border border-neutral-800 shadow-2xl max-w-5xl mx-auto overflow-hidden animate-slide-up" style={{ animationDelay: "300ms" }}>
            <div className="glass bg-neutral-900/90 rounded-[22px] border border-neutral-800/80 p-6 flex flex-col md:flex-row gap-6">
              {/* Mockup Sidebar */}
              <div className="w-full md:w-64 flex flex-col gap-2 text-left">
                <div className="text-xs font-bold text-neutral-400 uppercase tracking-widest px-3 mb-2">OS Modules</div>
                {modules.map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setActiveTab(m.id)}
                      className={`flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all duration-300 text-left border ${
                        activeTab === m.id
                          ? "bg-neutral-800/70 border-primary/30 text-white shadow-sm"
                          : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30"
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${activeTab === m.id ? "text-primary" : ""}`} />
                      <span className="font-semibold text-sm">{m.title}</span>
                    </button>
                  );
                })}
              </div>

              {/* Mockup Content Panel */}
              <div className="flex-1 glass bg-neutral-950/70 border border-neutral-800/50 rounded-2xl p-6 text-left flex flex-col justify-between min-h-[300px]">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20">
                      {modules.find(m => m.id === activeTab)?.stat}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      Core Engine Active
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {modules.find(m => m.id === activeTab)?.title}
                  </h3>
                  <p className="text-neutral-400 leading-relaxed mb-6 text-sm md:text-base">
                    {modules.find(m => m.id === activeTab)?.desc}
                  </p>
                </div>

                {/* Internal Mock Graphic elements to represent a high-end dashboard */}
                <div className="border-t border-neutral-800/80 pt-6 flex flex-wrap gap-4 items-center justify-between">
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
                      <Database className="h-4 w-4 text-neutral-500" />
                      PostgreSQL Connection OK
                    </div>
                    <div className="flex items-center gap-2 text-xs font-medium text-neutral-400">
                      <Activity className="h-4 w-4 text-primary" />
                      FastAPI Latency: 24ms
                    </div>
                  </div>
                  <button className="text-xs font-bold text-primary hover:text-white transition-colors flex items-center gap-1">
                    Explore API Specs
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Grid */}
        <section id="features" className="py-28 relative">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
                Fully Consolidated Farm Operations
              </h2>
              <p className="text-neutral-400">
                Replace fragmented agricultural tools with a single unified, secure enterprise operating system.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="glass glass-hover p-8 rounded-2xl border border-neutral-800 transition-all duration-300">
                <div className="bg-primary/10 border border-primary/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">AgriNexus AI Copilot</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Interactive RAG-enabled chatbot designed to assist in scheduling, treatment steps, and financial subsidy navigation.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="glass glass-hover p-8 rounded-2xl border border-neutral-800 transition-all duration-300">
                <div className="bg-accent-blue/10 border border-accent-blue/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <Layers className="h-6 w-6 text-accent-blue" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Monorepo Scalability</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Clean architecture separation of client and service domains. Fully containerized development stack.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="glass glass-hover p-8 rounded-2xl border border-neutral-800 transition-all duration-300">
                <div className="bg-accent-amber/10 border border-accent-amber/20 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
                  <Map className="h-6 w-6 text-accent-amber" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Geospatial Targeting</h3>
                <p className="text-neutral-400 text-sm leading-relaxed">
                  Contextualize farming inputs with geography, validating regional soil reports alongside global satellite overlays.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-12 text-sm text-neutral-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <Sprout className="h-5 w-5 text-primary" />
            <span className="font-bold text-white">AgriNexus AI</span>
          </div>
          <p>© 2026 AgriNexus AI Inc. All rights reserved. Professional graduation project.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-neutral-300">API Policy</a>
            <a href="#" className="hover:text-neutral-300">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
