import type { Metadata } from "next";
import AuthProvider from "../components/AuthProvider";
import Toast from "../components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriNexus AI - Smart Farm Operating System",
  description: "Next-generation precision agriculture, disease detection, government schemes recommendation, and AI assistant.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-neutral-950 text-neutral-100 min-h-screen selection:bg-primary selection:text-neutral-950 antialiased">
        <div className="relative overflow-hidden min-h-screen">
          {/* Ambient Background Glows */}
          <div className="ambient-glow -top-40 -left-40" />
          <div className="ambient-glow top-1/2 -right-40 transform -translate-y-1/2" style={{ background: "radial-gradient(circle, rgba(59, 130, 246, 0.06) 0%, rgba(0,200,117,0.02) 50%, rgba(0,0,0,0) 100%)" }} />
          
          <div className="relative z-10">
            <AuthProvider>
              {children}
              <Toast />
            </AuthProvider>
          </div>
        </div>
      </body>
    </html>
  );
}
