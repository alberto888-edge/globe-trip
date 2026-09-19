import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Globe Trip",
    short_name: "Globe Trip",
    description: "Convierte vídeos de viajes en rutas sobre un globo 3D.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4efe6",
    theme_color: "#f4efe6",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
