import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FoodiesFeed",
    short_name: "FoodiesFeed",
    description: "A clearer label for curious eaters.",
    start_url: "/en",
    display: "standalone",
    background_color: "#f6f4ee",
    theme_color: "#496d42",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "any" },
      { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
