import type { NextConfig } from "next";

const FAN_API_ALLOWED_ORIGINS = [
  "https://ethio-league-live.vercel.app",
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
  async headers() {
    return [
      {
        // Apply CORS headers to all /api/fan/* routes
        source: "/api/fan/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: FAN_API_ALLOWED_ORIGINS.join(","),
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Accept",
          },
          {
            key: "Access-Control-Max-Age",
            value: "86400",
          },
          {
            key: "Cache-Control",
            value: "public, s-maxage=60, stale-while-revalidate=300",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
