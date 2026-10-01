import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ffmpeg-static ships a native binary: keep it out of the bundle and make
  // sure Vercel copies it next to the video-analysis function.
  serverExternalPackages: ["ffmpeg-static"],
  // The globe's tile engine, with three fixes measured against the real thing: no tiles
  // fetched beyond the horizon, no tiles skipped because they are bigger than the view,
  // and no blank screen near the poles. See lib/vendor/README.md.
  turbopack: {
    resolveAlias: { "three-slippy-map-globe": "./lib/vendor/three-slippy-map-globe.mjs" },
  },
  outputFileTracingIncludes: {
    "/api/analyze": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
