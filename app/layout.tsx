import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted (OFL) so the preview, the print proof and future server renders
// all use exactly the same glyphs.
const spaceMono = localFont({
  variable: "--font-space-mono",
  src: [
    { path: "./fonts/space-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/space-mono-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  display: "block",
});

const spaceGrotesk = localFont({
  variable: "--font-space-grotesk",
  src: [
    { path: "./fonts/space-grotesk-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/space-grotesk-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Race Receipt — Design your marathon print",
  description: "A personalised thermal-receipt print of a marathon, for the runner in your life.",
};

export const viewport: Viewport = {
  themeColor: "#e7e1d4",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spaceMono.variable} ${spaceGrotesk.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
