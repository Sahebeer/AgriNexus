"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "../../store/authStore";
import { Sprout, User, Lock, Mail, Phone, MapPin, Shield, AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

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
    { value: "official", label: "Government Official" },
    { value: "admin", label: "System Administrator" },
  ];

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
      }, 2000);
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
            <span className="text-xs text-slate-500 hidden sm:inline">Already registered?</span>
            <Link 
              href="/login" 
              className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm flex items-center gap-1"
            >
              Sign In
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <div className="w-full max-w-2xl pt-12">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="bg-emerald-50 text-emerald-700 p-3 rounded-2xl border border-emerald-100 mb-3">
            <Sprout className="h-6 w-6" />
          </div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Create Operator Profile
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Register to manage fields, track plant pathology, and discover agricultural subsidies
          </p>
        </div>

        {/* Card Frame */}
        <div className="clean-card p-8 bg-white shadow-lg shadow-slate-200/50">
          {isSuccess ? (
            <div className="py-10 flex flex-col items-center justify-center text-center">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-full text-emerald-600 mb-3">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-1">Registration Complete!</h3>
              <p className="text-slate-500 text-xs max-w-sm">
                Your profile is active. Redirecting you to sign in...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Full Name */}
                <div>
                  <label htmlFor="full_name" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="full_name"
                      type="text"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="ramesh@example.com"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Select Role */}
                <div>
                  <label htmlFor="role" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Role *
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                      id="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 outline-none appearance-none transition-all"
                      disabled={isLoading}
                    >
                      {roles.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="phone_number" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="phone_number"
                      type="text"
                      value={formData.phone_number}
                      onChange={handleInputChange}
                      placeholder="+91 98765 43210"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 placeholder-slate-400 outline-none transition-all"
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Geographic State */}
                <div>
                  <label htmlFor="state" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    State (Subsidies & Schemes)
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <select
                      id="state"
                      value={formData.state}
                      onChange={handleInputChange}
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-600 rounded-xl py-2.5 pl-10 pr-4 text-xs text-slate-900 outline-none appearance-none transition-all"
                      disabled={isLoading}
                    >
                      <option value="">Select State</option>
                      {states.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

              </div>

              {/* Validation errors */}
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
                    Create Profile
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {!isSuccess && (
          <p className="text-center text-xs text-slate-500 mt-5">
            Already have an account?{" "}
            <Link href="/login" className="text-emerald-700 font-semibold hover:underline">
              Sign In
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
