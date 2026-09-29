import type { NextConfig } from "next";

// The shop is served at machinecanvas-wallandfloorprinting.com/shop. The main
// (static, Netlify) site proxies /shop/* to this app, so every route and asset
// here lives under the /shop base path.
const nextConfig: NextConfig = {
  basePath: "/shop",
  images: {
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co" }],
  },
  serverExternalPackages: ["sharp"],
};

export default nextConfig;
