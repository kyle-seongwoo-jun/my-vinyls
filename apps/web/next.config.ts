import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // cover art is served straight from Discogs' image CDN
    remotePatterns: [{ protocol: "https", hostname: "i.discogs.com" }],
  },
};

export default nextConfig;
