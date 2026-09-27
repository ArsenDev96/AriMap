import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AriMap — Discover the world.",
    short_name: "AriMap",
    description: "Discover the world. · Բացահայտիր աշխարհը",
    start_url: "/",
    display: "standalone",
    background_color: "#fff7ec",
    theme_color: "#fff7ec",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
