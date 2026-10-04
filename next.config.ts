import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone, which the Dockerfile copies into the runtime image.
  output: "standalone",
};

export default nextConfig;
