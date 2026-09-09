"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../store/authStore";
import { Sprout, Lock, Mail, AlertTriangle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { login, error, clearError, isLoading } = useAuthStore();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    if (!email || !password) {
      setValidationError("Please fill in all fields.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setValidationError("Please enter a valid email address.");
      return;
    }

    const success = await login(email, password);
    if (success) {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-6 py-20 bg-slate-50 text-slate-900 font-sans">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/85 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="bg-emerald-50 text-emerald-700 p-2 rounded-xl border border-emerald-100">
              <Sprout className="h-5 w-5" />
            </div>
            <span className="font-display font-bold text-lg text-slate-900">
              AgriNexus
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 hidden sm:inline">Need an account?</span>
            <Link 
              href="/register" 
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1"
            >
              Sign Up
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="w-full max-w-md pt-12">
        {/* Branding header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl border border-emerald-100 mb-3">
            <Sprout className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Sign In to AgriNexus
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Access your farms, soil records, and agronomic tools
          </p>
        </div>

        {/* Card Frame */}
        <div className="clean-card p-8 bg-white shadow-lg shadow-slate-200/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Input Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="operator@farm.com"
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Error alerts */}
            {(validationError || error) && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl text-xs flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-600" />
                <span>{validationError || error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Create account suggestion */}
        <p className="text-center text-xs text-slate-500 mt-5">
          New to AgriNexus?{" "}
          <Link href="/register" className="text-emerald-700 font-semibold hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
