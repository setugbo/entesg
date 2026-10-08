import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* entESG: standard dynamic rendering (authenticated app).
     Tailwind v4 CSS pipeline (as scaffolded by create-next-app). */
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
