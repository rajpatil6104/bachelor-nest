import type { MetadataRoute } from "next";
import { getSupabase } from "@/lib/supabase";

// Regenerate hourly so newly approved listings join the sitemap without
// waiting for a redeploy.
export const revalidate = 3600;

const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bachelor-nest.vercel.app";
const base = site.replace(/\/$/, "");

async function listingUrls(): Promise<MetadataRoute.Sitemap> {
  // Use the app's own client: it trims/cleans the env values, which a raw
  // fetch doesn't — a stray space or quote in the dashboard env vars made
  // the previous fetch-based version silently return no listings.
  const sb = getSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("listings")
      .select("id, created_at")
      .eq("status", "approved")
      .limit(1000);
    if (error || !data) return [];
    return data.map((r) => ({
      url: `${base}/listing/${r.id}`,
      lastModified: r.created_at ? new Date(r.created_at) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/search`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
  ];
  return [...staticRoutes, ...(await listingUrls())];
}
