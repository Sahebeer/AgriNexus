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
    <div className="min-h-screen flex flex-col justify-center items-center px-6 py-24 relative bg-neutral-950">
      {/* Header */}
      <header className="glass fixed top-0 w-full z-50 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="bg-primary/10 p-2 rounded-xl border border-primary/20 group-hover:border-primary/40 transition-colors">
              <Sprout className="h-6 w-6 text-primary" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight bg-gradient-to-r from-neutral-50 to-neutral-400 bg-clip-text text-transparent">
              AgriNexus <span className="text-primary">AI</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-neutral-400">
            <Link href="/#features" className="hover:text-primary transition-colors">OS Modules</Link>
            <Link href="/#platform" className="hover:text-primary transition-colors">AI Core</Link>
            <Link href="/#schemes" className="hover:text-primary transition-colors">Schemes</Link>
            <Link href="/#docs" className="hover:text-primary transition-colors">System Docs</Link>
          </nav>

          <div className="flex items-center gap-4">
            <span className="text-xs text-neutral-500 hidden sm:inline">New operator?</span>
            <Link 
              href="/register" 
              className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-semibold px-4 py-2 rounded-xl text-sm transition-all duration-300 flex items-center gap-1 group"
            >
              Sign Up
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* Background Glow Effect */}
      <div className="absolute w-[450px] h-[450px] bg-primary/5 rounded-full blur-[90px] top-1/4 left-1/3 pointer-events-none"></div>

      <div className="w-full max-w-md z-10">
        {/* Branding header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white">
            Access Farm OS
          </h2>
          <p className="text-sm text-neutral-400 mt-2">
            Enter credentials to connect to AgriNexus gateways.
          </p>
        </div>

        {/* Card Frame */}
        <div className="glass rounded-3xl p-8 border border-neutral-800 shadow-2xl relative overflow-hidden">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input Email */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="name@farm.com"
                  className="w-full bg-neutral-900/60 border border-neutral-850 hover:border-neutral-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-all duration-300"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Input Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                  Password
                </label>
                <a href="#" className="text-xs text-neutral-500 hover:text-primary transition-colors">
                  Forgot?
                </a>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-neutral-900/60 border border-neutral-850 hover:border-neutral-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-all duration-300"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Error alerts */}
            {(validationError || error) && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm flex items-start gap-3 animate-fade-in">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{validationError || error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-primary hover:bg-primary-600 text-neutral-950 font-bold py-3.5 rounded-xl text-sm transition-all duration-300 shadow-[0_0_20px_rgba(0,200,117,0.15)] flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              {isLoading ? (
                <span className="h-5 w-5 border-2 border-neutral-950 border-t-transparent rounded-full animate-spin"></span>
              ) : (
                <>
                  Connect Gateway
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Create account suggestion */}
        <p className="text-center text-sm text-neutral-500 mt-6">
          New to AgriNexus?{" "}
          <Link href="/register" className="text-primary hover:text-white font-medium transition-colors">
            Create an operator profile
          </Link>
        </p>
      </div>
    </div>
  );
}
