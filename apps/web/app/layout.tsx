import type { Metadata, Viewport } from "next";
import { Archivo_Black, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { RegisterServiceWorker } from "../components/RegisterServiceWorker";

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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${archivoBlack.variable} ${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body><RegisterServiceWorker />{children}</body>
    </html>
  );
}
