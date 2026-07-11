"use client";

import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "../store/authStore";
import { Sprout } from "lucide-react";

const PUBLIC_ROUTES = ["/login", "/register", "/"];

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_ROUTES.includes(pathname);

  // Run session check on initial mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Route protection redirect checks
  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated && !isPublic) {
      // Redirect unauthenticated user to login page
      router.push("/login");
    } else if (isAuthenticated && isPublic && pathname !== "/") {
      // Redirect authenticated user away from login/register to dashboard
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
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Glow */}
        <div className="absolute w-[350px] h-[350px] bg-primary/10 rounded-full blur-[60px] animate-pulse-slow"></div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="bg-neutral-900 border border-neutral-800 p-4 rounded-2xl flex items-center justify-center animate-bounce">
            <Sprout className="h-8 w-8 text-primary" />
          </div>
          <span className="text-sm font-semibold tracking-wider text-neutral-400 animate-pulse">
            Booting AgriNexus OS...
          </span>
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
