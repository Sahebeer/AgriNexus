"use client";

import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import { useAuthStore } from "../../store/authStore";
import { useToastStore } from "../../store/toastStore";
import { 
  ArrowLeft, 
  Coins, 
  Search, 
  MapPin, 
  ChevronRight, 
  CheckCircle2, 
  X, 
  FileText, 
  RefreshCw,
  ExternalLink,
  Phone,
  ShieldCheck
} from "lucide-react";

interface CriterionMatch {
  criterion: string;
  value: string;
  status: string;
}

interface SchemeRecommendation {
  id: string;
  name: string;
  agency: string;
  category: string;
  scope: string;
  description: string;
  benefits: string;
  documents: string[];
  helpline: string;
  portal_url: string;
  checklist: CriterionMatch[];
  match_score: number;
}

interface SchemesModuleProps {
  onBack?: () => void;
}

const CATEGORIES = ["All", "Financial Assistance", "Crop Insurance", "Inputs & Machinery", "Irrigation & Soil"];

export default function SchemesModule({ onBack }: SchemesModuleProps) {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [schemes, setSchemes] = useState<SchemeRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedScheme, setSelectedScheme] = useState<SchemeRecommendation | null>(null);

  const fetchSchemes = async () => {
    setIsLoading(true);
    try {
      const res = await api.get("/api/v1/schemes/catalog");
      setSchemes(res.data);
    } catch {
      // Demo fallback schemes
      setSchemes([
        {
          id: "pm-kisan",
          name: "PM-KISAN Samman Nidhi",
          agency: "Ministry of Agriculture & Farmers Welfare",
          category: "Financial Assistance",
          scope: "National",
          description: "Direct income support of ₹6,000 per year in three equal installments to all landholding farmer families.",
          benefits: "₹6,000 / year direct cash transfer via DBT",
          documents: ["Aadhaar Card", "Landholding Records (Khatauni)", "Bank Account Passbook"],
          helpline: "155261 / 011-24300606",
          portal_url: "https://pmkisan.gov.in",
          checklist: [{ criterion: "Land Ownership", value: "Verified", status: "eligible" }],
          match_score: 98
        },
        {
          id: "pmfby",
          name: "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
          agency: "Govt of India",
          category: "Crop Insurance",
          scope: "National",
          description: "Comprehensive risk insurance for crop loss due to non-preventable natural risks from pre-sowing to post-harvest.",
          benefits: "Up to 100% sum insured against natural pestilence, flood, drought",
          documents: ["Land Possession Certificate", "Sowing Certificate / Declaration", "Aadhaar Card"],
          helpline: "1800-180-1551",
          portal_url: "https://pmfby.gov.in",
          checklist: [{ criterion: "Notified Crop Area", value: "Verified", status: "eligible" }],
          match_score: 95
        },
        {
          id: "pmksy",
          name: "Pradhan Mantri Krishi Sinchayee Yojana (Micro-Irrigation)",
          agency: "National Micro Irrigation Mission",
          category: "Irrigation & Soil",
          scope: "National",
          description: "Financial subsidy up to 55% for small/marginal farmers installing Drip and Sprinkler irrigation systems.",
          benefits: "45% to 55% direct subsidy on micro-irrigation hardware",
          documents: ["Water Source Proof", "Electricity Connection / Solar", "Land Records"],
          helpline: "011-23381012",
          portal_url: "https://pmksy.gov.in",
          checklist: [{ criterion: "Farm Size", value: "Marginal (<2 Ha)", status: "eligible" }],
          match_score: 90
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSchemes();
  }, []);

  const filtered = schemes.filter((s) => {
    if (selectedCategory === "All") return true;
    return s.category.toLowerCase().includes(selectedCategory.toLowerCase());
  });

  return (
    <div className="space-y-6 animate-fade-in text-left">
      {/* Header Banner */}
      <div className="clean-card p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button 
              onClick={onBack}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-200 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div>
            <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600" />
              Government Subsidies & Schemes Directory
            </h1>
            <p className="text-xs text-slate-500">Discover eligible central and state agricultural support programs with direct documentation checklists</p>
          </div>
        </div>

        <button
          onClick={fetchSchemes}
          className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin text-emerald-600" : ""}`} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              selectedCategory === cat
                ? "bg-purple-50 border-purple-300 text-purple-900 shadow-sm"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Schemes Grid */}
      {isLoading ? (
        <div className="flex justify-center py-24"><RefreshCw className="h-8 w-8 animate-spin text-emerald-600" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((scheme) => (
            <div key={scheme.id} className="clean-card clean-card-hover p-6 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200 uppercase">
                    {scheme.category}
                  </span>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                    {scheme.match_score}% Match
                  </span>
                </div>

                <div>
                  <h3 className="font-bold text-base text-slate-900 leading-snug">{scheme.name}</h3>
                  <span className="text-[11px] text-slate-400 block mt-0.5">{scheme.agency}</span>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-3 leading-relaxed">
                    {scheme.description}
                  </p>
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Key Benefit</span>
                  <span className="text-xs font-bold text-emerald-800 block">{scheme.benefits}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  onClick={() => setSelectedScheme(scheme)}
                  className="flex-1 py-2 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold transition-colors"
                >
                  View Requirements
                </button>
                {scheme.portal_url && (
                  <a
                    href={scheme.portal_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
                    title="Open Official Portal"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scheme Detail Modal */}
      {selectedScheme && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-scale-in">
            <div className="border-b border-slate-100 p-6 flex justify-between items-center bg-slate-50/60">
              <div>
                <span className="text-[10px] font-bold text-purple-700 uppercase">{selectedScheme.category}</span>
                <h3 className="text-base font-bold text-slate-900 mt-0.5">{selectedScheme.name}</h3>
              </div>
              <button
                onClick={() => setSelectedScheme(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto text-xs leading-relaxed text-slate-700">
              <div className="space-y-1">
                <span className="font-bold text-slate-900 block">Description:</span>
                <p className="text-slate-600">{selectedScheme.description}</p>
              </div>

              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                <span className="font-bold text-emerald-950 block">Financial & Hardware Subsidies:</span>
                <p className="text-emerald-900 font-semibold">{selectedScheme.benefits}</p>
              </div>

              <div className="space-y-2">
                <span className="font-bold text-slate-900 block">Required Documentation:</span>
                <ul className="space-y-1.5">
                  {selectedScheme.documents.map((doc, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-slate-600">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                      <span>{doc}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {selectedScheme.helpline && (
                <div className="pt-2 flex items-center gap-2 text-slate-600">
                  <Phone className="h-4 w-4 text-purple-600" />
                  <span>Kisan Helpline: <strong className="text-slate-900">{selectedScheme.helpline}</strong></span>
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 p-5 bg-slate-50/50 flex gap-3">
              <button
                onClick={() => setSelectedScheme(null)}
                className="flex-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl text-xs transition-colors"
              >
                Close
              </button>
              {selectedScheme.portal_url && (
                <a
                  href={selectedScheme.portal_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span>Apply on Official Portal</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
