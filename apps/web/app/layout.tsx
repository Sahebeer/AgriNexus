import type { Metadata } from "next";
import AuthProvider from "../components/AuthProvider";
import Toast from "../components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgriNexus - Smart Farm Management & Precision Agriculture",
  description: "Precision agriculture, plant pathology diagnostics, market intelligence, farm mapping, and agricultural advisory.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-neutral-50 text-neutral-900 min-h-screen selection:bg-primary-100 selection:text-primary-900 antialiased font-sans">
        <AuthProvider>
          {children}
          <Toast />
        </AuthProvider>
      </body>
    </html>
  );
}
