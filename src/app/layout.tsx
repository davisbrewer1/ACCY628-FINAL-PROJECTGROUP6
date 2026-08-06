import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const nexusDisplay = localFont({
  src: "../../public/fonts/AksenTrial-ExpandedLight.otf",
  variable: "--font-nexus-display",
  display: "swap",
  weight: "300",
});

const nexusDisplayItalic = localFont({
  src: "../../public/fonts/AksenTrial-ExpandedMediumItalic.otf",
  variable: "--font-nexus-display-italic",
  display: "swap",
  weight: "500",
  style: "italic",
});

const nexusButton = localFont({
  src: "../../public/fonts/LibelSuit-Regular.otf",
  variable: "--font-nexus-button",
  display: "swap",
  weight: "400",
});

export const metadata: Metadata = {
  title: "Nexus Technology Solutions",
  description:
    "Technology operations, service delivery, AI governance, and profitability in one connected platform.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="nexus"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${nexusDisplay.variable} ${nexusDisplayItalic.variable} ${nexusButton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
