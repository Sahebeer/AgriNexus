"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "../store/authStore";
import { Sprout, AlertCircle } from "lucide-react";

const PUBLIC_ROUTES = ["/login", "/register", "/"];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  const [showDiagnostic, setShowDiagnostic] = React.useState(false);
  const [resolvedURL, setResolvedURL] = React.useState("");

  // Run session check on initial mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Monitor loading time. If it takes longer than 4.5 seconds, display host connection diagnostic warnings.
  useEffect(() => {
    if (isLoading) {
      const timer = setTimeout(() => {
        setShowDiagnostic(true);
        if (typeof window !== "undefined") {
          const hostname = window.location.hostname;
          const url = (hostname && hostname !== "localhost" && hostname !== "127.0.0.1" && !hostname.includes("vercel.app"))
            ? `http://${hostname}:8000`
            : "http://localhost:8000";
          setResolvedURL(url);
        }
      }, 4500);
      return () => clearTimeout(timer);
    } else {
      setShowDiagnostic(false);
    }
  }, [isLoading]);

  // Route protection redirect checks
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isPublic) {
      router.push("/login");
    } else if (isAuthenticated && isPublic && pathname !== "/") {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, pathname, router, isPublic]);

  // Role based route checking
  const isAdminRoute = pathname.startsWith("/dashboard/admin");
  const isExpertRoute = pathname.startsWith("/dashboard/expert");

  const hasAccess = 
    !isLoading &&
    (!isAdminRoute || user?.role === "admin" || user?.is_superuser) &&
    (!isExpertRoute || user?.role === "expert" || user?.role === "admin" || user?.is_superuser);

  // Elegant loader screen while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center relative overflow-hidden px-6 text-center">
        {/* Glow */}
        <div className="absolute w-[350px] h-[350px] bg-primary/10 rounded-full blur-[60px] animate-pulse-slow"></div>
        <div className="relative z-10 flex flex-col items-center gap-4 max-w-md">
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center justify-center animate-bounce">
            <Sprout className="h-8 w-8 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-wider text-neutral-400 animate-pulse">
            Booting AgriNexus OS...
          </span>

          {showDiagnostic && (
            <div className="mt-6 bg-red-950/25 border border-red-500/20 p-5 rounded-2xl text-xs text-neutral-400 space-y-2 text-left animate-fade-in max-w-sm">
              <div className="flex items-center gap-2 text-red-400 font-bold mb-1">
                <AlertCircle className="h-4 w-4" /> Connection Diagnostic Advisory
              </div>
              <p className="leading-relaxed">
                AgriNexus is trying to establish a secure handshake with the backend container at: <br/>
                <code className="text-white bg-neutral-900 px-1.5 py-0.5 rounded font-mono block mt-1 border border-neutral-800">{resolvedURL}/api/v1/auth/me</code>
              </p>
              <p className="leading-relaxed mt-2 text-[11px]">
                If this screen does not unlock, it means your browser cannot reach that endpoint. Please verify:
              </p>
              <ul className="list-disc pl-4 space-y-1 text-neutral-500 text-[10px]">
                <li>Your phone and MacBook are connected to the <strong>same Wi-Fi network</strong>.</li>
                <li>Your MacBook's firewall is not blocking incoming port <strong>8000</strong>.</li>
                <li>The backend Docker container is running (<code className="text-neutral-300">docker ps</code> shows status).</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Deny access view if role validation fails
  if (!isPublic && !hasAccess) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-6">
        <div className="glass border border-neutral-800 rounded-3xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-neutral-400 text-sm mb-6">
            Your current account role ({user?.role}) does not have permission to access {pathname}.
          </p>
          <button 
            onClick={() => router.push("/dashboard")}
            className="w-full bg-primary text-neutral-950 font-semibold py-2.5 rounded-xl text-sm hover:bg-primary-600 transition-colors"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
