import 'dotenv/config';
console.log("SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("SUPABASE_ANON_KEY set?", !!process.env.SUPABASE_ANON_KEY);

import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicTool } from "langchain/tools";
import axios from "axios";
import { db } from "./firebase.js";
import { validateLook } from "./lib/fashionBrain.js";
import { validateLookAgainstRules } from "./lib/styleRules.js";
import { styleMoodMap } from "./styleMoodMap.js";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

/* ─── Supabase ─── */
let supabase;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY env vars are required");
  }
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
} catch (error) {
  console.error("Failed to initialize Supabase client:", error.message);
  process.exit(1);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.6,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/* ─── Tools ─── */
const wardrobeTool = new DynamicTool({
  name: "wardrobe",
  description: "Fetch wardrobe for a given uid",
  func: async (input) => {
    try {
      const uid = input.trim();
      const snap = await db.collection("wardrobe").where("uid", "==", uid).get();
      return JSON.stringify(snap.docs.map((d) => d.data()));
    } catch (err) {
      return `Error in wardrobe tool: ${err.message}`;
    }
  },
});

const weatherTool = new DynamicTool({
  name: "weather",
  description: "Get current weather for a city",
  func: async (input) => {
    try {
      const city = input.trim();
      const url = `https://api.openweathermap.org/data/2.5/weather?units=metric&q=${encodeURIComponent(city)}&appid=${process.env.OPENWEATHER_API_KEY}`;
      const { data } = await axios.get(url);
      return `${data.weather?.[0]?.description}, ${Math.round(data.main.temp)}°C`;
    } catch (err) {
      return `Error in weather tool: ${err.message}`;
    }
  },
});

const moodTool = new DynamicTool({
  name: "mood",
  description: "Map style mood to fashion guidance",
  func: async (input) => {
    const mood = input.trim().toLowerCase();
    return JSON.stringify(styleMoodMap[mood] || {});
  },
});

const validateTool = new DynamicTool({
  name: "validate",
  description: "Validate an outfit with fashion rules",
  func: async (input) => {
    try {
      const outfit = JSON.parse(input);
      const fb = validateLook(outfit);
      const rules = validateLookAgainstRules({ items: outfit });
      return JSON.stringify({ fb, rules });
    } catch (err) {
      return `Error in validate tool: ${err.message}`;
    }
  },
});

const trendTool = new DynamicTool({
  name: "getTrendInsights",
  description: "Fetch top fashion trends related to wardrobe",
  func: async (input) => {
    try {
      console.log("🟣 [trendTool] Query:", input);
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input,
      });
      const embedding = embeddingResponse.data[0].embedding;

      const { data, error } = await supabase.rpc("match_trends", {
        query_embedding: embedding,
        match_count: 3,
      });

      if (error) {
        console.error("🔴 [trendTool] Supabase error:", error);
        return "Error fetching trends";
      }

      return JSON.stringify(data);
    } catch (err) {
      console.error("🔴 [trendTool] Exception:", err);
      return `Error in trend tool: ${err.message}`;
    }
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
    [wardrobeTool, weatherTool, moodTool, validateTool, trendTool],
    llm,
    { agentType: "openai-functions", verbose: true },
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

  CONTEXT:
  - UID: ${uid}
  - City: ${city}
  - Mood: ${mood}
  - Occasion: ${occasion}
  - Vibe: ${vibe}
  - Wardrobe: ${wardrobeJson}

  TASK:
  1. Suggest 2–3 outfits (3–5 items each) using only wardrobe items (use their id).
  2. If wardrobe is very small, still produce at least 1 outfit.
  3. Always include footwear if available.
  4. For each look, call getTrendInsights on at least one item.
     - If match, add to "trends_used".
  5. Add style_note (color, silhouette, trend relevance).
  6. Validate with validate(outfit).
  7. Never return empty. If nothing works, make your best guess and still output 1 look.

  ⚠️ Return ONLY valid JSON:
  {
    "looks": [
      {
        "title": "Look 1",
        "style_note": "Why this outfit works",
        "items": [{ "id": "wardrobeId1" }, { "id": "wardrobeId2" }],
        "trends_used": [{ "trend_id": 1, "content": "Example trend" }]
      }
    ]
  }
  `;

  console.log("🟢 TinaAgent input prompt:", input);

  const result = await executor.call({ input });

  console.log("🟠 TinaAgent executor raw result:", JSON.stringify(result, null, 2));

  let output;

  // 1️⃣ Use result.output first
  if (result.output) {
    output = result.output;
  }

  // 2️⃣ Fallback: use returnValues.output
  else if (result.returnValues?.output) {
    console.log("🟢 Using returnValues.output");
    output = result.returnValues.output;
  }

  // 3️⃣ Fallback: sometimes LangChain puts JSON in result.returnValues directly
  else if (result.returnValues) {
    console.log("🟢 Using entire returnValues");
    output = result.returnValues;
  }

  // 4️⃣ If still nothing
  else {
    console.error("❌ No usable output found in result");
    return { looks: [], error: "No Tina output" };
  }

  // 🔍 Parse if string
  if (typeof output === "string") {
    try {
      output = JSON.parse(output);
    } catch (err) {
      console.error("❌ Could not parse Tina output string:", output);
      return { looks: [], error: "Invalid Tina output string" };
    }
  }

  // 🔍 Parse if inside raw
  if (output?.raw && typeof output.raw === "string") {
    try {
      output = JSON.parse(output.raw);
    } catch (err) {
      console.error("❌ Could not parse Tina raw:", output.raw);
      return { looks: [], error: "Invalid Tina raw" };
    }
  }


  if (output?.raw && typeof output.raw === "string") {
    try { output = JSON.parse(output.raw); }
    catch { return { looks: [], error: "Invalid Tina raw output" }; }
  }

  
// 🔥 Fallback if no looks
if (!output?.looks || output.looks.length === 0) {
  console.warn("⚠️ Tina returned no looks. Using fallback.");
  output = {
    looks: [
      {
        title: "Fallback Look",
        style_note: "Auto-generated fallback look since Tina returned empty.",
        items: wardrobe.slice(0, 3).map(it => ({ id: it.id })),
        trends_used: [],
      },
    ],
  };
}

// Always ensure trends_used exists
output.looks = output.looks.map((look) => ({
  ...look,
  trends_used: look.trends_used || [],
}));

console.log("🎯 TinaAgent final parsed output:", output);
return output;
