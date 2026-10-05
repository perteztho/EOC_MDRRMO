import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MDRRMO – Monitoring System | Municipality of Pio Duran MDRRMO",
  description:
    "MDRRMO EOC Monitoring, Tracking, Submission & Management System. Connecting the 33 barangays of Pio Duran with the MDRRMO through faster, simpler, transparent, and accountable digital transactions.",
  keywords: ["QAS33", "BDRRMP", "Pio Duran", "MDRRMO", "DRRM", "Albay", "barangay"],
  manifest: "/manifest.webmanifest",
  icons: {
    // Official MDRRMO Pio Duran seal (upload/logome.webp) as favicon + icons
    icon: [
      { url: "/logome.webp", type: "image/webp", sizes: "512x512" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // viewport-fit=cover — required for env(safe-area-inset-*) on iOS notched devices
  // (the mobile bottom app bar respects the home-indicator inset).
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
