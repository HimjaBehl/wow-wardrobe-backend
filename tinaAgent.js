import { ChatOpenAI } from "@langchain/openai";
import { themeAttributes } from "./lib/themeAttributes.js";

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

  const input = `
You are Tina, a world-class AI stylist.

CONTEXT:
- User ID: ${uid}
- City: ${city}
- SubTheme: ${subTheme}
- Theme Attributes: ${JSON.stringify(selectedTheme)}
- Wardrobe JSON: ${wardrobeJson}

TASK:
1. Suggest **2–3 complete looks** (3–5 items each).
2. Use wardrobe items only. Reference them by "id".
3. Match theme attributes strictly (e.g. Party → sparkle dress, heels, clutch).
4. Ensure footwear is included if available.
5. Output valid JSON only.
`;

  // 🆕 DEBUG LOG — show prompt Tina will see
  console.log("📝 Tina Prompt Preview:\n", input.slice(0, 1000), "...");

  const model = new ChatOpenAI({ modelName: "gpt-4o-mini", temperature: 0.7 });
  const response = await model.invoke(input);

  console.log("🎨 Tina's raw response:", response.content);
  return response.content;
}
