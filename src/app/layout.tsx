import type { Metadata, Viewport } from "next";
import { Noto_Sans_Armenian, Nunito } from "next/font/google";
import { STORAGE_KEY } from "@/core/progress/storage";
import "./globals.css";

// Nunito is rounded but has no Armenian glyphs; the browser falls back to
// Noto Sans Armenian per character, so both scripts render correctly.
const nunito = Nunito({ variable: "--font-latin", subsets: ["latin"] });
const notoArmenian = Noto_Sans_Armenian({ variable: "--font-armenian", subsets: ["armenian"] });

// The document <title> is rendered by the app (localized); see ClientGame and Game.
export const metadata: Metadata = {
  description: "AriMap — Discover the world. · ԱրիՄապ — Բացահայտիր աշխարհը",
  applicationName: "AriMap",
  appleWebApp: { title: "AriMap", capable: true, statusBarStyle: "default" },
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
