import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // ffmpeg-static ships a native binary: keep it out of the bundle and make
  // sure Vercel copies it next to the video-analysis function.
  serverExternalPackages: ["ffmpeg-static"],
  outputFileTracingIncludes: {
    "/api/analyze": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
};

export default nextConfig;
