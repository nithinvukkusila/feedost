import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
  // The only experimental flag in the app. Several root layouts and a top-level [locale] segment leave
  // Next no single layout to build a 404 from, so out/404.html had no <html lang>. global-not-found.tsx
  // is the documented fix. If an upgrade drops the flag, scripts/check-404.mjs fails in CI.
  experimental: { globalNotFound: true },
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

// Finds src/i18n/request.ts. No proxy, no redirects and no rewrites: none of them work with a static export.
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
