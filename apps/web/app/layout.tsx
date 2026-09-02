import type { Metadata, Viewport } from "next";
import "./globals.css";
import { RegisterServiceWorker } from "../components/RegisterServiceWorker";

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
    <html lang="en">
      <body><RegisterServiceWorker />{children}</body>
    </html>
  );
}
