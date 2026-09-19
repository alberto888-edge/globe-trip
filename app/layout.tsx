import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Globe Trip",
  description: "Convierte vídeos de viajes de TikTok e Instagram en rutas sobre un globo 3D.",
  applicationName: "Globe Trip",
  appleWebApp: { capable: true, title: "Globe Trip", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4efe6" },
    { media: "(prefers-color-scheme: dark)", color: "#12140f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;1,600&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap"
        />
        <link rel="preload" as="image" href="/textures/earth.jpg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
