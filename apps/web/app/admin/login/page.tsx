"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../../store/authStore";
import { useToastStore } from "../../../store/toastStore";
import { ShieldCheck, Lock, Mail, ArrowLeft, KeyRound } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const { adminLogin, isLoading, error } = useAuthStore();
  const { showToast } = useToastStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast("Please enter administrative credentials.", "error");
      return;
    }

    const success = await adminLogin(email, password);
    if (success) {
      showToast("Administrator authentication verified successfully.", "success");
      router.push("/admin");
    } else {
      showToast("Administrative access denied. Verify credentials.", "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 flex flex-col justify-center items-center px-4 relative font-sans">
      {/* Top Back Link */}
      <div className="absolute top-8 left-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-2 rounded-xl bg-white border border-slate-200 shadow-sm transition-all hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Farmer Dashboard</span>
        </Link>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full clean-card p-8 shadow-xl space-y-6 text-left relative z-10">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto shadow-sm">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Admin Demonstration Console
          </h2>
          <p className="text-xs text-slate-500">
            Authorized Demonstration & Farm OS System Administration
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
            <KeyRound className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Admin Email
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@agrinexus.demo"
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">
              Administrative Password
            </label>
            <div className="relative">
              <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-2"
          >
            {isLoading ? "Authenticating..." : "Sign In to Admin Console"}
          </button>
        </form>

        {/* 1-Click Audience Demo Quick Fill */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <button
            type="button"
            onClick={() => {
              setEmail("admin@agrinexus.demo");
              setPassword("admin123");
              showToast("Admin demonstration credentials loaded.", "info");
            }}
            className="w-full py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
          >
            <ShieldCheck className="h-4 w-4 text-amber-700" />
            <span>Fill Demo Admin Credentials (1-Click)</span>
          </button>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 text-center leading-relaxed">
            Demo: <span className="font-mono font-semibold text-slate-800">admin@agrinexus.demo</span> • <span className="font-mono font-semibold text-slate-800">admin123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
