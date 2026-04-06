import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Serve Snoqualmie Badminton",
    short_name: "Snobaddy",
    description: "Badminton session and season tracker",
    start_url: "/",
    display: "standalone",
    background_color: "#f9fafb",
    theme_color: "#2563eb",
    orientation: "portrait",
    icons: [
      {
        src: "/serve-icon.png",
        sizes: "308x310",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/serve-icon.png",
        sizes: "308x310",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
