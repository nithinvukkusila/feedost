import type { NextConfig } from "next";

// /dev/components is a `page.dev.tsx` file. The extra extension is recognised everywhere except a
// Vercel production build, so production has no such route (spec F2, criterion 65).
// VERCEL_ENV is set by Vercel ("production" or "preview"); it is unset locally and in CI.
const includeDevRoutes = process.env.VERCEL_ENV !== "production";

const nextConfig: NextConfig = {
  // The app is a static export: Vercel only serves files, Supabase does all server work.
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  pageExtensions: includeDevRoutes
    ? ["dev.tsx", "tsx", "ts", "jsx", "js"]
    : ["tsx", "ts", "jsx", "js"],
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
