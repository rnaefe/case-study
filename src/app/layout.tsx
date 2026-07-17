import type { Metadata } from "next";
import { IBM_Plex_Sans, Noto_Kufi_Arabic } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"]
});

const kufi = Noto_Kufi_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700"]
});

export const metadata: Metadata = {
  title: "Lean Scale · Arabic-first AI Support",
  description: "Tenant-aware AI customer support POC for KSA commerce."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plex.variable} ${kufi.variable}`}>{children}</body>
    </html>
  );
}
