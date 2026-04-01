import { ChatOpenAI } from "@langchain/openai";
import { themeAttributes } from "./lib/themeAttributes.js";
// 🔮 Later we’ll plug this into Supabase (Pinterest moodboards)
import { fetchTrendsForTheme } from "./lib/trendFetcher.js";

export async function runTina({ uid, city, wardrobe = [], subTheme }) {
  console.log("🎯 runTina received:", {
    uid,
    city,
    subTheme,
    wardrobeCount: wardrobe.length,
    sampleItem: wardrobe[0] || null
  });

  const wardrobeJson = JSON.stringify(wardrobe.slice(0, 30));
  const selectedTheme = themeAttributes?.Western?.[subTheme] || {};

  // 1️⃣ Pull trends (mock for now, real from Supabase later)
  let trendContext = [];
  try {
    trendContext = await fetchTrendsForTheme(subTheme); 
  } catch (err) {
    console.warn("⚠️ Could not fetch trend context:", err.message);
  }

  // 🔍 Debug log: show dictionary + trends
  console.log("📖 Theme dictionary used:", JSON.stringify(selectedTheme, null, 2));
  console.log("✨ Trend context used:", JSON.stringify(trendContext, null, 2));

  const input = `
You are Tina, a world-class AI stylist.

CONTEXT:
- User ID: ${uid}
- City: ${city}
- SubTheme: ${subTheme}
- Theme Attributes (dictionary): ${JSON.stringify(selectedTheme)}
- Trend Context (from Pinterest/Supabase): ${JSON.stringify(trendContext)}
- Wardrobe JSON: ${wardrobeJson}

TASK:
1. Suggest **2–3 complete looks** (3–5 items each).
2. Use wardrobe items only. Reference them by "id".
3. Prioritize matches with Theme Attributes AND Trend Context.
4. Always include footwear if available.
5. Each look must include:
   - "title"
   - "style_note" (explain fit, balance, or why it works)
   - "items" (list of wardrobe { "id": "..." })
   - "matched_attributes": which attributes from Theme Attributes were satisfied
   - "trends_used": which trends from Trend Context were satisfied
6. Output valid JSON only in this schema:

{
  "looks": [
    {
      "title": "Look name",
      "style_note": "Short explanation",
      "items": [ { "id": "..." }, { "id": "..." } ],
      "matched_attributes": ["..."],
      "trends_used": ["..."]
    }
  ]
}
`;

  // 📝 Debug log: show prompt Tina will see
  console.log("📝 Tina Prompt Preview:\n", input.slice(0, 800), "...");

  const model = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0.7
  });

  const response = await model.invoke(input);
  console.log("🎨 Tina's raw response:", response.content);

  let jsonOut;
  try {
    const raw = response.content?.[0]?.text || response.content || "";
    jsonOut = JSON.parse(raw);

    if (!jsonOut.looks && jsonOut.look) {
      console.warn("⚠️ Tina used 'look' instead of 'looks', auto-fixing.");
      jsonOut.looks = [
        {
          title: "Look 1",
          style_note: "Auto-fixed schema",
          items: jsonOut.look
        }
      ];
      delete jsonOut.look;
    }
  } catch (err) {
    console.warn("⚠️ Could not parse Tina JSON, returning fallback. Error:", err.message);
    jsonOut = { looks: [] };
  }

  return jsonOut;
}
