import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: false,
  env: {
    NEXT_PUBLIC_CESIUM_BASE_URL: "/cesium",
  },
  turbopack: {},
  serverExternalPackages: ["@aws-sdk/client-s3"],
};

export default nextConfig;
