
// lib/trendFetcher.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_ANON_KEY || ""
);

/**
 * Fetch trending insights for a given theme from Supabase
 * @param {string} subTheme - The fashion subtheme to search for
 * @returns {Array} Array of trend objects
 */
export async function fetchTrendsForTheme(subTheme) {
  try {
    // Mock data for now since Supabase trends table may not be fully set up
    const mockTrends = [
      {
        content: `${subTheme} styling with layered textures and natural fabrics`,
        source: "Pinterest",
        confidence: 0.85
      },
      {
        content: `Minimalist ${subTheme} looks with neutral color palettes`,
        source: "Vogue",
        confidence: 0.78
      },
      {
        content: `${subTheme} accessories trending with vintage-inspired pieces`,
        source: "Fashion Week",
        confidence: 0.72
      }
    ];

    // Try to fetch from Supabase if available
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      const { data, error } = await supabase
        .from("fashion_trends")
        .select("*")
        .ilike("content", `%${subTheme}%`)
        .limit(5);

      if (!error && data && data.length > 0) {
        return data.map(trend => ({
          content: trend.content,
          source: trend.source || "Database",
          confidence: 0.8
        }));
      }
    }

    // Return mock data as fallback
    return mockTrends;
  } catch (err) {
    console.warn("⚠️ fetchTrendsForTheme error:", err.message);
    return [];
  }
}

export default { fetchTrendsForTheme };
