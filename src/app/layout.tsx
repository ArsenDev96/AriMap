import type { Metadata, Viewport } from "next";
import { Noto_Sans_Armenian, Nunito } from "next/font/google";
import { STORAGE_KEY } from "@/core/progress/storage";
import { CANONICAL_URL } from "@/core/site";
import "./globals.css";

// Nunito is rounded but has no Armenian glyphs; the browser falls back to
// Noto Sans Armenian per character, so both scripts render correctly. The order
// that makes this work is set in globals.css (--font), not by --font-latin.
const nunito = Nunito({ variable: "--font-latin", subsets: ["latin"] });
const notoArmenian = Noto_Sans_Armenian({ variable: "--font-armenian", subsets: ["armenian"] });

// The document <title> is rendered by the app (localized); see ClientGame and Game.
export const metadata: Metadata = {
  // Every deployment (Previews, the earlier ari-map.vercel.app) names the canonical site, never itself.
  alternates: { canonical: CANONICAL_URL },
  description: "AriMap — Discover the world. · ԱրիՄապ — Բացահայտիր աշխարհը",
  applicationName: "AriMap",
  appleWebApp: { title: "AriMap", capable: true, statusBarStyle: "default" },
  // Google AdSense site-ownership verification only: no ad script is loaded.
  other: { "google-adsense-account": "ca-pub-2410519694761753" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fffaf0",
};

// Applies the saved language to <html lang> before first paint (see
// "Preventing flash before hydration" in the Next.js docs).
const setLangScript = `try{var s=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}));if(s&&s.locale==="hy"){document.documentElement.lang="hy"}}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${nunito.variable} ${notoArmenian.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: setLangScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
