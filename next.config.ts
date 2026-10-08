import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is a static export: Vercel only serves files, Supabase does all server work.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  // cacheComponents and partialPrefetching need a server; they cannot be used with a static export.
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
