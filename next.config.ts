import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // yahoo-finance2 must stay a server-only external package
  serverExternalPackages: ["yahoo-finance2"],
  async headers() {
    return [
      {
        source: "/data/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=300, s-maxage=900, stale-while-revalidate=86400" }],
      },
    ];
  },
};

export default nextConfig;
