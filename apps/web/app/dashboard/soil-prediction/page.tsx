"use client";

import SoilPredictionModule from "../../../components/modules/SoilPredictionModule";

export default function SoilPredictionPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans pb-16">
      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-6 w-full">
        <SoilPredictionModule />
      </main>
    </div>
  );
}
