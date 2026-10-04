import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone, which the Dockerfile copies into the runtime image.
  output: "standalone",
  experimental: {
    serverActions: {
      // Daily reports carry up to 10 photos (downscaled in the browser when possible).
      bodySizeLimit: "40mb",
    },
  },
};

export default nextConfig;
