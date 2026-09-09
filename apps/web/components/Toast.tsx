"use client";

import React from "react";
import { useToastStore } from "../store/toastStore";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

export default function Toast() {
  const { message, type, isOpen, hideToast } = useToastStore();

  if (!isOpen) return null;

  const typeConfig = {
    success: {
      border: "border-emerald-200",
      bg: "bg-white shadow-xl shadow-emerald-950/5",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      text: "text-slate-900"
    },
    error: {
      border: "border-rose-200",
      bg: "bg-white shadow-xl shadow-rose-950/5",
      icon: <AlertCircle className="h-5 w-5 text-rose-600" />,
      text: "text-slate-900"
    },
    info: {
      border: "border-blue-200",
      bg: "bg-white shadow-xl shadow-blue-950/5",
      icon: <Info className="h-5 w-5 text-blue-600" />,
      text: "text-slate-900"
    }
  };

  const current = typeConfig[type] || typeConfig.info;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-slide-up">
      <div className={`border ${current.border} ${current.bg} rounded-2xl p-4 flex items-center gap-3 max-w-sm`}>
        <div className="flex-shrink-0">{current.icon}</div>
        <div className={`flex-1 text-xs font-semibold leading-relaxed ${current.text}`}>
          {message}
        </div>
        <button 
          onClick={hideToast}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
