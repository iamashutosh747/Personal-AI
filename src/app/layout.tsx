import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Inter_Tight, Newsreader } from "next/font/google";
import { getViewer } from "@/lib/data";
import { hourIn, worldForHour } from "@/lib/time";
import { isSupabaseConfigured } from "@/lib/env";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import "./globals.css";

const display = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});
const serif = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});
const sans = Inter_Tight({ variable: "--font-inter-tight", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "The Inner World", template: "%s · The Inner World" },
  description: "A private sanctuary for reflection, memory and conversation.",
  applicationName: "The Inner World",
  appleWebApp: { capable: true, title: "Inner World", statusBarStyle: "black-translucent" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d0f14",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { profile } = isSupabaseConfigured() ? await getViewer() : { profile: null };
  const chosen = profile?.ambient_world ?? "midnight-library";
  const world = profile?.auto_world ? worldForHour(hourIn(profile.timezone), chosen) : chosen;
  const motion = profile?.motion === false ? "off" : "on";

  return (
    <html
      lang="en"
      data-world={world}
      data-motion={motion}
      className={`${display.variable} ${serif.variable} ${sans.variable}`}
    >
      <body>
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
