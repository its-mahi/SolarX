import type { NextConfig } from "next";

// Cache Components is intentionally off (research R-14): every SolarX page reads the
// Supabase session, and the previous caching model keeps those pages simply dynamic.
const nextConfig: NextConfig = {
  // Tests use 127.0.0.1 (see tests/helpers/api.ts); allow it to load dev-only resources.
  allowedDevOrigins: ["127.0.0.1"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
