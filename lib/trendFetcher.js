// lib/trendFetcher.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

/**
 * Fetch trending insights for a given theme from Supabase (with mock fallback)
 * @param {string} subTheme - The fashion subtheme to search for
 * @returns {Array} Array of trend objects
 */
export async function fetchTrendsForTheme(subTheme) {
  console.log("🔎 fetchTrendsForTheme called with:", subTheme);

  // Default mock trends
  const mockTrends = [
    {
      content: `${subTheme} styling with layered textures and natural fabrics`,
      source: "Pinterest",
      confidence: 0.85
    },
    {
      content: `Minimalist ${subTheme} looks with neutral palettes`,
      source: "Vogue",
      confidence: 0.78
    },
    {
      content: `${subTheme} accessories trending with vintage-inspired pieces`,
      source: "Fashion Week",
      confidence: 0.72
    }
  ];

  try {
    if (!supabase) {
      console.warn("⚠️ Supabase not configured, using mock trends.");
      return mockTrends;
    }

    const { data, error } = await supabase
      .from("fashion_trends")
      .select("content, source")
      .ilike("content", `%${subTheme}%`)
      .limit(5);

    if (error) {
      console.error("❌ Supabase query failed:", error.message);
      return mockTrends;
    }

    if (data && data.length > 0) {
      console.log("✅ Trends fetched from Supabase:", data.length);
      return data.map(trend => ({
        content: trend.content,
        source: trend.source || "Supabase",
        confidence: 0.8
      }));
    }

    console.warn("⚠️ No Supabase trends found for:", subTheme);
    return mockTrends;
  } catch (err) {
    console.error("🔥 fetchTrendsForTheme error:", err.message);
    return mockTrends;
  }
}

export default { fetchTrendsForTheme };
