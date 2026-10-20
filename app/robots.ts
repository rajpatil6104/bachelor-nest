import type { MetadataRoute } from "next";

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bachelor-nest.vercel.app";
const base = site.replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/owner/", "/admin/", "/alerts", "/saved", "/visits", "/chat", "/forgot-password"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
