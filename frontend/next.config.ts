import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  experimental: {
    webpackBuildWorker: false,
  },
};

export default nextConfig;
