"use client";

import React from "react";
import { useToastStore } from "../store/toastStore";
import { CheckCircle, AlertCircle, Info, X } from "lucide-react";

export default function Toast() {
  const { message, type, isOpen, hideToast } = useToastStore();

  if (!isOpen) return null;

  const typeConfig = {
    success: {
      border: "border-primary/20",
      bg: "bg-neutral-900/90 shadow-[0_0_20px_rgba(0,200,117,0.1)]",
      icon: <CheckCircle className="h-5 w-5 text-primary" />,
      text: "text-white"
    },
    error: {
      border: "border-red-500/20",
      bg: "bg-neutral-900/90 shadow-[0_0_20px_rgba(239,68,68,0.1)]",
      icon: <AlertCircle className="h-5 w-5 text-red-400" />,
      text: "text-white"
    },
    info: {
      border: "border-accent-blue/20",
      bg: "bg-neutral-900/90 shadow-[0_0_20px_rgba(59,130,246,0.1)]",
      icon: <Info className="h-5 w-5 text-accent-blue" />,
      text: "text-white"
    }
  };

  const current = typeConfig[type] || typeConfig.info;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] animate-slide-up">
      <div className={`glass border ${current.border} ${current.bg} rounded-2xl p-4 flex items-center gap-3 max-w-sm backdrop-blur-md`}>
        <div className="flex-shrink-0">{current.icon}</div>
        <div className={`flex-1 text-xs font-semibold leading-relaxed ${current.text}`}>
          {message}
        </div>
        <button 
          onClick={hideToast}
          className="p-1 rounded-lg text-neutral-500 hover:text-white hover:bg-neutral-800/40 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
