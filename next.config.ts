import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  output: "standalone",
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  outputFileTracingRoot: process.cwd(),
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
