import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { Toaster } from "@/components/ui/sonner";
import { AnalyticsProvider } from "@/components/analytics/analytics";
import { brand } from "@/config/brand";
import { publicEnv } from "@/lib/public-env";
import "./globals.css";

// One family for display and body: the width axis gives the wide display voice.
const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
  axes: ["wdth"],
});
// Figures only: not preloaded, so it never competes with the text faces for the first paint.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
  preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    metadataBase: new URL(publicEnv.siteUrl),
    title: { default: t("title", { brand: brand.name }), template: `%s · ${brand.name}` },
    description: t("description"),
    applicationName: brand.name,
    openGraph: { siteName: brand.name, type: "website" },
    robots: process.env.APP_ENV === "production" ? undefined : { index: false, follow: false },
  };
}

export const viewport: Viewport = {
  themeColor: "#120c32",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("nav");
  return (
    <html lang="en" className={`dark ${archivo.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-primary px-4 py-3 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          {t("skip")}
        </a>
        <NextIntlClientProvider>
          <AnalyticsProvider>{children}</AnalyticsProvider>
        </NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
