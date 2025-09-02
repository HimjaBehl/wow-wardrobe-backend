import 'dotenv/config';
console.log("SUPABASE_URL =", process.env.SUPABASE_URL);
console.log("SUPABASE_ANON_KEY set?", !!process.env.SUPABASE_ANON_KEY);

import { ChatOpenAI } from "@langchain/openai";
import { initializeAgentExecutorWithOptions } from "langchain/agents";
import { DynamicTool } from "langchain/tools";
import axios from "axios";
import { db } from "./firebase.js"; // already exists in your project
import { validateLook } from "./lib/fashionBrain.js";
import { validateLookAgainstRules } from "./lib/styleRules.js";
import { styleMoodMap } from "./styleMoodMap.js";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// Initialize Supabase client with proper error handling
let supabase;
try {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required');
  }
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
} catch (error) {
  console.error('Failed to initialize Supabase client:', error.message);
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const llm = new ChatOpenAI({
  modelName: "gpt-4o-mini",
  temperature: 0.6,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/* ─── Tools ─── */
const wardrobeTool = new DynamicTool({
  name: "wardrobe",
  description: "Fetch wardrobe for a given uid (expects a plain UID string)",
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
  description: "Get current weather for a city (expects a city name string)",
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
  description: "Map style mood to fashion guidance (expects a mood string like 'powerful')",
  func: async (input) => {
    const mood = input.trim().toLowerCase();
    return JSON.stringify(styleMoodMap[mood] || {});
  },
});


const validateTool = new DynamicTool({
  name: "validate",
  description: "Validate an outfit with fashion rules (expects JSON string of outfit items)",
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
  description: "Fetch top fashion trends related to the wardrobe (expects a string query like 'denim skirt')",
  func: async (input) => {
    try {
      // 1. Create embedding from input text
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input,
      });
      const embedding = embeddingResponse.data[0].embedding;

      // 2. Query Supabase using match_trends
      const { data, error } = await supabase.rpc("match_trends", {
        query_embedding: embedding,
        match_count: 3,
      });

      if (error) {
        console.error("Trend fetch error:", error);
        return "Error fetching trends";
      }

      return JSON.stringify(data);
    } catch (err) {
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
  3. Use getTrendInsights(wardrobe item names or categories) to see if trends match.
     - If a trend fits, mention it in the style_note.
  4. Add a style_note explaining why the look works (color harmony, silhouette balance, and trend relevance if any).
  5. Validate outfits using validate(outfit).
  6. Always include "trends_used" if any trend from getTrendInsights matched wardrobe items.


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
        ],
        "trends_used": [
          { "trend_id": 1, "content": "Metallic accessories are trending this season" },
          { "trend_id": 2, "content": "Denim maxi skirts are the must-have item of the season" }
        ]
      }
    ]
  }

  `;

  const result = await executor.call({ input });

console.log("🔎 Tina raw result:", result);

let output = result.output;

// 1️⃣ Sometimes LangChain stores JSON here
if (!output && result.returnValues?.output) {
  output = result.returnValues.output;
}

// 2️⃣ If it’s still a string, try parsing
if (typeof output === "string") {
  try {
    output = JSON.parse(output);
  } catch (err) {
    console.error("❌ Could not parse Tina output string:", output);
    return { looks: [], error: "Invalid Tina output" };
  }
}

// 3️⃣ If agent wrapped JSON inside `.raw`
if (output?.raw && typeof output.raw === "string") {
  try {
    output = JSON.parse(output.raw);
  } catch (err) {
    console.error("❌ Could not parse Tina raw field:", output.raw);
    return { looks: [], error: "Invalid Tina raw output" };
  }
}

// ✅ Final check
if (!output.looks || !Array.isArray(output.looks)) {
  console.error("❌ Tina output missing `looks`:", output);
  return { looks: [], error: "Invalid Tina output format" };
}

// Ensure trends_used always exists
output.looks = output.looks.map((look) => ({
  ...look,
  trends_used: look.trends_used || [],
}));

console.log("🎯 TinaAgent final parsed output:", output);
return output;

}