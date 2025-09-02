
import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicTool } from "langchain/tools";
import axios from "axios";
import { db } from "./firebase.js"; // already exists in your project
import { validateLook } from "./lib/fashionBrain.js";
import { validateLookAgainstRules } from "./lib/styleRules.js";
import { styleMoodMap } from "./styleMoodMap.js";

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.6,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/* ─── Tools ─── */
const wardrobeTool = new DynamicTool({
  name: "wardrobe",
  description: "Fetch wardrobe for a given uid",
  func: async (uid) => {
    const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
    return JSON.stringify(snap.docs.map((d) => d.data()));
  },
});

const weatherTool = new DynamicTool({
  name: "weather",
  description: "Get current weather for a city",
  func: async (city) => {
    const url = `https://api.openweathermap.org/data/2.5/weather?units=metric&q=${encodeURIComponent(
      city,
    )}&appid=${process.env.OPENWEATHER_API_KEY}`;
    const { data } = await axios.get(url);
    return `${data.weather?.[0]?.description}, ${Math.round(data.main.temp)}°C`;
  },
});

const moodTool = new DynamicTool({
  name: "mood",
  description: "Map style mood to fashion guidance (colors, silhouettes, vibe)",
  func: async (mood) => JSON.stringify(styleMoodMap[mood.toLowerCase()] || {}),
});

const validateTool = new DynamicTool({
  name: "validate",
  description: "Validate an outfit with fashion rules",
  func: async (outfitJson) => {
    const outfit = JSON.parse(outfitJson);
    const fb = validateLook(outfit);
    const rules = validateLookAgainstRules({ items: outfit });
    return JSON.stringify({ fb, rules });
  },
});

/* ─── Executor ─── */
export async function runTina({
  uid,
  city,
  mood,
  occasion,
  vibe,
  prompt,
  wardrobe = [],
}) {
  const executor = await initializeAgentExecutorWithOptions(
    [wardrobeTool, weatherTool, moodTool, validateTool],
    llm,
    {
      agentType: "openai-functions",
      verbose: true,
    },
  );

  const wardrobeJson = JSON.stringify(
    wardrobe.map((it) => ({
      id: it.id || "",
      name: it.name || "",
      category: it.category || "",
      color: it.color || "",
      image_url: it.image_url || "",
      tags: it.tags || [],
    }))
  );

  const input = `
  You are Tina, a world-class AI fashion stylist.

  CONTEXT (user already provided this, do not ask again):
  - UID: ${uid}
  - City (weather): ${city}
  - Mood: ${mood}
  - Occasion: ${occasion}
  - Vibe: ${vibe}
  - Wardrobe (JSON array): ${wardrobeJson}

  TASK:
  1. Suggest 2–3 complete outfits (3–5 items each) strictly from the wardrobe array (must use wardrobe.id).
  2. Always include footwear if available.
  3. Add a style_note explaining why the look works (color harmony, silhouette balance).
  4. Validate outfits using validate(outfit).

  ⚠️ CRITICAL INSTRUCTION:
  - Return ONLY valid JSON.
  - No markdown, no prose, no code fences.
  - Must exactly match this schema:

  {
    "looks": [
      {
        "title": "Look 1",
        "style_note": "Why this outfit works",
        "items": [
          { "id": "wardrobeId1" },
          { "id": "wardrobeId2" }
        ]
      }
    ]
  }
  `;

  const result = await executor.call({ input });

  console.log("🔎 Tina raw result:", result);
  
  let output = result.output;

  // 🔍 Try deeper extraction
  if (typeof output === "string") {
    try {
      output = JSON.parse(output);
    } catch (err) {
      console.error("❌ Could not parse Tina output:", err, output);
      return { looks: [], error: "Invalid Tina output" };
    }
  }

  if (output?.raw && typeof output.raw === "string") {
    try {
      output = JSON.parse(output.raw);
    } catch (err) {
      console.error("❌ Could not parse Tina raw string:", err, output.raw);
      return { looks: [], error: "Invalid Tina raw output" };
    }
  }

  // ✅ Normalize
  if (!output.looks || !Array.isArray(output.looks)) {
    return { looks: [], error: "Invalid Tina output format" };
  }

  console.log("🎯 TinaAgent final parsed output:", output);
  return output;
}
