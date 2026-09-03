import type { Metadata, Viewport } from "next";
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import type { Locale } from "@foodiesfeed/contracts";
import "../globals.css";
import { RegisterServiceWorker } from "../../components/RegisterServiceWorker";
import { isSupportedLocale, getDictionary } from "../../i18n/dictionaries";
import { SiteHeader } from "../../components/SiteHeader";

const archivoBlack = Archivo_Black({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-archivo-black",
  display: "swap",
});
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FoodiesFeed — clearer product notes",
  description: "Search packaged foods and understand the label before you buy.",
  applicationName: "FoodiesFeed",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#496d42",
  width: "device-width",
  initialScale: 1,
};

export function generateStaticParams() {
  return ["en", "nl", "de", "fr"].map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Readonly<{ children: React.ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale: rawLocale } = await params;
  if (!isSupportedLocale(rawLocale)) notFound();
  const locale = rawLocale as Locale;
  const dictionary = getDictionary(locale);
  return (
    <html lang={locale} className={`${archivoBlack.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body>
        <RegisterServiceWorker />
        <div className="locale-shell">
          <a className="skip-link" href="#main-content">{dictionary.skipToContent}</a>
          <SiteHeader locale={locale} />
          {children}
          <footer className="site-footer">{dictionary.footerNote}</footer>
        </div>
      </body>
    </html>
  );
}
