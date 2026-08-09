import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // skip type-checking and linting during build — CI handles that separately
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
