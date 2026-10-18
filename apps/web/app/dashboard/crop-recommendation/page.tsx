"use client";

import CropRecommendationModule from "../../../components/modules/CropRecommendationModule";

export default function CropRecommendationPage() {
  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col font-sans pb-16">
      <main className="flex-1 max-w-7xl mx-auto px-4 md:px-8 py-6 w-full">
        <CropRecommendationModule />
      </main>
    </div>
  );
}
