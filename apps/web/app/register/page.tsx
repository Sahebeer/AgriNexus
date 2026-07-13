"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../store/authStore";
import { Sprout, User, Lock, Mail, Phone, MapPin, Shield, AlertTriangle, ArrowRight, CheckCircle } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { register, error, clearError, isLoading } = useAuthStore();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "farmer",
    phone_number: "",
    state: "",
  });

  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const roles = [
    { value: "farmer", label: "Farmer / Farm Operator" },
    { value: "expert", label: "Agricultural Expert / Advisor" },
    { value: "official", label: "Government official" },
    { value: "admin", label: "System Administrator" },
  ];

  // List of states in India (as default geo support for schemes matching)
  const states = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", 
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", 
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", 
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setFormData((prev: typeof formData) => ({ ...prev, [id]: value }));
    if (validationError) setValidationError(null);
    clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    clearError();

    const { email, password, full_name, role } = formData;

    if (!email || !password || !full_name || !role) {
      setValidationError("Please fill in all required fields (*).");
      return;
    }

    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters long.");
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      setValidationError("Please enter a valid email address.");
      return;
    }

    const success = await register(formData);
    if (success) {
      setIsSuccess(true);
      setTimeout(() => {
        router.push("/login");
      }, 2500);
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
            <span className="text-xs text-neutral-500 hidden sm:inline">Already registered?</span>
            <Link 
              href="/login" 
              className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-semibold px-4 py-2 rounded-xl text-sm transition-all duration-300 flex items-center gap-1 group"
            >
              Sign In
              <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
          </div>
        </div>
      </header>

      {/* Background Glow */}
      <div className="absolute w-[450px] h-[450px] bg-primary/5 rounded-full blur-[90px] bottom-1/4 right-1/3 pointer-events-none"></div>

      <div className="w-full max-w-2xl z-10">
        <div className="flex flex-col items-center mb-6 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-white">
            Create AgriNexus Profile
          </h2>
          <p className="text-sm text-neutral-400 mt-2">
            Establish a secure digital hub to manage soil insights, crops, and grants.
          </p>
        </div>

        {/* Card Frame */}
        <div className="glass rounded-3xl p-8 border border-neutral-800 shadow-2xl relative overflow-hidden">
          {isSuccess ? (
            <div className="py-12 flex flex-col items-center justify-center text-center animate-fade-in">
              <div className="bg-primary/10 border border-primary/30 p-4 rounded-full text-primary mb-4 animate-bounce">
                <CheckCircle className="h-12 w-12" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Registration Successful!</h3>
              <p className="text-neutral-400 text-sm max-w-sm">
                Your operator profile is now active. Redirecting you to the security login console...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Full Name */}
                <div>
                  <label htmlFor="full_name" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <input
                      id="full_name"
                      type="text"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="John Doe"
                      className="w-full bg-neutral-900/60 border border-neutral-850 hover:border-neutral-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-all duration-300"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="john@example.com"
                      className="w-full bg-neutral-900/60 border border-neutral-850 hover:border-neutral-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-all duration-300"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full bg-neutral-900/60 border border-neutral-850 hover:border-neutral-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-all duration-300"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Select Role */}
                <div>
                  <label htmlFor="role" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Operator Role *
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <select
                      id="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full bg-neutral-900/60 border border-neutral-850 hover:border-neutral-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-neutral-500 outline-none appearance-none transition-all duration-300"
                      disabled={isLoading}
                    >
                      {roles.map((r) => (
                        <option key={r.value} value={r.value} className="bg-neutral-900 text-white">
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="phone_number" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <input
                      id="phone_number"
                      type="text"
                      value={formData.phone_number}
                      onChange={handleInputChange}
                      placeholder="+91 XXXXX XXXXX"
                      className="w-full bg-neutral-900/60 border border-neutral-850 hover:border-neutral-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-neutral-500 outline-none transition-all duration-300"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Geographic State */}
                <div>
                  <label htmlFor="state" className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Location State (Schemes Routing)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-500" />
                    <select
                      id="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full bg-neutral-900/60 border border-neutral-850 hover:border-neutral-700 focus:border-primary focus:ring-1 focus:ring-primary rounded-xl py-3 pl-12 pr-4 text-sm text-white placeholder-neutral-500 outline-none appearance-none transition-all duration-300"
                      disabled={isLoading}
                    >
                      <option value="" className="bg-neutral-900 text-neutral-500">Select State</option>
                      {states.map((s) => (
                        <option key={s} value={s} className="bg-neutral-900 text-white">
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* Validation errors */}
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
                    Initialize Profile
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Existing account suggestion */}
        {!isSuccess && (
          <p className="text-center text-sm text-neutral-500 mt-6">
            Already have an active console?{" "}
            <Link href="/login" className="text-primary hover:text-white font-medium transition-colors">
              Access Terminal
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
