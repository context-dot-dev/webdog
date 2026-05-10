import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** External on the server avoids missing `vendor-chunks/better-auth.js` and related webpack chunk bugs. */
  serverExternalPackages: ["pg", "better-auth"],
};

export default nextConfig;
